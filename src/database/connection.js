/**
 * Database Connection Service
 * Manages SQLite database connection and initialization
 */

const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs-extra');
const Logger = require('../utils/Logger');

class DatabaseService {
  constructor() {
    this.sequelize = null;
    this.models = {};
    this.logger = Logger.getInstance();
    this.isInitialized = false;
  }

  /**
   * Initialize database connection and models
   */
  async initialize() {
    try {
      const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../database/trading.db');

      // Ensure database directory exists
      await fs.ensureDir(path.dirname(dbPath));

      // Create Sequelize instance
      this.sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: dbPath,
        logging: process.env.NODE_ENV === 'development' ? this.logger.debug.bind(this.logger) : false,
        define: {
          timestamps: true,
          underscored: true,
          paranoid: false
        },
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000
        }
      });

      // Initialize models
      await this.initializeModels();

      // Test connection
      await this.testConnection();

      // Run migrations if needed
      await this.runMigrations();

      this.isInitialized = true;
      this.logger.info('✅ Database initialized successfully');

    } catch (error) {
      this.logger.error('Database initialization failed', {
        error: error.message,
        stack: error.stack ? error.stack.substring(0, 500) : undefined
      });
      throw error;
    }
  }

  /**
   * Initialize all database models
   */
  async initializeModels() {
    // Import model definitions
    const User = require('./models/User');
    const Trade = require('./models/Trade');
    const Signal = require('./models/Signal');
    const Settings = require('./models/Settings');
    const Performance = require('./models/Performance');

    // Initialize models
    this.models.User = User.init(this.sequelize);
    this.models.Trade = Trade.init(this.sequelize);
    this.models.Signal = Signal.init(this.sequelize);
    this.models.Settings = Settings.init(this.sequelize);
    this.models.Performance = Performance.init(this.sequelize);

    // Setup associations
    this.setupAssociations();

    this.logger.info('✅ Database models initialized');
  }

  /**
   * Setup model associations
   */
  setupAssociations() {
    const { User, Trade, Signal, Settings, Performance } = this.models;

    // User associations
    User.hasMany(Trade, { foreignKey: 'user_id', as: 'trades' });
    User.hasMany(Signal, { foreignKey: 'user_id', as: 'signals' });
    User.hasOne(Settings, { foreignKey: 'user_id', as: 'settings' });
    User.hasMany(Performance, { foreignKey: 'user_id', as: 'performance' });

    // Trade associations
    Trade.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
    Trade.belongsTo(Signal, { foreignKey: 'signal_id', as: 'signal' });

    // Signal associations
    Signal.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
    Signal.hasMany(Trade, { foreignKey: 'signal_id', as: 'trades' });

    // Settings associations
    Settings.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

    // Performance associations
    Performance.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

    this.logger.info('✅ Database associations configured');
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      await this.sequelize.authenticate();
      this.logger.info('✅ Database connection established');
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  /**
   * Run database migrations and sync
   */
  async runMigrations() {
    try {
      const isSQLite = this.sequelize.getDialect() === 'sqlite';
      
      // SQLite doesn't handle ALTER with foreign keys well, so never use alter for SQLite
      // Only create tables if they don't exist (force: false, alter: false)
      const syncOptions = { 
        force: false,
        alter: false  // Disable alter to avoid foreign key constraint issues
      };
      
      await this.sequelize.sync(syncOptions);
      this.logger.info('✅ Database schema synchronized');
    } catch (error) {
      this.logger.error('Database migration failed', {
        error: error.message,
        stack: error.stack ? error.stack.substring(0, 500) : undefined
      });
      throw error;
    }
  }

  /**
   * Get Sequelize instance
   */
  getSequelize() {
    return this.sequelize;
  }

  /**
   * Get all models
   */
  getModels() {
    return this.models;
  }

  /**
   * Get specific model
   */
  getModel(name) {
    return this.models[name];
  }

  /**
   * Execute raw SQL query
   */
  async query(sql, options = {}) {
    try {
      const [results] = await this.sequelize.query(sql, options);
      return results;
    } catch (error) {
      this.logger.error('SQL query failed', {
        sql,
        error: error.message,
        stack: error.stack ? error.stack.substring(0, 500) : undefined
      });
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    try {
      const stats = {
        users: await this.models.User.count(),
        trades: await this.models.Trade.count(),
        signals: await this.models.Signal.count(),
        total_trades_value: await this.models.Trade.sum('amount'),
        winning_trades: await this.models.Trade.count({ where: { result: 'WIN' } }),
        losing_trades: await this.models.Trade.count({ where: { result: 'LOSS' } })
      };

      if (stats.trades > 0) {
        stats.win_rate = ((stats.winning_trades / stats.trades) * 100).toFixed(2);
      }

      return stats;
    } catch (error) {
      this.logger.error('Failed to get database stats', { error: error.message });
      return null;
    }
  }

  /**
   * Backup database
   */
  async backup(backupPath = null) {
    try {
      const dbPath = this.sequelize.options.storage;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = backupPath || path.join(path.dirname(dbPath), `backup-${timestamp}.db`);

      await fs.copy(dbPath, backupFile);

      this.logger.info('✅ Database backup created', { backupFile });
      return backupFile;
    } catch (error) {
      this.logger.error('Database backup failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close() {
    try {
      if (this.sequelize) {
        await this.sequelize.close();
        this.logger.info('✅ Database connection closed');
      }
    } catch (error) {
      this.logger.error('Error closing database connection', { error: error.message });
    }
  }

  /**
   * Check if database is healthy
   */
  async healthCheck() {
    try {
      await this.sequelize.authenticate();
      return { status: 'healthy', message: 'Database connection is active' };
    } catch (error) {
      return { status: 'unhealthy', message: error.message };
    }
  }

  /**
   * Reset database (for testing)
   */
  async reset() {
    try {
      if (process.env.NODE_ENV !== 'test') {
        throw new Error('Database reset only allowed in test environment');
      }

      await this.sequelize.drop();
      await this.sequelize.sync();

      this.logger.info('✅ Database reset completed');
    } catch (error) {
      this.logger.error('Database reset failed', { error: error.message });
      throw error;
    }
  }
}

module.exports = DatabaseService;