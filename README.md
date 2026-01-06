# Valuation Playbook - Netlify Deployment

Stock valuation app using Netlify Functions (serverless) + Yahoo Finance.

## 📁 Project Structure

```
valuation-netlify/
├── index.html              # Frontend UI
├── netlify.toml            # Netlify configuration
├── package.json            # Node.js config
└── netlify/
    └── functions/
        └── analyze.js      # Serverless function (backend)
```

## 🚀 Deploy to Netlify (3 Steps)

### Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repo (e.g., `valuation-playbook`)
3. **Upload ALL files** from this folder to the repo:
   - `index.html`
   - `netlify.toml`
   - `package.json`
   - `netlify/functions/analyze.js`

### Step 2: Connect to Netlify

1. Go to https://app.netlify.com
2. Sign up / Log in (use GitHub for easiest setup)
3. Click **"Add new site"** → **"Import an existing project"**
4. Choose **GitHub**
5. Select your `valuation-playbook` repository
6. Leave default settings (Netlify auto-detects config)
7. Click **"Deploy site"**

### Step 3: Done! 🎉

- Wait 1-2 minutes for deployment
- Your site will be live at: `https://random-name.netlify.app`
- Click **"Site settings"** → **"Change site name"** to customize URL

---

## 🧪 Test Locally (Optional)

### Install Netlify CLI
```bash
npm install -g netlify-cli
```

### Run Locally
```bash
cd valuation-netlify
netlify dev
```

Open: http://localhost:8888

---

## 📊 Features

- **20+ Valuation Metrics**: Revenue, Market Cap, PEG, CAGR, PE, ROE, ROIC, etc.
- **Automatic Ratings**: 0-5 scale based on thresholds
- **Weighted Score**: Scale 15%, Growth 15%, Value 25%, Quality 25%, Risk 10%, Balance 10%
- **Indian Stocks**: Auto-appends .NS for NSE tickers
- **Serverless**: No server to maintain, scales automatically
- **Free Tier**: Netlify's free tier includes 125K function invocations/month

---

## ⚠️ Notes

- **First request may be slow** (cold start ~2-3 seconds)
- **Multiple stocks take longer** (sequential API calls)
- **Yahoo Finance rate limits**: Don't analyze too many stocks at once (5-10 is fine)

---

## 🔧 Customization

### Change Rating Thresholds
Edit `netlify/functions/analyze.js` - look for the `ratings` object at the top.

### Change Weights
Edit `netlify/functions/analyze.js` - look for:
```javascript
const weights = { scale: 0.15, growth: 0.15, value: 0.25, quality: 0.25, risk: 0.10, balance: 0.10 };
```

### Change UI
Edit `index.html` - it's a single file with all HTML/CSS/JS.

---

## 🐛 Troubleshooting

### "Function timeout" error
- Netlify Functions have a 10-second timeout on free tier
- Try analyzing fewer stocks at once

### "No data found" error
- Check if ticker symbol is correct
- Some small companies may not have data on Yahoo Finance

### Changes not showing
- Make sure you pushed changes to GitHub
- Netlify auto-deploys on every push
- Check Netlify dashboard for deploy status
