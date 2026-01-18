# Trading Bot Setup Guide

## Prerequisites

Before setting up the Trading Bot, ensure you have the following:

### System Requirements
- **Node.js**: Version 18.0 or higher
- **npm**: Version 8.0 or higher (comes with Node.js)
- **Operating System**: Windows 10/11, macOS 10.15+, or Linux
- **RAM**: Minimum 4GB, recommended 8GB+
- **Storage**: 500MB free space
- **Internet**: Stable broadband connection

### Required Accounts
1. **Telegram Bot Token** - From BotFather
2. **IQ Option Account** - Trading account credentials
3. **TradingView Account** (optional) - For enhanced data

## Quick Start Setup

### 1. Clone or Download
```bash
git clone https://github.com/yourusername/telegram-trading-bot.git
cd telegram-trading-bot
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Copy the `.env` file and fill in your credentials:
```bash
cp .env.example .env
```

Edit `.env` with your actual credentials:
```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_ADMIN_ID=your_telegram_user_id_here

# IQ Option Credentials
IQ_OPTION_EMAIL=your_iq_option_email@example.com
IQ_OPTION_PASSWORD=your_iq_option_password
IQ_OPTION_ACCOUNT_TYPE=REAL

# TradingView API (Optional)
TRADINGVIEW_API_KEY=your_tradingview_api_key_here
```

### 4. Initialize Database
```bash
npm run setup
```

### 5. Start the Bot
```bash
npm start
```

### 6. Test the Bot
1. Open Telegram
2. Search for your bot: `@YourBotName`
3. Send `/start` command
4. Try `/analyze AAPL` to test analysis

## Detailed Setup Instructions

### Step 1: Telegram Bot Creation

1. **Contact BotFather**
   - Open Telegram
   - Search for `@BotFather`
   - Send `/newbot` command

2. **Create Your Bot**
   ```
   BotFather: Alright, a new bot. How are we going to call it? Please choose a name for your bot.
   You: My Trading Bot

   BotFather: Good. Now let's choose a username for your bot. It must end in `bot`. Like this, for example: TetrisBot or tetris_bot.
   You: MyTradingBot

   BotFather: Done! Congratulations on your new bot. You will find it at t.me/MyTradingBot. You can now add a description, about section and profile picture for your bot, as well as a botpic, commands and a link to your bot for your website.

   Use this token to access the HTTP API:
   123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11

   For a description of the Bot API, see this page: https://core.telegram.org/bots/api
   ```

3. **Configure Bot Settings**
   - Send `/setdescription` to BotFather
   - Send `/setcommands` to set command list
   - Send `/setprivacy` to disable privacy mode

4. **Get Your User ID**
   - Message `@userinfobot` to get your Telegram user ID
   - This ID goes into `TELEGRAM_ADMIN_ID` in `.env`

### Step 2: IQ Option Account Setup

1. **Create IQ Option Account**
   - Visit [iqoption.com](https://iqoption.com)
   - Sign up for a trading account
   - Verify your email and phone number
   - Complete identity verification for real trading

2. **Configure Account**
   - Set your preferred currency (USD recommended)
   - Enable Binary Options trading
   - Set up withdrawal methods
   - Note your login credentials

3. **Security Settings**
   - Enable two-factor authentication
   - Set strong password
   - Configure withdrawal limits

### Step 3: Environment Configuration

#### Required Environment Variables
```env
# Essential Settings
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_ADMIN_ID=your_telegram_user_id
IQ_OPTION_EMAIL=your_iqoption_email@example.com
IQ_OPTION_PASSWORD=your_iqoption_password
DATABASE_PATH=./database/trading.db

# Optional Settings
TRADINGVIEW_API_KEY=your_tradingview_api_key
NODE_ENV=development
LOG_LEVEL=info
TIMEZONE=America/New_York
```

#### Environment Variable Explanations
- `TELEGRAM_BOT_TOKEN`: Token from BotFather (starts with numbers)
- `TELEGRAM_ADMIN_ID`: Your Telegram user ID (numbers only)
- `IQ_OPTION_EMAIL`: Your IQ Option login email
- `IQ_OPTION_PASSWORD`: Your IQ Option password
- `DATABASE_PATH`: SQLite database file location
- `TRADINGVIEW_API_KEY`: API key for enhanced market data
- `NODE_ENV`: `development` or `production`
- `LOG_LEVEL`: `error`, `warn`, `info`, `debug`

### Step 4: Database Setup

#### Automatic Setup
```bash
npm run setup
```

This command will:
- Create the SQLite database file
- Run database migrations
- Create initial tables and indexes
- Populate default configuration data

#### Manual Setup (Alternative)
```bash
npm run migrate
```

#### Verify Database
Check that `database/trading.db` file was created and has content.

### Step 5: Testing the Setup

#### 1. Start the Bot
```bash
npm start
```

You should see:
```
🚀 Starting Trading Bot Application...
✅ Database initialized successfully
✅ Telegram bot initialized successfully
🎯 Trading Bot is now running and ready to accept commands!
```

#### 2. Test Basic Commands
1. Open Telegram and find your bot
2. Send `/start` - Should show welcome menu
3. Send `/help` - Should show help information
4. Send `/status` - Should show system status

#### 3. Test Trading Functions
1. Send `/analyze AAPL` - Should analyze Apple stock
2. Send `/balance` - Should show account balance
3. Send `/stats` - Should show trading statistics

## Docker Setup (Alternative)

### Using Docker Compose
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f trading-bot

# Stop services
docker-compose down
```

