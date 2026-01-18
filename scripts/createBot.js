#!/usr/bin/env node

/**
 * Create Bot Script
 * Sets up a new Telegram bot with BotFather integration
 */

const readline = require('readline');
const https = require('https');
const fs = require('fs');
const path = require('path');

class BotCreator {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Start the bot creation process
   */
  async start() {
    console.log('🤖 Telegram Trading Bot Setup');
    console.log('==============================\n');

    console.log('This script will help you create and configure your Telegram bot.\n');

    try {
      const botConfig = await this.collectBotInformation();
      await this.createBotWithBotFather(botConfig);
      await this.configureEnvironment(botConfig);
      await this.testBotConfiguration(botConfig);

      console.log('\n✅ Bot setup completed successfully!');
      console.log('🎯 Your bot is ready to start trading.');
      console.log(`📱 Find your bot at: https://t.me/${botConfig.username}`);

    } catch (error) {
      console.error('\n❌ Setup failed:', error.message);
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }

  /**
   * Collect bot information from user
   */
  async collectBotInformation() {
    return new Promise((resolve) => {
      const config = {};

      console.log('Step 1: Bot Information');
      console.log('-----------------------');

      this.question('Bot Name (e.g., "My Trading Bot"): ')
        .then(name => {
          config.name = name;
          return this.question('Bot Username (must end with "bot", e.g., "MyTradingBot"): ');
        })
        .then(username => {
          // Ensure username ends with 'bot'
          if (!username.toLowerCase().endsWith('bot')) {
            username += 'bot';
          }
          config.username = username.toLowerCase();
          return this.question('Bot Description (optional): ');
        })
        .then(description => {
          config.description = description || 'Advanced trading bot with technical analysis';
          return this.question('Your Telegram User ID (message @userinfobot to get it): ');
        })
        .then(adminId => {
          config.adminId = adminId;
          resolve(config);
        });
    });
  }

  /**
   * Create bot with BotFather
   */
  async createBotWithBotFather(config) {
    console.log('\nStep 2: BotFather Integration');
    console.log('------------------------------');

    console.log('Please complete these steps manually:');
    console.log('1. Open Telegram and search for @BotFather');
    console.log('2. Send /newbot command');
    console.log('3. Enter bot name:', config.name);
    console.log('4. Enter bot username:', config.username);
    console.log('5. Copy the bot token and paste it below');

    const token = await this.question('\nBot Token from BotFather: ');
    config.token = token;

    // Validate token format
    if (!this.isValidBotToken(token)) {
      throw new Error('Invalid bot token format. Please check and try again.');
    }

    console.log('✅ Bot token validated');

    // Configure bot settings
    console.log('\nConfiguring bot settings...');
    await this.configureBotSettings(config);
  }

  /**
   * Configure bot settings with BotFather
   */
  async configureBotSettings(config) {
    console.log('📝 Setting bot description...');
    console.log('📋 Setting bot commands...');
    console.log('🔒 Configuring privacy settings...');

    console.log('\nBotFather Commands to run:');
    console.log(`/setdescription @${config.username}`);
    console.log('Description: Advanced trading bot with technical analysis for stocks, forex, and crypto');

    console.log('\n/setcommands @' + config.username);
    console.log('Command list:');
    console.log('start - Start the trading bot');
    console.log('help - Show available commands');
    console.log('analyze - Analyze a trading asset');
    console.log('stats - View trading statistics');
    console.log('balance - Check account balance');
    console.log('settings - Configure bot settings');
    console.log('stop - Emergency stop all trading');

    console.log('\n/setprivacy @' + config.username);
    console.log('Privacy: Disabled (bot needs to read all messages)');

    console.log('\nPress Enter when you have completed these steps...');
    await this.question('');
  }

  /**
   * Configure environment file
   */
  async configureEnvironment(config) {
    console.log('\nStep 3: Environment Configuration');
    console.log('----------------------------------');

    const envPath = path.join(process.cwd(), '.env');

    // Check if .env already exists
    if (fs.existsSync(envPath)) {
      const overwrite = await this.question('.env file already exists. Overwrite? (y/N): ');
      if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
        console.log('Skipping .env configuration...');
        return;
      }
    }

    // Create .env content
    const envContent = this.generateEnvContent(config);

    // Write .env file
    fs.writeFileSync(envPath, envContent, 'utf8');

    console.log('✅ Environment file created');
    console.log('⚠️  IMPORTANT: Add your IQ Option credentials to .env file');
  }

