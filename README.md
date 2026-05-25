# FoodRx 🥦

**Personalized grocery plans powered by real CDC + USDA open data.**

> "A 42-year-old in Memphis should eat differently than a 42-year-old in Boulder — because the chronic disease profiles of those cities are dramatically different."

---

## What this app does

1. Takes a US ZIP code
2. Queries **CDC PLACES 2024 API** for real BRFSS-based chronic disease prevalence (diabetes, hypertension, obesity, heart disease) at the ZIP Code Tabulation Area level
3. Resolves county name via **US Census Geocoder API**
4. Calls **Claude (Anthropic)** to generate a personalized 7-day meal plan using ADA/AHA/NCI dietary guidelines, priced with USDA ERS data
5. Shows an itemized grocery list with one-click Instacart/Kroger ordering

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Styling | CSS-in-JS (inline styles) |
| AI | Claude claude-sonnet-4-5 via Anthropic SDK |
| Disease data | CDC PLACES 2024 (data.cdc.gov, Socrata API) |
| Geography | US Census Geocoder API |
| Grocery prices | USDA ERS (hardcoded 2023 averages) |
| Deployment | Vercel (recommended) |

---

## Local development

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/foodrx.git
cd foodrx
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and add:

```
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE
CDC_APP_TOKEN=YOUR_CDC_TOKEN_HERE   # optional but recommended
```

**Get your Anthropic API key:**
- Go to https://console.anthropic.com
- Create an account → API Keys → Create Key
- Copy the key (starts with `sk-ant-`)

**Get a free CDC Socrata App Token (optional but improves rate limits):**
- Go to https://data.cdc.gov/profile/app_tokens
- Sign up for a free account → Create New App Token
- Paste the token in `.env.local`

### 3. Run locally

```bash
npm run dev
```

Open http://localhost:3000 — the app is running.

**Test with these ZIPs to see dramatic risk differences:**
- `38103` — Memphis, TN (high diabetes + hypertension)
- `80302` — Boulder, CO (below national average)
- `33101` — Miami, FL (elevated across multiple indicators)
- `10001` — New York, NY (mixed profile)

---

## Deployment to Vercel (recommended — free tier works)

### Step 1: Push to GitHub

```bash
# Initialize git if you haven't already
git init
git add .
git commit -m "Initial FoodRx commit"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/foodrx.git
git push -u origin main
```

### Step 2: Deploy on Vercel

1. Go to **https://vercel.com** → Sign up / Log in with GitHub
2. Click **"Add New Project"**
3. Import your `foodrx` GitHub repository
4. Vercel auto-detects Next.js — click **"Deploy"** without changing any settings

### Step 3: Add environment variables in Vercel

This is the critical step — your API keys must be added here:

1. In your Vercel project dashboard → **Settings** → **Environment Variables**
2. Add these variables:

| Name | Value | Environment |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Production, Preview, Development |
| `CDC_APP_TOKEN` | your token | Production, Preview, Development |

3. Click **Save** after adding each variable
4. Go to **Deployments** → click the three dots on your latest deployment → **Redeploy**

### Step 4: Your app is live!

Vercel gives you a URL like `https://foodrx-abc123.vercel.app`

To add a custom domain:
- Vercel dashboard → Settings → Domains → Add your domain
- Update your domain's DNS with the records Vercel shows you

---

## Alternative: Deploy to Railway

If you prefer Railway (also free tier):

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project and deploy
railway init
railway up
```

Then add environment variables in the Railway dashboard under Variables.

---

## Alternative: Deploy to Render

1. Go to https://render.com → New → Web Service
2. Connect your GitHub repo
3. Settings:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
4. Add environment variables in the Render dashboard

---

## Project structure

```
foodrx/
├── pages/
│   ├── _app.js          # Global CSS wrapper
│   ├── _document.js     # HTML head / meta tags
│   ├── index.js         # Main UI (landing → onboarding → risk → plan)
│   └── api/
│       ├── risk.js      # GET /api/risk?zip=XXXXX
│       │                # Calls CDC PLACES + Census Geocoder
│       └── plan.js      # POST /api/plan
│                        # Calls Anthropic Claude — API key stays server-side
├── styles/
│   └── globals.css      # Base styles + animations
├── public/              # Static assets
├── .env.local.example   # Environment variable template
├── next.config.js       # Next.js config
├── package.json
└── README.md
```

---

## API routes

### `GET /api/risk?zip=33101`

Returns real CDC health data for a ZIP code:

```json
{
  "zip": "33101",
  "city": "Miami-Dade, FL",
  "metrics": {
    "diabetes": 12.4,
    "hypertension": 38.1,
    "obesity": 35.2,
    "heartDisease": 6.1
  },
  "national": {
    "diabetes": 9.3,
    "hypertension": 32.0,
    "obesity": 33.9,
    "heartDisease": 5.5
  },
  "elevated": ["diabetes", "hypertension"],
  "hasRealData": true,
  "dataSource": "CDC PLACES 2024 (BRFSS model estimates, ZCTA level)"
}
```

### `POST /api/plan`

Body: `{ form: { age, budget, conditions, restrictions }, risk: { ... } }`

Returns a 7-day meal plan with grocery list as JSON.

---

## Data sources

| Dataset | URL | Used for |
|---|---|---|
| CDC PLACES 2024 | https://data.cdc.gov/resource/qnzd-25i4.json | ZIP-level disease prevalence |
| US Census Geocoder | https://geocoding.geo.census.gov | ZIP → county name |
| USDA ERS Prices | https://www.ers.usda.gov/data-products/fruit-and-vegetable-prices | Cost-per-serving estimates |
| Anthropic Claude | https://api.anthropic.com | Meal plan generation |

---

## Important notes

- **CDC PLACES** data covers ~32,000 ZCTAs across all 50 states + DC. Very rare ZIPs may fall back to national averages.
- PLACES estimates are model-based (BRFSS survey + Census data). They are population-level estimates, not individual diagnoses.
- This app is for informational purposes. It is not a substitute for medical advice.

---

## License

MIT
