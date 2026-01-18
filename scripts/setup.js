#!/usr/bin/env node

/**
 * Trading Bot Setup Script
 * Initializes the database and performs initial configuration
 */

const fs = require('fs-extra');
const path = require('path');
const { Sequelize } = require('sequelize');
const readline = require('readline');

const Logger = require('../src/utils/Logger');

class SetupScript {
  constructor() {
    this.logger = Logger.getInstance();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Run the setup process
   */
  async run() {
    try {
      console.log('🤖 Trading Bot Setup Script');
      console.log('===========================\n');

      // Check if .env exists
      await this.checkEnvironment();

      // Setup database
      await this.setupDatabase();

      // Validate configuration
      await this.validateConfiguration();

      // Create initial data
      await this.createInitialData();

      console.log('\n✅ Setup completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Edit .env file with your credentials');
      console.log('2. Run: npm start');
      console.log('3. Message your bot on Telegram');

    } catch (error) {
      console.error('\n❌ Setup failed:', error.message);
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }

  /**
   * Check and create .env file
   */
  async checkEnvironment() {
    const envPath = path.join(__dirname, '../.env');

    if (await fs.pathExists(envPath)) {
      console.log('✅ .env file exists');
      return;
    }

    console.log('📝 Creating .env file...');

    const envTemplate = `# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_ADMIN_ID=your_telegram_user_id_here

# Database Configuration
DATABASE_PATH=./database/trading.db

# IQ Option Credentials
IQ_OPTION_EMAIL=your_iq_option_email@example.com
IQ_OPTION_PASSWORD=your_iq_option_password
IQ_OPTION_ACCOUNT_TYPE=REAL

# Application Settings
NODE_ENV=development
LOG_LEVEL=info
TIMEZONE=America/New_York
CURRENCY=USD

# API Configuration
API_TIMEOUT=30000
MAX_RETRIES=3
`;

    await fs.writeFile(envPath, envTemplate);
    console.log('✅ .env file created. Please edit it with your credentials.');
  }

  /**
   * Setup database
   */
  async setupDatabase() {
    console.log('🗄️ Setting up database...');

    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../database/trading.db');
    await fs.ensureDir(path.dirname(dbPath));

    // Initialize Sequelize
    const sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: dbPath,
      logging: false
    });

    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Load models
    const models = require('../src/database/models');
    const User = models.User.init(sequelize);
    const Trade = models.Trade.init(sequelize);
    const Signal = models.Signal.init(sequelize);
    const Settings = models.Settings.init(sequelize);
    const Performance = models.Performance.init(sequelize);

    // Setup associations
    User.hasMany(Trade, { foreignKey: 'user_id', as: 'trades' });
    User.hasMany(Signal, { foreignKey: 'user_id', as: 'signals' });
    User.hasOne(Settings, { foreignKey: 'user_id', as: 'settings' });
    User.hasMany(Performance, { foreignKey: 'user_id', as: 'performance' });

    Trade.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
    Trade.belongsTo(Signal, { foreignKey: 'signal_id', as: 'signal' });

    Signal.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
    Signal.hasMany(Trade, { foreignKey: 'signal_id', as: 'trades' });

    Settings.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
    Performance.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

    // Sync database
    await sequelize.sync({ force: false });
    console.log('✅ Database tables created');

    await sequelize.close();
  }

  /**
   * Validate configuration
   */
  async validateConfiguration() {
    console.log('🔍 Validating configuration...');

    const requiredVars = [
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_ADMIN_ID',
      'DATABASE_PATH'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
      console.log('⚠️  Missing required environment variables:');
      missing.forEach(varName => console.log(`   - ${varName}`));
      console.log('   Please edit your .env file');
    } else {
      console.log('✅ Configuration validated');
    }
  }

  /**
   * Create initial data
   */
  async createInitialData() {
    console.log('📊 Creating initial data...');

    // Ensure directories exist
    await fs.ensureDir(path.join(__dirname, '../logs'));
    await fs.ensureDir(path.join(__dirname, '../database'));
    await fs.ensureDir(path.join(__dirname, '../screenshots'));

    console.log('✅ Initial data created');
  }

  /**
   * Ask user for input
   */
  ask(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }
}

// Run setup if called directly
if (require.main === module) {
  // Load environment variables
  require('dotenv').config();

  const setup = new SetupScript();
  setup.run().catch(console.error);
}

module.exports = SetupScript;