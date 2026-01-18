# 🔧 Environment Configuration Guide

## How to Set Up Your .env File

### Step 1: Create the .env file
```bash
# Copy the example file
cp .env.example .env
# Or create manually:
touch .env
```

### Step 2: Configure Each Section

## 📋 REQUIRED SETTINGS

### 1. Telegram Bot Token
```
# Go to Telegram and search for @BotFather
# Send: /newbot
# Follow instructions to create your bot
# BotFather will give you a token like:
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789
```

### 2. Your Telegram Admin ID
```
# Go to Telegram and search for @userinfobot
# Send any message
# Bot replies with your ID:
TELEGRAM_ADMIN_ID=987654321
```

### 3. IQ Option Account
```
# Your IQ Option login credentials
IQ_OPTION_EMAIL=your_email@example.com
IQ_OPTION_PASSWORD=your_password
IQ_OPTION_ACCOUNT_TYPE=REAL
```

## 📊 PROFESSIONAL DATA SOURCES (RECOMMENDED)

### Option 1: Finnhub API (Best - All Markets)
**Covers: Stocks, Crypto, Forex** | **Free tier: 60 calls/min**

1. **Sign up for free API key:**
   - Visit: https://finnhub.io/register
   - Confirm your email
   - Get your free API key from dashboard

2. **Add to .env:**
```env
FINNHUB_API_KEY=your_finnhub_api_key_here
```

**Benefits:**
- ✅ Covers ALL markets (stocks, crypto, forex)
- ✅ Real-time + historical data
- ✅ 60 calls/min free (excellent for trading bots)
- ✅ Professional-grade data quality

### Option 2: Alpha Vantage API (Best for Forex)
**Covers: Forex, Stocks** | **Free tier: 5 calls/min, 500/day**

1. **Sign up for free API key:**
   - Visit: https://www.alphavantage.co/support/#api-key
   - Enter email, get instant API key

2. **Add to .env:**
```env
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_api_key_here
```

**Benefits:**
- ✅ Excellent forex historical data
- ✅ Stock market data
- ✅ 5 calls/min, 500 calls/day (good for forex)

### Option 3: Free APIs (No API Key Needed)
**Default fallback:** Yahoo Finance (stocks), Binance (crypto), ExchangeRate-API (forex)

No configuration needed - works out of the box!

---

## 📊 TRADINGVIEW CONNECTION GUIDE (Optional - Paid)

### Option 1: FREE TradingView Data (Recommended)

TradingView provides free market data through their public API. No registration needed!

```env
# FREE TradingView Configuration
TRADINGVIEW_API_URL=https://api.tradingview.com
TRADINGVIEW_WS_URL=wss://data.tradingview.com
TRADINGVIEW_API_KEY=
TRADINGVIEW_USERNAME=
```

**Benefits:**
- ✅ Free to use
- ✅ Real-time data for major assets
- ✅ No API limits for basic usage
- ✅ Works immediately

### Option 2: Premium TradingView API

For advanced users with premium TradingView accounts:

1. **Go to TradingView Account Settings**
   - Visit: https://www.tradingview.com/accounts/
   - Login to your premium account

2. **Generate API Key**
   - Go to "API Keys" section
   - Create a new API key
   - Copy the key and username

3. **Configure in .env**
```env
TRADINGVIEW_API_KEY=your_actual_api_key_from_tradingview
TRADINGVIEW_USERNAME=your_tradingview_username
TRADINGVIEW_API_URL=https://api.tradingview.com
TRADINGVIEW_WS_URL=wss://data.tradingview.com
```

**Benefits:**
- ✅ Higher API rate limits
- ✅ Access to premium data feeds
- ✅ Advanced market data

## 🔐 SECURITY SETTINGS

### Generate Secure JWT Secret
```bash
# Run this command to generate a secure secret:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then use the output:
```env
JWT_SECRET=your_generated_32_character_hex_string_here
```

## 📧 EMAIL NOTIFICATIONS (Optional)

For email alerts (win/loss notifications):

```env
# Gmail example
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
EMAIL_FROM=your_email@gmail.com
```

**For Gmail:**
1. Enable 2FA on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the app password (not your regular password)

## ⚙️ COMPLETE .env FILE EXAMPLE

```env
# ===========================================
# TELEGRAM TRADING BOT - ENVIRONMENT CONFIG
# ===========================================

