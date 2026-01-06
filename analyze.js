const https = require('https');

const CRORE = 10000000;
const SEASONAL_SECTORS = ['Consumer Cyclical', 'Consumer Defensive', 'Consumer Discretionary', 'Consumer Staples', 'Retail'];

// Rating functions
const ratings = {
  revenue: v => v==null?null:v<1000?0:v<5000?1:v<20000?2:v<50000?3:v<100000?4:5,
  marketCap: v => v==null?null:v<1000?0:v<5000?1:v<20000?2:v<100000?3:v<500000?4:5,
  peg: v => v==null?null:v<1?5:v<1.5?4:v<2?3:v<2.5?2:v<3?1:0,
  cagr: v => v==null?null:v<0?0:v<5?1:v<10?2:v<15?3:v<20?4:5,
  peIndustry: v => v==null?null:v<0.6?5:v<0.8?4:v<1?3:v<1.2?2:v<1.5?1:0,
  revenueMC: v => v==null?null:(v*100)<5?0:(v*100)<10?1:(v*100)<15?2:(v*100)<25?3:(v*100)<40?4:5,
  evEbit: v => v==null?null:v<7?5:v<10?4:v<15?3:v<20?2:v<25?1:0,
  cmpFcf: v => v==null?null:v<10?5:v<15?4:v<20?3:v<30?2:v<40?1:0,
  roic: v => v==null?null:v<5?0:v<10?1:v<15?2:v<20?3:v<30?4:5,
  roe: v => v==null?null:v<8?0:v<12?1:v<15?2:v<20?3:v<30?4:5,
  roce: v => v==null?null:v<10?0:v<15?1:v<20?2:v<25?3:v<35?4:5,
  opm: v => v==null?null:v<5?0:v<10?1:v<15?2:v<20?3:v<30?4:5,
  volatility: v => v==null?null:v<10?5:v<15?4:v<20?3:v<25?2:v<30?1:0,
  beta: v => v==null?null:v<0.6?5:v<0.8?4:v<1?3:v<1.2?2:v<1.5?1:0,
  seasonality: v => v===false?5:v===true?2:null,
  revenueVolatility: v => v==null?null:v<10?5:v<15?3:v<20?1:0,
  netDebtProfit: (v, isNetCash) => isNetCash?5:v==null||v<0?null:v<1?4:v<2?3:v<3?2:v<5?1:0,
  quickRatio: v => v==null?null:v<0.8?0:v<1?1:v<1.2?2:v<1.5?3:v<2?4:5,
};