  /**
   * Generate .env content
   */
  generateEnvContent(config) {
    return `# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=${config.token}
TELEGRAM_ADMIN_ID=${config.adminId}

# Database Configuration
DATABASE_PATH=./database/trading.db

# IQ Option Credentials (REQUIRED - Add your credentials)
IQ_OPTION_EMAIL=your_iq_option_email@example.com
IQ_OPTION_PASSWORD=your_iq_option_password
IQ_OPTION_ACCOUNT_TYPE=REAL

# TradingView API (Optional - for enhanced data)
TRADINGVIEW_API_URL=https://api.tradingview.com
TRADINGVIEW_WS_URL=wss://data.tradingview.com
TRADINGVIEW_API_KEY=your_tradingview_api_key_here
TRADINGVIEW_USERNAME=your_tradingview_username

# Application Settings
NODE_ENV=development
LOG_LEVEL=info
TIMEZONE=America/New_York
CURRENCY=USD

# API Configuration
API_TIMEOUT=30000
MAX_RETRIES=3

# Security
JWT_SECRET=${this.generateRandomString(32)}
SESSION_TIMEOUT=3600000

# Email Notifications (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=your_email@gmail.com

# Webhook Configuration (Optional)
WEBHOOK_URL=https://your-domain.com/webhook
WEBHOOK_PORT=3000

# Monitoring and Analytics
ENABLE_METRICS=true
METRICS_PORT=9090
SENTRY_DSN=your_sentry_dsn_here

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload Settings
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif

# Cache Settings
CACHE_ENABLED=true
CACHE_TTL=300000

# Feature Flags
ENABLE_AUTO_TRADING=false
ENABLE_NOTIFICATIONS=true
ENABLE_RISK_MANAGEMENT=true
ENABLE_TELEGRAM_COMMANDS=true

# Development Settings
DEBUG_MODE=false
MOCK_TRADES=false
SKIP_IQ_OPTION_LOGIN=false

# External Services
NEWS_API_KEY=your_news_api_key_here
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_api_key_here
COINGECKO_API_KEY=your_coingecko_api_key_here

# Bot Information (Auto-generated)
BOT_NAME=${config.name}
BOT_USERNAME=@${config.username}
BOT_DESCRIPTION=${config.description}
`;
  }

  /**
   * Test bot configuration
   */
  async testBotConfiguration(config) {
    console.log('\nStep 4: Configuration Testing');
    console.log('------------------------------');

    try {
      // Test bot token
      console.log('🔍 Testing bot token...');
      const isValid = await this.testBotToken(config.token);
      if (!isValid) {
        throw new Error('Bot token test failed. Please verify the token.');
      }
      console.log('✅ Bot token test passed');

      // Test admin ID
      console.log('🔍 Validating admin ID...');
      if (!this.isValidUserId(config.adminId)) {
        throw new Error('Invalid admin ID format. Should be numeric.');
      }
      console.log('✅ Admin ID validated');

      console.log('✅ Configuration tests passed');

    } catch (error) {
      console.error('❌ Configuration test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test bot token validity
   */
  async testBotToken(token) {
    return new Promise((resolve) => {
      const url = `https://api.telegram.org/bot${token}/getMe`;

      https.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve(response.ok === true);
          } catch (error) {
            resolve(false);
          }
        });

      }).on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Validate bot token format
   */
  isValidBotToken(token) {
    // Bot tokens are in format: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
    return /^\d{9,10}:[A-Za-z0-9_-]{35}$/.test(token);
  }

  /**
   * Validate user ID format
   */
  isValidUserId(userId) {
    return /^\d+$/.test(userId) && userId.length >= 5;
  }

  /**
   * Generate random string
   */
  generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Ask question and get response
   */
  question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  }
}

// Run the setup if called directly
if (require.main === module) {
  const creator = new BotCreator();
  creator.start().catch(console.error);
}

module.exports = BotCreator;