# ESSENTIAL SETTINGS (REQUIRED)
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789
TELEGRAM_ADMIN_ID=987654321
DATABASE_PATH=./database/trading.db
IQ_OPTION_EMAIL=your_email@example.com
IQ_OPTION_PASSWORD=your_password
IQ_OPTION_ACCOUNT_TYPE=REAL

# PROFESSIONAL DATA SOURCES (RECOMMENDED - FREE TIERS AVAILABLE)
# Finnhub: https://finnhub.io/register (60 calls/min free - ALL markets)
FINNHUB_API_KEY=

# Alpha Vantage: https://www.alphavantage.co/support/#api-key (5 calls/min, 500/day free - Forex best)
ALPHA_VANTAGE_API_KEY=

# TRADINGVIEW CONFIGURATION (Optional - Paid service)
TRADINGVIEW_API_URL=https://api.tradingview.com
TRADINGVIEW_WS_URL=wss://data.tradingview.com
TRADINGVIEW_API_KEY=
TRADINGVIEW_USERNAME=

# APPLICATION SETTINGS
NODE_ENV=development
LOG_LEVEL=info
TIMEZONE=America/New_York
CURRENCY=USD

# SECURITY
JWT_SECRET=1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f

# OPTIONAL FEATURES (leave empty if not using)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
WEBHOOK_URL=
WEBHOOK_PORT=3000
SENTRY_DSN=
NEWS_API_KEY=
COINGECKO_API_KEY=

# FEATURE FLAGS
ENABLE_AUTO_TRADING=false
ENABLE_NOTIFICATIONS=true
ENABLE_RISK_MANAGEMENT=true
ENABLE_TELEGRAM_COMMANDS=true

# DEVELOPMENT
DEBUG_MODE=false
MOCK_TRADES=false
SKIP_IQ_OPTION_LOGIN=false
```

## 🧪 TESTING YOUR CONFIGURATION

### Test Telegram Bot Connection
```bash
# Start the bot
npm start

# In Telegram, message your bot: /start
# You should receive a welcome message
```

### Test TradingView Connection
```bash
# Test market data
npm run test-tradingview

# Or manually test
curl "https://api.tradingview.com/api/v1/some_endpoint"
```

### Validate .env File
```bash
# Check for syntax errors
node -e "require('dotenv').config(); console.log('✅ .env loaded successfully')"

# Check required variables
node -e "require('dotenv').config(); console.log('Token:', process.env.TELEGRAM_BOT_TOKEN ? 'Set' : 'Missing')"
```

## 🔧 TROUBLESHOOTING

### "Bot token is invalid"
- Double-check token from BotFather
- Ensure no spaces or extra characters
- Token format: `numbers:letters_and_numbers`

### "Admin ID not working"
- Make sure you messaged @userinfobot
- Use the numeric ID, not username
- Check for leading/trailing spaces

### "TradingView connection failed"
- Verify URLs are correct
- Check internet connection
- Try with empty API key first (free option)

### "Environment variables not loading"
- Ensure .env file is in project root
- Check file permissions
- No spaces around `=` signs
- Restart the application

## 🚀 QUICK START CHECKLIST

- [ ] Create .env file from this guide
- [ ] Get Telegram bot token from @BotFather
- [ ] Get your Telegram user ID from @userinfobot
- [ ] Create IQ Option account (if not already)
- [ ] Configure TradingView (free option works)
- [ ] Run `npm install`
- [ ] Run `npm run setup`
- [ ] Run `npm start`
- [ ] Test with `/start` command in Telegram

## 📞 SUPPORT

If you need help:
1. Check the logs in `logs/bot.log`
2. Verify all required fields are filled
3. Test each component individually
4. Check the troubleshooting section above

For TradingView issues, visit: https://www.tradingview.com/support/