### Using Docker Only
```bash
# Build the image
docker build -t trading-bot .

# Run the container
docker run -d \
  --name trading-bot \
  -e TELEGRAM_BOT_TOKEN=your_token \
  -e TELEGRAM_ADMIN_ID=your_id \
  -e IQ_OPTION_EMAIL=your_email \
  -e IQ_OPTION_PASSWORD=your_password \
  -v $(pwd)/database:/app/database \
  -v $(pwd)/logs:/app/logs \
  trading-bot
```

## Advanced Configuration

### Custom Risk Settings
Edit `config/settings.json` to customize:
```json
{
  "risk": {
    "maxDailyLoss": 50,
    "maxTradeAmount": 20,
    "maxConsecutiveLosses": 3,
    "dailyTradeLimit": 20,
    "positionSizePercent": 5
  }
}
```

### Notification Settings
Configure notifications in `config/telegram.json`:
```json
{
  "notifications": {
    "tradeConfirmations": true,
    "winLossAlerts": true,
    "dailySummary": true,
    "signalAlerts": false,
    "riskAlerts": true
  }
}
```

### Asset Configuration
Add or modify supported assets in `config/assets.json`:
```json
{
  "stocks": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "exchange": "NASDAQ"
    }
  ]
}
```

## Troubleshooting

### Common Setup Issues

#### 1. "Bot token is invalid"
- Double-check token from BotFather
- Ensure no extra spaces or characters
- Token should look like: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`

#### 2. "Cannot connect to IQ Option"
- Verify email and password are correct
- Check if IQ Option account is verified
- Ensure account is not suspended
- Try logging in manually on iqoption.com

#### 3. "Database connection failed"
- Ensure database directory exists and is writable
- Check file permissions
- Try deleting `database/trading.db` and running setup again

#### 4. "Module not found" errors
- Run `npm install` again
- Check Node.js version (must be 18+)
- Clear npm cache: `npm cache clean --force`

#### 5. "Bot not responding"
- Check if bot process is running
- Verify Telegram token is correct
- Check bot logs in `logs/bot.log`
- Ensure bot is not blocked by Telegram

### Log File Locations
- **Bot logs**: `logs/bot.log`
- **Error logs**: `logs/errors.log`
- **Trade logs**: `logs/trades.log`
- **Performance logs**: `logs/performance.log`

### Health Check Commands
```bash
# Check if bot is running
curl http://localhost:3000/health

# Check database connection
npm run migrate

# Test Telegram connection
# Send /status to your bot
```

## Production Deployment

### Server Requirements
- **CPU**: 2+ cores recommended
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 20GB+ for logs and database
- **Network**: Stable internet connection

### Process Management
```bash
# Using PM2 (recommended for production)
npm install -g pm2
pm2 start src/app.js --name "trading-bot"
pm2 save
pm2 startup

# View logs
pm2 logs trading-bot

# Restart bot
pm2 restart trading-bot
```

### Security Considerations
1. **Use environment variables** - Never hardcode credentials
2. **Enable HTTPS** - Use SSL certificates for webhooks
3. **Firewall configuration** - Restrict unnecessary ports
4. **Regular backups** - Backup database and configuration
5. **Log rotation** - Prevent log files from filling disk
6. **Access controls** - Limit admin access

### Monitoring Setup
```bash
# Install monitoring stack
docker-compose --profile monitoring up -d

# Access Grafana at http://localhost:3001
# Default credentials: admin/admin
```

## Update Procedures

### Minor Updates
```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Restart bot
pm2 restart trading-bot
```

### Major Updates
```bash
# Backup database
cp database/trading.db database/backup_$(date +%Y%m%d_%H%M%S).db

# Update code
git pull origin main
npm install

# Run migrations if needed
npm run migrate

# Restart bot
pm2 restart trading-bot
```

## Support and Resources

### Documentation
- [API Documentation](./API.md)
- [Commands Reference](./COMMANDS.md)
- [Strategies Guide](./STRATEGIES.md)

### Community Support
- **GitHub Issues**: Report bugs and request features
- **Telegram Support**: Contact bot developer
- **Community Forum**: Join discussions and share experiences

### Professional Support
- **Priority Support**: For urgent issues
- **Custom Development**: Tailored modifications
- **Training Services**: Bot usage and strategy training

---

## Quick Reference

### Essential Commands
```bash
# Setup
npm install
npm run setup
npm start

# Testing
npm test

# Docker
docker-compose up -d
docker-compose logs -f

# PM2 (Production)
pm2 start src/app.js
pm2 logs trading-bot
```

### Important Files
- `.env` - Environment configuration
- `config/settings.json` - Bot settings
- `database/trading.db` - SQLite database
- `logs/` - Application logs

### Key URLs
- **BotFather**: https://t.me/botfather
- **IQ Option**: https://iqoption.com
- **TradingView**: https://tradingview.com
- **Bot API Docs**: https://core.telegram.org/bots/api

---

**🎉 Setup Complete! Your Trading Bot is ready to analyze markets and execute trades automatically.**