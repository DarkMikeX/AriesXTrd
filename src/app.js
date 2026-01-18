#!/usr/bin/env node

/**
 * Trading Bot Main Application
 * Advanced Telegram Trading Bot with IQ Option automation
 */

require('dotenv').config();
const { Telegraf } = require('telegraf');
const { Sequelize } = require('sequelize');
const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');

// Import core services
const TelegramBot = require('./bot/TelegramBot');
const DatabaseService = require('./database/connection');
const Logger = require('./utils/Logger');
const ErrorHandler = require('./utils/ErrorHandler');

class TradingBotApp {
  constructor() {
    this.logger = null;
    this.database = null;
    this.bot = null;
    this.services = {};
  }

  /**
   * Initialize the application
   */
  async initialize() {
    try {
      // Initialize logger first
      this.logger = Logger.getInstance();
      this.logger.info('🚀 Starting Trading Bot Application...');

      // Validate environment variables
      this.validateEnvironment();

      // Initialize database
      await this.initializeDatabase();

      // Initialize services
      await this.initializeServices();

      // Initialize Telegram bot
      await this.initializeBot();

      this.logger.info('✅ Trading Bot initialized successfully!');
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize Trading Bot:', error.message);
      if (this.logger) {
        this.logger.error('Application initialization failed', { error: error.message });
      }
      process.exit(1);
    }
  }

  /**
   * Validate required environment variables
   */
  validateEnvironment() {
    const requiredVars = [
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_ADMIN_ID',
      'DATABASE_PATH'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    this.logger.info('✅ Environment variables validated');
  }

  /**
   * Initialize database connection and models
   */
  async initializeDatabase() {
    try {
      this.database = new DatabaseService();
      await this.database.initialize();

      this.logger.info('✅ Database initialized successfully');
    } catch (error) {
      // Log the error without the full object to avoid circular reference issues
      this.logger.error('Database initialization failed', {
        error: error.message,
        stack: error.stack ? error.stack.substring(0, 500) : undefined
      });
      throw new Error(`Database initialization failed: ${error.message}`);
    }
  }

  /**
   * Initialize all services
   */
  async initializeServices() {
    try {
      // Import services
      const AnalysisService = require('./services/AnalysisService');
      const TradingService = require('./services/TradingService');
      const UserService = require('./services/UserService');
      const PerformanceService = require('./services/PerformanceService');
      const NotificationService = require('./services/NotificationService');
      const SignalValidationService = require('./services/SignalValidationService');
      const MarketAnalysisService = require('./services/MarketAnalysisService');
      const NewsSentimentService = require('./services/NewsSentimentService');
      const DataAggregationService = require('./services/DataAggregationService');
      const SessionManager = require('./bot/SessionManager');
      const CallbackHandler = require('./bot/CallbackHandler');

      // Initialize services
      this.services.analysis = new AnalysisService(this.database);
      this.services.trading = new TradingService(this.database);
      this.services.user = new UserService(this.database);
      this.services.performance = new PerformanceService(this.database);
      this.services.notification = new NotificationService();
      this.services.signalValidation = new SignalValidationService(this.database);
      this.services.sessionManager = new SessionManager();
      
      // News and data aggregation services (Spike AI-like features)
      const MLPredictionService = require('./services/MLPredictionService');
      const SocialSentimentService = require('./services/SocialSentimentService');
      
      this.services.newsSentiment = new NewsSentimentService();
      this.services.mlPrediction = new MLPredictionService();
      this.services.socialSentiment = new SocialSentimentService();
      this.services.dataAggregation = new DataAggregationService(
        this.services.analysis, 
        this.services.newsSentiment,
        this.services.mlPrediction,
        this.services.socialSentiment
      );
      
      // Market analysis service (analyzes all markets for recommendations)
      this.services.marketAnalysis = new MarketAnalysisService(this.services.analysis);
      
      // Aliases for compatibility
      this.services.analysisService = this.services.analysis;
      this.services.userService = this.services.user;
      this.services.database = this.database; // Expose database for admin commands

      // Initialize each service
      for (const [name, service] of Object.entries(this.services)) {
        if (typeof service.initialize === 'function') {
          await service.initialize();
          this.logger.info(`✅ ${name} service initialized`);
        }
      }
      
      // Update signal validation service with bot and analysis service (after bot is initialized)
      // This will be done in initializeBot() after bot is created

    } catch (error) {
      throw new Error(`Services initialization failed: ${error.message}`);
    }
  }

  /**
   * Initialize Telegram bot
   */
  async initializeBot() {
    try {
      this.bot = new TelegramBot({
        token: process.env.TELEGRAM_BOT_TOKEN,
        adminId: process.env.TELEGRAM_ADMIN_ID,
        services: this.services,
        database: this.database,
        logger: this.logger
      });

      await this.bot.initialize();

      // Create CallbackHandler after bot is initialized and add to services
      const CallbackHandler = require('./bot/CallbackHandler');
      this.services.callbackHandler = new CallbackHandler(this.bot.bot, this.services);
      
      // Also set it on bot instance for direct access
      this.bot.callbackHandler = this.services.callbackHandler;

      // Update signal validation service with bot and analysis service references for notifications
      if (this.services.signalValidation) {
        this.services.signalValidation.bot = this.bot.bot;
        this.services.signalValidation.analysisService = this.services.analysis;
        this.logger.info('✅ Signal validation service connected to bot and analysis service');
      }

      this.logger.info('✅ Telegram bot initialized successfully');
    } catch (error) {
      throw new Error(`Bot initialization failed: ${error.message}`);
    }
  }

  /**
   * Start the application
   */
  async start() {
    try {
      // Start the bot
      await this.bot.start();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      this.logger.info('🎯 Trading Bot is now running and ready to accept commands!');
      this.logger.info('📱 Telegram bot commands:');
      this.logger.info('   /start - Start the bot');
      this.logger.info('   /help - Show help');
      this.logger.info('   /analyze <symbol> - Analyze an asset');
      this.logger.info('   /stats - View trading statistics');
      this.logger.info('   /settings - Configure bot settings');

    } catch (error) {
      this.logger.error('Failed to start application', { error: error.message });
      process.exit(1);
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      this.logger.info(`Received ${signal}, shutting down gracefully...`);

      try {
        // Stop the bot
        if (this.bot && typeof this.bot.stop === 'function') {
          await this.bot.stop();
        }

        // Close database connection
        if (this.database && typeof this.database.close === 'function') {
          await this.database.close();
        }

        this.logger.info('✅ Application shut down successfully');
        process.exit(0);

      } catch (error) {
        this.logger.error('Error during shutdown', { error: error.message });
        process.exit(1);
      }
    };

    // Handle various shutdown signals
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
      shutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection', { reason, promise });
      shutdown('unhandledRejection');
    });
  }

  /**
   * Get application status
   */
  getStatus() {
    return {
      status: 'running',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: Object.keys(this.services),
      database: this.database ? 'connected' : 'disconnected',
      bot: this.bot ? 'active' : 'inactive'
    };
  }
}

// Create and start the application
if (require.main === module) {
  const app = new TradingBotApp();

  app.initialize()
    .then(() => app.start())
    .catch((error) => {
      console.error('❌ Application failed to start:', error.message);
      process.exit(1);
    });
}

module.exports = TradingBotApp;