// Fetch JSON from URL
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Analyze a single stock
async function analyzeStock(ticker) {
  let symbol = ticker.trim().toUpperCase();
  if (!symbol.includes('.')) symbol += '.NS';
  
  const result = {
    ticker: symbol,
    name: symbol,
    sector: null,
    metrics: {},
    ratings: {},
    categoryScores: {},
    finalScore: null,
    error: null
  };
  
  try {
    // Fetch quote summary
    const summaryUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price,summaryDetail,defaultKeyStatistics,financialData,balanceSheetHistory,incomeStatementHistory,cashflowStatementHistory`;
    const summaryData = await fetchJSON(summaryUrl);
    
    if (summaryData.quoteSummary?.error) {
      result.error = summaryData.quoteSummary.error.description || 'Yahoo Finance error';
      return result;
    }
    
    const mod = summaryData.quoteSummary?.result?.[0];
    if (!mod) {
      result.error = `No data found for ${symbol}. Check ticker symbol.`;
      return result;
    }
    
    const price = mod.price || {};
    const summary = mod.summaryDetail || {};
    const keyStats = mod.defaultKeyStatistics || {};
    const financial = mod.financialData || {};
    const bs = mod.balanceSheetHistory?.balanceSheetStatements?.[0] || {};
    const inc = mod.incomeStatementHistory?.incomeStatementHistory?.[0] || {};
    const cf = mod.cashflowStatementHistory?.cashflowStatements?.[0] || {};
    
    const v = (o, k) => o?.[k]?.raw ?? null;
    
    result.name = price.longName || price.shortName || symbol;
    result.sector = price.sector || null;
    
    const m = result.metrics;
    
    // Scale
    const rev = v(inc, 'totalRevenue') || v(financial, 'totalRevenue');
    m.revenue = rev ? rev / CRORE : null;
    const mc = v(price, 'marketCap');
    m.marketCap = mc ? mc / CRORE : null;
    
    // Growth
    m.peg = v(keyStats, 'pegRatio');
    
    // Value
    m.pe = v(summary, 'trailingPE');
    m.forwardPE = v(keyStats, 'forwardPE');
    m.industryPE = m.forwardPE; // Using forward PE as proxy
    m.peIndustryRatio = m.pe && m.industryPE > 0 ? m.pe / m.industryPE : null;
    m.revenueMC = m.revenue && m.marketCap > 0 ? m.revenue / m.marketCap : null;
    m.eps = v(keyStats, 'trailingEps');
    
    const ev = v(keyStats, 'enterpriseValue');
    const ebit = v(inc, 'ebit') || v(financial, 'ebitda');
    m.evEbit = ev && ebit > 0 ? ev / ebit : null;
    
    const cp = v(price, 'regularMarketPrice');
    const fcf = v(financial, 'freeCashflow');
    const shares = v(keyStats, 'sharesOutstanding');
    m.cmpFcf = cp && fcf && shares > 0 && fcf/shares > 0 ? cp / (fcf/shares) : null;
    
    // Quality
    const opInc = v(inc, 'operatingIncome') || ebit;
    const totalDebt = v(bs, 'longTermDebt') || 0;
    const shortDebt = v(bs, 'shortLongTermDebt') || 0;
    const debt = totalDebt + shortDebt;
    const equity = v(bs, 'totalStockholderEquity') || 0;
    const cash = v(bs, 'cash') || v(financial, 'totalCash') || 0;
    const ic = debt + equity - cash;
    
    m.roic = opInc && ic > 0 ? (opInc * 0.75 / ic) * 100 : null;
    
    const roe = v(financial, 'returnOnEquity');
    m.roe = roe ? roe * 100 : null;
    
    const ta = v(bs, 'totalAssets');
    const cl = v(bs, 'totalCurrentLiabilities');
    m.roce = opInc && ta && cl && ta - cl > 0 ? (opInc / (ta - cl)) * 100 : null;
    
    const opm = v(financial, 'operatingMargins');
    m.opm = opm ? opm * 100 : null;
    
    // Risk
    m.beta = v(summary, 'beta') || v(keyStats, 'beta');
    m.seasonality = result.sector ? SEASONAL_SECTORS.some(s => result.sector.includes(s)) : null;
    m.seasonalityText = m.seasonality === true ? 'Yes' : m.seasonality === false ? 'No' : 'N/A';
    m.quickRatio = v(financial, 'quickRatio');
    
    // Balance Sheet
    const netDebt = debt - cash;
    m.isNetCash = netDebt < 0;
    const ni = v(inc, 'netIncome') || v(financial, 'netIncomeToCommon');
    m.netDebtProfit = m.isNetCash ? null : (ni > 0 ? netDebt / ni : null);
    m.netDebtProfitText = m.isNetCash ? 'Net Cash' : (m.netDebtProfit != null ? m.netDebtProfit.toFixed(2) : 'N/A');
    
    // Additional
    const capex = Math.abs(v(cf, 'capitalExpenditures') || 0);
    m.capex = capex ? capex / CRORE : null;
    m.capexRevenue = rev && capex ? (capex / rev) * 100 : null;
    
    // Fetch historical data for CAGR and volatility
    try {
      const endTs = Math.floor(Date.now() / 1000);
      const startTs = endTs - (3 * 365 * 24 * 60 * 60);
      const histUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startTs}&period2=${endTs}&interval=1d`;
      const histData = await fetchJSON(histUrl);
      
      const closes = histData.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(c => c != null && c > 0);
      if (closes && closes.length > 100) {
        // CAGR
        const years = closes.length / 252;
        m.cagr = (Math.pow(closes[closes.length - 1] / closes[0], 1/years) - 1) * 100;
        
        // Volatility
        const returns = [];
        for (let i = 1; i < closes.length; i++) {
          returns.push((closes[i] - closes[i-1]) / closes[i-1]);
        }
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length;
        m.volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;
      }
    } catch (e) {
      // Historical data failed, continue without
    }
    
    // Revenue volatility
    const incList = mod.incomeStatementHistory?.incomeStatementHistory || [];
    if (incList.length >= 3) {
      const revs = incList.slice(0, 3).map(s => v(s, 'totalRevenue')).filter(r => r != null);
      if (revs.length >= 3) {
        const meanRev = revs.reduce((a, b) => a + b, 0) / revs.length;
        const stdRev = Math.sqrt(revs.reduce((s, r) => s + Math.pow(r - meanRev, 2), 0) / revs.length);
        m.revenueVolatility = (stdRev / meanRev) * 100;
        m.revenueVolatilityText = m.revenueVolatility < 10 ? 'Low' : m.revenueVolatility < 15 ? 'Medium' : m.revenueVolatility < 20 ? 'High' : 'Very High';
      }
    }
    
    // Calculate ratings
    const r = result.ratings;
    r.revenue = ratings.revenue(m.revenue);
    r.marketCap = ratings.marketCap(m.marketCap);
    r.peg = ratings.peg(m.peg);
    r.cagr = ratings.cagr(m.cagr);
    r.peIndustry = ratings.peIndustry(m.peIndustryRatio);
    r.revenueMC = ratings.revenueMC(m.revenueMC);
    r.evEbit = ratings.evEbit(m.evEbit);
    r.cmpFcf = ratings.cmpFcf(m.cmpFcf);
    r.roic = ratings.roic(m.roic);
    r.roe = ratings.roe(m.roe);
    r.roce = ratings.roce(m.roce);
    r.opm = ratings.opm(m.opm);
    r.volatility = ratings.volatility(m.volatility);
    r.beta = ratings.beta(m.beta);
    r.seasonality = ratings.seasonality(m.seasonality);
    r.revenueVolatility = ratings.revenueVolatility(m.revenueVolatility);
    r.netDebtProfit = ratings.netDebtProfit(m.netDebtProfit, m.isNetCash);
    r.quickRatio = ratings.quickRatio(m.quickRatio);
    
    // Category scores
    const avg = arr => {
      const valid = arr.filter(x => x != null);
      return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    };
    
    const cs = result.categoryScores;
    cs.scale = avg([r.revenue, r.marketCap]);
    cs.growth = avg([r.peg, r.cagr]);
    cs.value = avg([r.peIndustry, r.revenueMC, r.evEbit, r.cmpFcf]);
    cs.quality = avg([r.roic, r.roe, r.roce, r.opm]);
    cs.risk = avg([r.volatility, r.beta, r.seasonality, r.revenueVolatility]);
    cs.balance = avg([r.netDebtProfit, r.quickRatio]);
    
    // Final score
    const weights = { scale: 0.15, growth: 0.15, value: 0.25, quality: 0.25, risk: 0.10, balance: 0.10 };
    let ws = 0, tw = 0;
    for (const [k, w] of Object.entries(weights)) {
      if (cs[k] != null) { ws += w * cs[k]; tw += w; }
    }
    result.finalScore = tw > 0 ? ws / tw : null;
    
    return result;
    
  } catch (e) {
    result.error = `Error: ${e.message}`;
    return result;
  }
}

// Netlify Function Handler
exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  try {
    const body = JSON.parse(event.body || '{}');
    const tickers = body.tickers || [];
    
    if (!tickers.length) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No tickers provided' })
      };
    }
    
    // Analyze all stocks
    const results = [];
    for (const ticker of tickers) {
      const result = await analyzeStock(ticker);
      results.push(result);
    }
    
    // Sort by score
    results.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ results })
    };
    
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message })
    };
  }
};
