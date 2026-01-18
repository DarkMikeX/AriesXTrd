#!/usr/bin/env node

/**
 * Database Migration Script
 * Creates and migrates the SQLite database schema
 */

const path = require('path');
const fs = require('fs-extra');
const { Sequelize } = require('sequelize');

class DatabaseMigrator {
  constructor() {
    this.databasePath = process.env.DATABASE_PATH || './database/trading.db';
    this.sequelize = null;
  }

  /**
   * Run database migrations
   */
  async migrate() {
    try {
      console.log('🚀 Starting database migration...');

      // Ensure database directory exists
      const dbDir = path.dirname(this.databasePath);
      await fs.ensureDir(dbDir);

      // Initialize Sequelize
      this.sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: this.databasePath,
        logging: console.log,
        define: {
          timestamps: true,
          underscored: true
        }
      });

      // Test connection
      await this.testConnection();

      // Create tables
      await this.createTables();

      // Run data migrations
      await this.runDataMigrations();

      console.log('✅ Database migration completed successfully!');
      console.log(`📊 Database created at: ${this.databasePath}`);

    } catch (error) {
      console.error('❌ Database migration failed:', error.message);
      process.exit(1);
    } finally {
      if (this.sequelize) {
        await this.sequelize.close();
      }
    }
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      await this.sequelize.authenticate();
      console.log('✅ Database connection established');
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  /**
   * Create all database tables
   */
  async createTables() {
    console.log('📝 Creating database tables...');

    // Users table
    await this.createUsersTable();

    // Settings table
    await this.createSettingsTable();

    // Assets table
    await this.createAssetsTable();

    // Signals table
    await this.createSignalsTable();

    // Trades table
    await this.createTradesTable();

    // Performance table
    await this.createPerformanceTable();

    // Strategies table
    await this.createStrategiesTable();

    // Sessions table
    await this.createSessionsTable();

    console.log('✅ All tables created');
  }

  /**
   * Create users table
   */
  async createUsersTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id BIGINT NOT NULL UNIQUE,
        username VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        language_code VARCHAR(10) DEFAULT 'en',
        is_premium BOOLEAN DEFAULT FALSE,
        status ENUM('active', 'inactive', 'suspended', 'banned') DEFAULT 'active',
        role ENUM('user', 'premium', 'admin') DEFAULT 'user',
        total_trades INTEGER DEFAULT 0,
        winning_trades INTEGER DEFAULT 0,
        losing_trades INTEGER DEFAULT 0,
        total_profit DECIMAL(15,2) DEFAULT 0.00,
        win_rate DECIMAL(5,2) DEFAULT 0.00,
        last_trade_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
      CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
    `;

    await this.sequelize.query(query);
    console.log('✅ Users table created');
  }

  /**
   * Create settings table
   */
  async createSettingsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        auto_trading_enabled BOOLEAN DEFAULT FALSE,
        min_confidence_threshold INTEGER DEFAULT 75,
        default_trade_amount DECIMAL(10,2) DEFAULT 5.00,
        max_trade_amount DECIMAL(10,2) DEFAULT 20.00,
        max_daily_trades INTEGER DEFAULT 20,
        trade_duration INTEGER DEFAULT 5,
        daily_loss_limit DECIMAL(10,2) DEFAULT 50.00,
        daily_profit_target DECIMAL(10,2) DEFAULT 100.00,
        max_consecutive_losses INTEGER DEFAULT 3,
        max_position_size_percent DECIMAL(5,2) DEFAULT 5.00,
        balance_check_enabled BOOLEAN DEFAULT TRUE,
        cooling_period_minutes INTEGER DEFAULT 15,
        preferred_assets TEXT DEFAULT '["stocks", "forex"]',
        notifications_enabled BOOLEAN DEFAULT TRUE,
        timezone VARCHAR(50) DEFAULT 'America/New_York',
        currency VARCHAR(3) DEFAULT 'USD',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);
    `;

    await this.sequelize.query(query);
    console.log('✅ Settings table created');
  }

  /**
   * Create assets table
   */
  async createAssetsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        type ENUM('stock', 'forex', 'crypto', 'commodity', 'index') NOT NULL,
        exchange VARCHAR(50),
        sector VARCHAR(100),
        country VARCHAR(100),
        currency VARCHAR(3) DEFAULT 'USD',
        is_active BOOLEAN DEFAULT TRUE,
        metadata JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_assets_symbol ON assets(symbol);
      CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
      CREATE INDEX IF NOT EXISTS idx_assets_exchange ON assets(exchange);
    `;

    await this.sequelize.query(query);
    console.log('✅ Assets table created');
  }

  /**
   * Create signals table
   */
  async createSignalsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        asset_symbol VARCHAR(20) NOT NULL,
        asset_type VARCHAR(20) NOT NULL,
        signal ENUM('BUY', 'SELL', 'WAIT') NOT NULL,
        type ENUM('CALL', 'PUT', 'NONE') NOT NULL,
        confidence INTEGER NOT NULL CHECK(confidence >= 0 AND confidence <= 100),
        strength ENUM('WEAK', 'MODERATE', 'STRONG') NOT NULL DEFAULT 'MODERATE',
        quality ENUM('POOR', 'FAIR', 'GOOD', 'EXCELLENT') NOT NULL DEFAULT 'GOOD',
        indicators JSON,
        price DECIMAL(15,4),
        volume BIGINT,
        timestamp DATETIME NOT NULL,
        strategy VARCHAR(100) DEFAULT 'technical_indicator',
        expires_at DATETIME,
        executed BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_signals_user_id ON signals(user_id);
      CREATE INDEX IF NOT EXISTS idx_signals_asset ON signals(asset_symbol);
      CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp);
      CREATE INDEX IF NOT EXISTS idx_signals_confidence ON signals(confidence);
      CREATE INDEX IF NOT EXISTS idx_signals_executed ON signals(executed);
    `;

    await this.sequelize.query(query);
    console.log('✅ Signals table created');
  }

  /**
   * Create trades table
   */
  async createTradesTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        asset_symbol VARCHAR(20) NOT NULL,
        asset_type VARCHAR(20) NOT NULL,
        direction ENUM('CALL', 'PUT') NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        entry_price DECIMAL(15,4),
        exit_price DECIMAL(15,4),
        iq_option_trade_id VARCHAR(100),
        status ENUM('PENDING', 'OPEN', 'CLOSED', 'CANCELLED', 'EXPIRED', 'ERROR') DEFAULT 'PENDING',
        result ENUM('WIN', 'LOSS', 'DRAW', 'PENDING') DEFAULT 'PENDING',
        profit_loss DECIMAL(10,2) DEFAULT 0.00,
        payout_rate DECIMAL(5,2),
        expiry_minutes INTEGER DEFAULT 5,
        entry_time DATETIME,
        close_time DATETIME,
        signal_id INTEGER,
        strategy VARCHAR(100),
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (signal_id) REFERENCES signals(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
      CREATE INDEX IF NOT EXISTS idx_trades_asset ON trades(asset_symbol);
      CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
      CREATE INDEX IF NOT EXISTS idx_trades_result ON trades(result);
      CREATE INDEX IF NOT EXISTS idx_trades_entry_time ON trades(entry_time);
      CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at);
    `;

    await this.sequelize.query(query);
    console.log('✅ Trades table created');
  }

  /**
   * Create performance table
   */
  async createPerformanceTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS performance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date DATE NOT NULL,
        total_trades INTEGER DEFAULT 0,
        winning_trades INTEGER DEFAULT 0,
        losing_trades INTEGER DEFAULT 0,
        draw_trades INTEGER DEFAULT 0,
        total_profit_loss DECIMAL(15,2) DEFAULT 0.00,
        total_invested DECIMAL(15,2) DEFAULT 0.00,
        win_rate DECIMAL(5,2) DEFAULT 0.00,
        profit_factor DECIMAL(8,2) DEFAULT 0.00,
        roi DECIMAL(8,2) DEFAULT 0.00,
        sharpe_ratio DECIMAL(8,2) DEFAULT 0.00,
        max_drawdown DECIMAL(8,2) DEFAULT 0.00,
        average_trade DECIMAL(10,2) DEFAULT 0.00,
        largest_win DECIMAL(10,2) DEFAULT 0.00,
        largest_loss DECIMAL(10,2) DEFAULT 0.00,
        best_asset VARCHAR(20),
        worst_asset VARCHAR(20),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

        UNIQUE(user_id, date)
      );

      CREATE INDEX IF NOT EXISTS idx_performance_user_id ON performance(user_id);
      CREATE INDEX IF NOT EXISTS idx_performance_date ON performance(date);
      CREATE INDEX IF NOT EXISTS idx_performance_win_rate ON performance(win_rate);
    `;

    await this.sequelize.query(query);
    console.log('✅ Performance table created');
  }

  /**
   * Create strategies table
   */
  async createStrategiesTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS strategies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        type ENUM('technical', 'trend', 'momentum', 'mean_reversion', 'breakout', 'custom') NOT NULL,
        parameters JSON,
        is_active BOOLEAN DEFAULT TRUE,
        win_rate DECIMAL(5,2) DEFAULT 0.00,
        total_trades INTEGER DEFAULT 0,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_strategies_name ON strategies(name);
      CREATE INDEX IF NOT EXISTS idx_strategies_type ON strategies(type);
      CREATE INDEX IF NOT EXISTS idx_strategies_active ON strategies(is_active);
    `;

    await this.sequelize.query(query);
    console.log('✅ Strategies table created');
  }

  /**
   * Create sessions table
   */
  async createSessionsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id VARCHAR(255) NOT NULL UNIQUE,
        user_id INTEGER,
        data JSON,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    `;

    await this.sequelize.query(query);
    console.log('✅ Sessions table created');
  }

  /**
   * Run data migrations
   */
  async runDataMigrations() {
    console.log('🔄 Running data migrations...');

    // Insert default assets
    await this.insertDefaultAssets();

    // Insert default strategies
    await this.insertDefaultStrategies();

    console.log('✅ Data migrations completed');
  }

  /**
   * Insert default assets
   */
  async insertDefaultAssets() {
    const assets = [
      // Stocks
      ['AAPL', 'Apple Inc.', 'stock', 'NASDAQ', 'Technology', 'USA'],
      ['TSLA', 'Tesla Inc.', 'stock', 'NASDAQ', 'Automotive', 'USA'],
      ['MSFT', 'Microsoft Corp.', 'stock', 'NASDAQ', 'Technology', 'USA'],
      ['GOOGL', 'Alphabet Inc.', 'stock', 'NASDAQ', 'Technology', 'USA'],
      ['AMZN', 'Amazon.com Inc.', 'stock', 'NASDAQ', 'E-commerce', 'USA'],
      ['META', 'Meta Platforms Inc.', 'stock', 'NASDAQ', 'Technology', 'USA'],
      ['NVDA', 'NVIDIA Corp.', 'stock', 'NASDAQ', 'Technology', 'USA'],
      ['NFLX', 'Netflix Inc.', 'stock', 'NASDAQ', 'Entertainment', 'USA'],

      // Forex
      ['EURUSD', 'Euro vs US Dollar', 'forex', 'FX', 'Major', 'EUR'],
      ['GBPUSD', 'British Pound vs US Dollar', 'forex', 'FX', 'Major', 'GBP'],
      ['USDJPY', 'US Dollar vs Japanese Yen', 'forex', 'FX', 'Major', 'JPY'],
      ['USDCHF', 'US Dollar vs Swiss Franc', 'forex', 'FX', 'Major', 'CHF'],
      ['AUDUSD', 'Australian Dollar vs US Dollar', 'forex', 'FX', 'Major', 'AUD'],
      ['USDCAD', 'US Dollar vs Canadian Dollar', 'forex', 'FX', 'Major', 'CAD'],

      // Crypto
      ['BTCUSD', 'Bitcoin', 'crypto', 'CRYPTO', 'Cryptocurrency', 'BTC'],
      ['ETHUSD', 'Ethereum', 'crypto', 'CRYPTO', 'Cryptocurrency', 'ETH'],
      ['BNBUSD', 'Binance Coin', 'crypto', 'CRYPTO', 'Cryptocurrency', 'BNB'],
      ['ADAUSD', 'Cardano', 'crypto', 'CRYPTO', 'Cryptocurrency', 'ADA'],
      ['SOLUSD', 'Solana', 'crypto', 'CRYPTO', 'Cryptocurrency', 'SOL'],
      ['DOGEUSD', 'Dogecoin', 'crypto', 'CRYPTO', 'Cryptocurrency', 'DOGE']
    ];

    const query = `
      INSERT OR IGNORE INTO assets (symbol, name, type, exchange, sector, currency)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    for (const asset of assets) {
      await this.sequelize.query(query, {
        replacements: asset
      });
    }

    console.log(`✅ Inserted ${assets.length} default assets`);
  }

  /**
   * Insert default strategies
   */
  async insertDefaultStrategies() {
    const strategies = [
      ['technical_indicator', 'Combines 7 technical indicators for high-confidence signals', 'technical', '{"rsi_weight": 1, "macd_weight": 2, "bollinger_weight": 1, "ema_weight": 1, "sma_weight": 1, "stochastic_weight": 1, "volume_weight": 1}'],
      ['trend_following', 'Follows strong market trends with volume confirmation', 'trend', '{"short_period": 10, "long_period": 20, "volume_threshold": 1.2}'],
      ['mean_reversion', 'Trades against extreme price movements expecting reversion', 'mean_reversion', '{"bollinger_period": 20, "rsi_overbought": 70, "rsi_oversold": 30}'],
      ['breakout', 'Trades breakouts through key support/resistance levels', 'breakout', '{"lookback_period": 20, "breakout_threshold": 0.1, "volume_multiplier": 1.5}'],
      ['momentum', 'Trades based on price speed and momentum strength', 'momentum', '{"rsi_period": 14, "macd_fast": 12, "macd_slow": 26, "stochastic_period": 14}'],
      ['multi_timeframe', 'Combines signals from multiple timeframes for confirmation', 'technical', '{"timeframes": ["1m", "5m", "15m", "1h"], "agreement_threshold": 0.66}']
    ];

    const query = `
      INSERT OR IGNORE INTO strategies (name, description, type, parameters)
      VALUES (?, ?, ?, ?)
    `;

    for (const strategy of strategies) {
      await this.sequelize.query(query, {
        replacements: strategy
      });
    }

    console.log(`✅ Inserted ${strategies.length} default strategies`);
  }

  /**
   * Check database integrity
   */
  async checkIntegrity() {
    try {
      console.log('🔍 Checking database integrity...');

      // Check table existence
      const tables = [
        'users', 'settings', 'assets', 'signals',
        'trades', 'performance', 'strategies', 'sessions'
      ];

      for (const table of tables) {
        const result = await this.sequelize.query(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`
        );

        if (result[0].length === 0) {
          throw new Error(`Table '${table}' does not exist`);
        }
      }

      // Check data counts
      const counts = {};
      for (const table of tables) {
        const result = await this.sequelize.query(`SELECT COUNT(*) as count FROM ${table}`);
        counts[table] = result[0][0].count;
      }

      console.log('✅ Database integrity check passed');
      console.log('📊 Table counts:', counts);

      return counts;

    } catch (error) {
      console.error('❌ Database integrity check failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate migration report
   */
  generateReport(counts) {
    console.log('\n📊 MIGRATION REPORT');
    console.log('==================');

    console.log(`📁 Database: ${this.databasePath}`);
    console.log(`📅 Created: ${new Date().toISOString()}`);
    console.log(`📊 Tables: ${Object.keys(counts).length}`);
    console.log(`📈 Total Records: ${Object.values(counts).reduce((sum, count) => sum + count, 0)}`);

    console.log('\n📋 Table Details:');
    Object.entries(counts).forEach(([table, count]) => {
      console.log(`  ${table}: ${count} records`);
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('🎯 Ready to start the trading bot.');
  }
}

// Run migration if called directly
if (require.main === module) {
  const migrator = new DatabaseMigrator();

  migrator.migrate()
    .then(() => migrator.checkIntegrity())
    .then(counts => {
      migrator.generateReport(counts);
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error.message);
      process.exit(1);
    });
}

module.exports = DatabaseMigrator;