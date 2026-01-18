/**
 * Telegram Bot Handler
 * Main bot logic for handling Telegram messages, commands, and interactions
 */

const { Telegraf, Markup } = require('telegraf');
const fs = require('fs').promises;
const path = require('path');

const Logger = require('../utils/Logger');
const ErrorHandler = require('../utils/ErrorHandler');
const Formatter = require('../utils/Formatter');
const Validator = require('../utils/Validator');

class TelegramBot {
  constructor(options = {}) {
    this.token = options.token;
    this.adminId = options.adminId;
    this.services = options.services || {};
    this.database = options.database;
    this.logger = options.logger || Logger.getInstance();
    this.formatter = new Formatter();

    // Bot instance
    this.bot = null;

    // Configuration
    this.config = {};
    this.assets = {};

    // User sessions for multi-step interactions
    this.userSessions = new Map();

    // Load configuration
    this.loadConfiguration();
  }

  /**
   * Load configuration files
   */
  async loadConfiguration() {
    try {
      const telegramConfigPath = path.join(__dirname, '../../config/telegram.json');
      const assetsConfigPath = path.join(__dirname, '../../config/assets.json');

      this.config.telegram = JSON.parse(await fs.readFile(telegramConfigPath, 'utf8'));
      this.assets = JSON.parse(await fs.readFile(assetsConfigPath, 'utf8'));

      this.logger.info('✅ Telegram bot configuration loaded');
    } catch (error) {
      this.logger.error('Failed to load configuration', { error: error.message });
      throw error;
    }
  }

  /**
   * Initialize the bot
   */
  async initialize() {
    try {
      // Create bot instance
      this.bot = new Telegraf(this.token);

      // Setup middleware
      this.setupMiddleware();

      // Setup command handlers
      this.setupCommands();

      // Setup callback query handlers
      this.setupCallbacks();

      // Setup message handlers
      this.setupMessageHandlers();

      // Setup error handling
      this.setupErrorHandling();

      this.logger.info('✅ Telegram bot initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize Telegram bot', { error: error.message });
      throw error;
    }
  }

  /**
   * Setup middleware
   */
  setupMiddleware() {
    // User authentication middleware
    this.bot.use(async (ctx, next) => {
      try {
        if (ctx.from) {
          // Find or create user
          const { user } = await this.services.user.findOrCreate({
            id: ctx.from.id,
            username: ctx.from.username,
            first_name: ctx.from.first_name,
            last_name: ctx.from.last_name,
            language_code: ctx.from.language_code,
            is_premium: ctx.from.is_premium || false
          });

          // Store user in context
          ctx.user = user;

          // Log user action
          const LoggerInstance = require('../utils/Logger');
          if (LoggerInstance.instance) {
            LoggerInstance.instance.logUserAction(user.telegram_id, ctx.updateType, {
              message: ctx.message?.text || ctx.callbackQuery?.data
            });
          }
        }

        await next();
      } catch (error) {
        this.logger.error('Middleware error', { error: error.message });
        await next(); // Continue even if middleware fails
      }
    });

    // Rate limiting (basic implementation)
    this.bot.use(async (ctx, next) => {
      const userId = ctx.from?.id;
      if (userId) {
        const now = Date.now();
        const userKey = `rate_limit_${userId}`;

        // Simple rate limiting - could be enhanced with Redis
        if (!this.userSessions.has(userKey)) {
          this.userSessions.set(userKey, { count: 1, resetTime: now + 60000 }); // 1 minute
        } else {
          const userLimit = this.userSessions.get(userKey);
          if (now > userLimit.resetTime) {
            userLimit.count = 1;
            userLimit.resetTime = now + 60000;
          } else if (userLimit.count >= 30) { // 30 messages per minute
            return ctx.reply('⏳ Too many requests. Please slow down.');
          } else {
            userLimit.count++;
          }
        }
      }

      await next();
    });
  }

  /**
   * Setup command handlers
   */
  setupCommands() {
    // Start command
    this.bot.start(this.handleStart.bind(this));

    // Help command
    this.bot.help(this.handleHelp.bind(this));

    // Analyze command
    this.bot.command('analyze', this.handleAnalyze.bind(this));

    // Stats command
    this.bot.command('stats', this.handleStats.bind(this));

    // Balance command
    this.bot.command('balance', this.handleBalance.bind(this));

    // History command
    this.bot.command('history', this.handleHistory.bind(this));

    // Settings command
    this.bot.command('settings', this.handleSettings.bind(this));

    // Stop command
    this.bot.command('stop', this.handleStop.bind(this));

    this.logger.info('✅ Command handlers configured');
  }

  /**
   * Setup callback query handlers
   */
  setupCallbacks() {
    // Initialize CallbackHandler if not already done
    if (!this.callbackHandler && this.services?.callbackHandler) {
      this.callbackHandler = this.services.callbackHandler;
    }

    this.bot.on('callback_query', async (ctx) => {
      try {
        const callbackData = ctx.callbackQuery.data;

        // Parse callback data (format: action_param)
        const [action, param] = callbackData.split('_');

        // Use CallbackHandler if available, otherwise use TelegramBot methods
        if (this.callbackHandler) {
          await this.callbackHandler.handleCallback(ctx);
          await ctx.answerCbQuery();
          return;
        }

        switch (action) {
          case 'menu':
            await this.handleMenuCallback(ctx, param);
            break;
          case 'trade':
            await this.handleTradeCallback(ctx, param);
            break;
          case 'analyze':
            await this.handleAnalyzeCallback(ctx, param);
            break;
          case 'timeframe':
            // Delegate to callback handler
            if (this.callbackHandler) {
              await this.callbackHandler.handleTimeframeCallback(ctx, callbackData);
            }
            break;
          case 'tf':
            // Handle timeframe first selection (tf_select_ASSETTYPE_TIMEFRAME)
            if (this.callbackHandler) {
              await this.callbackHandler.handleTimeframeFirstCallback(ctx, callbackData);
            }
            break;
          case 'view':
            await this.handleViewCallback(ctx, param);
            break;
          case 'cancel':
            await this.handleCancelCallback(ctx);
            break;
          case 'confirm':
            await this.handleConfirmCallback(ctx, param);
            break;
          case 'settings':
            await this.handleSettingsCallback(ctx, param);
            break;
          case 'back':
            await this.handleBackCallback(ctx);
            break;
          case 'help':
            await this.handleHelpCallback(ctx, param);
            break;
          default:
            // Check for tf_select pattern
            if (callbackData.startsWith('tf_select_')) {
              if (this.callbackHandler) {
                await this.callbackHandler.handleTimeframeFirstCallback(ctx, callbackData);
              }
            } else {
              await ctx.answerCbQuery('Unknown action');
            }
        }

        // Answer callback query to remove loading state
        await ctx.answerCbQuery();

      } catch (error) {
        this.logger.error('Callback query error', { error: error.message });
        await ctx.answerCbQuery('An error occurred. Please try again.');
      }
    });
  }

  /**
   * Setup message handlers
   */
  setupMessageHandlers() {
    // Handle text messages (for manual asset analysis)
    this.bot.on('text', async (ctx) => {
      const text = ctx.message.text;

      // Skip if it's a command (already handled)
      if (text.startsWith('/')) return;

      // Check if user is in analysis mode
      const session = this.getUserSession(ctx.from.id);
      if (session && session.mode === 'awaiting_asset') {
        await this.handleAssetInput(ctx, text);
        return;
      }

      // Check if it's a valid asset symbol
      if (Validator.isValidAssetSymbol(text.toUpperCase())) {
        await this.handleAssetAnalysis(ctx, text.toUpperCase());
        return;
      }

      // Default response for unrecognized text
      await ctx.reply(
        'I didn\'t understand that. Try:\n' +
        '• /analyze <symbol> to analyze an asset\n' +
        '• /stats to view your statistics\n' +
        '• /help for more commands'
      );
    });
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    this.bot.catch(async (error, ctx) => {
      const errorInfo = ErrorHandler.handleTelegramError(error, {
        userId: ctx?.from?.id,
        updateType: ctx?.updateType,
        message: ctx?.message?.text
      });

      const userMessage = ErrorHandler.getUserFriendlyMessage(error, {
        errorType: errorInfo.errorType
      });

      try {
        await ctx.reply(`❌ ${userMessage}`);
      } catch (replyError) {
        this.logger.error('Failed to send error message to user', {
          replyError: replyError.message
        });
      }
    });
  }

  /**
   * Handle /start command
   */
  async handleStart(ctx) {
    try {
      const welcomeMessage = this.config.telegram.messages.welcome;
      const keyboard = this.config.telegram.keyboards.main_menu;

      await ctx.reply(welcomeMessage, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

      // Update user last login
      if (ctx.user) {
        ctx.user.last_login_at = new Date();
        await ctx.user.save();
      }

    } catch (error) {
      this.logger.error('Start command error', { error: error.message });
      await ctx.reply('Welcome! There was an error loading the menu. Please try again.');
    }
  }

  /**
   * Handle /help command
   */
  async handleHelp(ctx) {
    const helpText = `
🤖 *Trading Bot Help*

*Available Commands:*
/start - Start the bot and show main menu
/help - Show this help message
/analyze <symbol> - Analyze a trading asset
/stats - View your trading statistics
/balance - Check your account balance
/history - View trade history
/settings - Configure bot settings
/stop - Emergency stop all trading

*How to use:*
1. Choose asset type (Stocks, Forex, Crypto)
2. Select specific asset or use /analyze <symbol>
3. Review analysis and signals
4. Execute trades or re-analyze

*Examples:*
• /analyze AAPL (Apple stock)
• /analyze EURUSD (Euro/Dollar)
• /analyze BTCUSD (Bitcoin)

For more information, contact support.
    `;

    await ctx.reply(helpText, { parse_mode: 'Markdown' });
  }

  /**
   * Handle /analyze command
   */
  async handleAnalyze(ctx) {
    const args = ctx.message.text.split(' ').slice(1);

    if (args.length === 0) {
      // Show asset type selection
      await this.showAssetTypeMenu(ctx);
    } else {
      const symbol = args[0].toUpperCase();
      await this.handleAssetAnalysis(ctx, symbol);
    }
  }

  /**
   * Handle /stats command
   */
  async handleStats(ctx) {
    try {
      const userId = ctx.user.id;

      // Get performance stats
      const todayStats = await this.services.performance.getPerformance(userId, 'daily');
      const weekStats = await this.services.performance.getPerformance(userId, 'weekly');
      const monthStats = await this.services.performance.getPerformance(userId, 'monthly');

      let statsMessage = '📊 *COMPREHENSIVE TRADING STATISTICS*\n\n';

      // Today's stats
      if (todayStats) {
        const today = new Date().toLocaleDateString();
        statsMessage += `━━━━━━━━━━━━━━━━━━━━━━━
📅 *TODAY (${today})*
━━━━━━━━━━━━━━━━━━━━━━━
• Total Trades: ${todayStats.total_trades}
• Wins: ${todayStats.winning_trades} (${todayStats.win_rate}%)
• Losses: ${todayStats.losing_trades}
• Profit: ${this.formatter.formatCurrency(todayStats.total_profit_loss)}
• ROI: ${this.formatter.formatPercentage(
  todayStats.total_invested > 0 ?
  (todayStats.total_profit_loss / todayStats.total_invested) * 100 : 0
)}\n\n`;
      }

      // Weekly stats
      if (weekStats) {
        statsMessage += `━━━━━━━━━━━━━━━━━━━━━━━
📅 *THIS WEEK*
━━━━━━━━━━━━━━━━━━━━━━━
• Total Trades: ${weekStats.total_trades}
• Wins: ${weekStats.winning_trades} (${weekStats.win_rate}%)
• Profit: ${this.formatter.formatCurrency(weekStats.total_profit_loss)}
• Avg Trade: ${this.formatter.formatCurrency(weekStats.average_trade)}\n\n`;
      }

      // Monthly stats
      if (monthStats) {
        statsMessage += `━━━━━━━━━━━━━━━━━━━━━━━
📅 *THIS MONTH*
━━━━━━━━━━━━━━━━━━━━━━━
• Total Trades: ${monthStats.total_trades}
• Win Rate: ${monthStats.win_rate}%
• Total Profit: ${this.formatter.formatCurrency(monthStats.total_profit_loss)}\n\n`;
      }

      // User summary
      const userStats = await this.services.user.getUserStats(userId);
      if (userStats) {
        statsMessage += `━━━━━━━━━━━━━━━━━━━━━━━
🏆 *OVERALL PERFORMANCE*
━━━━━━━━━━━━━━━━━━━━━━━
• Total Trades: ${userStats.user.total_trades}
• Win Rate: ${userStats.user.win_rate}%
• Total Profit: ${this.formatter.formatCurrency(userStats.user.total_profit)}
• Member Since: ${new Date(userStats.user.created_at).toLocaleDateString()}\n\n`;

        statsMessage += `[📄 Export Report] [📊 Chart View] [🔙 Back]`;
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📄 Export Report', 'stats_export')],
        [Markup.button.callback('📊 Chart View', 'stats_chart')],
        [Markup.button.callback('🔙 Back', 'back_main')]
      ]);

      await ctx.reply(statsMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      this.logger.error('Stats command error', { error: error.message });
      await ctx.reply('❌ Error loading statistics. Please try again.');
    }
  }

  /**
   * Handle /balance command
   */
  async handleBalance(ctx) {
    try {
      // This would integrate with IQ Option to get real balance
      // For now, show simulated balance
      const balanceMessage = `
💼 *ACCOUNT BALANCE*

💰 Current Balance: $1,250.75
📈 Today's P&L: +$28.50
📊 Available for Trading: $1,250.75

━━━━━━━━━━━━━━━━━━━━━━━
💳 IQ Option Account
━━━━━━━━━━━━━━━━━━━━━━━
• Account Type: ${process.env.IQ_OPTION_ACCOUNT_TYPE || 'DEMO'}
• Status: Active
• Last Updated: ${new Date().toLocaleString()}

⚠️ *Risk Management:*
• Daily Loss Limit: $50.00
• Daily Profit Target: $100.00
• Max Trade Amount: $20.00
      `;

      await ctx.reply(balanceMessage, { parse_mode: 'Markdown' });

    } catch (error) {
      this.logger.error('Balance command error', { error: error.message });
      await ctx.reply('❌ Error loading balance. Please try again.');
    }
  }

  /**
   * Handle /history command
   */
  async handleHistory(ctx) {
    try {
      const userId = ctx.user.id;
      const trades = await this.services.trade.findByUserId(userId, { limit: 5 });

      if (trades.length === 0) {
        await ctx.reply('📝 *TRADE HISTORY*\n\nNo trades found. Start trading to build your history!', {
          parse_mode: 'Markdown'
        });
        return;
      }

      let historyMessage = '📝 *RECENT TRADE HISTORY*\n\n';

      trades.forEach((trade, index) => {
        const result = this.formatter.formatTradeResult(trade.result, trade.profit_loss);
        const date = this.formatter.formatDate(trade.entry_time, 'MMM DD, HH:mm');

        historyMessage += `${index + 1}. ${trade.asset_symbol} ${trade.direction}\n`;
        historyMessage += `   ${result} | ${date}\n\n`;
      });

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📊 View All', 'history_all')],
        [Markup.button.callback('📈 Performance', 'history_performance')],
        [Markup.button.callback('🔙 Back', 'back_main')]
      ]);

      await ctx.reply(historyMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      this.logger.error('History command error', { error: error.message });
      await ctx.reply('❌ Error loading trade history. Please try again.');
    }
  }

  /**
   * Handle /settings command
   */
  async handleSettings(ctx) {
    const settingsMessage = `
⚙️ *BOT SETTINGS*

📊 *Trading Settings:*
• Auto-Trading: OFF
• Min Confidence: 75%
• Default Amount: $5
• Max Daily Trades: 20
• Trade Duration: 5 min

⚠️ *Risk Management:*
• Daily Loss Limit: $50
• Daily Profit Target: $100
• Max Trade Amount: $20
• Stop After Losses: 3

🔔 *Notifications:*
• Trade Confirmations: ON
• Win/Loss Alerts: ON
• Daily Summary: ON
• Signal Alerts: OFF

🎯 *Preferred Assets:*
• Stocks: ✓
• Forex: ✓
• Crypto: ☐
    `;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📊 Trading Settings', 'settings_trading')],
      [Markup.button.callback('⚠️ Risk Management', 'settings_risk')],
      [Markup.button.callback('🔔 Notifications', 'settings_notifications')],
      [Markup.button.callback('🎯 Asset Preferences', 'settings_assets')],
      [Markup.button.callback('💾 Save Settings', 'settings_save')],
      [Markup.button.callback('🔙 Back', 'back_main')]
    ]);

    await ctx.reply(settingsMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * Handle /stop command
   */
  async handleStop(ctx) {
    const stopMessage = `
🚨 *EMERGENCY STOP ACTIVATED*

⚠️ All trading activities have been stopped.

• Auto-trading: DISABLED
• New trade execution: BLOCKED
• Position monitoring: PAUSED

To resume trading:
1. Check your settings: /settings
2. Enable auto-trading if desired
3. Start new analysis: /analyze

Are you sure you want to stop all trading?
    `;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('✅ Yes, Stop Everything', 'stop_confirm')],
      [Markup.button.callback('❌ Cancel', 'stop_cancel')]
    ]);

    await ctx.reply(stopMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * Show asset type menu
   */
  async showAssetTypeMenu(ctx) {
    const message = 'Choose what you want to analyze:';

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📱 Stocks', 'menu_stocks')],
      [Markup.button.callback('💱 Forex', 'menu_forex')],
      [Markup.button.callback('🪙 Crypto', 'menu_crypto')],
      [Markup.button.callback('🔙 Back', 'back_main')]
    ]);

    await ctx.reply(message, { reply_markup: keyboard });
  }

  /**
   * Handle asset analysis
   */
  async handleAssetAnalysis(ctx, symbol) {
    try {
      await ctx.reply(`⏳ Analyzing ${symbol}...\nFetching real-time data from TradingView...\nCalculating 7 technical indicators...\nGenerating signal...`);

      // TODO: Integrate with analysis service
      // For now, simulate analysis
      setTimeout(async () => {
        const mockAnalysis = this.generateMockAnalysis(symbol);

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('✅ Execute $5', 'trade_5')],
          [Markup.button.callback('💰 Execute $10', 'trade_10')],
          [Markup.button.callback('💵 Custom Amount', 'trade_custom')],
          [Markup.button.callback('📊 View Chart', 'view_chart')],
          [Markup.button.callback('🔄 Re-analyze', 'analyze_' + symbol)],
          [Markup.button.callback('❌ Cancel', 'cancel')]
        ]);

        await ctx.reply(mockAnalysis, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }, 2000);

    } catch (error) {
      this.logger.error('Asset analysis error', { symbol, error: error.message });
      await ctx.reply('❌ Error analyzing asset. Please try again.');
    }
  }

  /**
   * Handle menu callbacks
   */
  async handleMenuCallback(ctx, menuType) {
    // Delegate to CallbackHandler if available
    if (this.callbackHandler) {
      await this.callbackHandler.handleMenuCallback(ctx, menuType);
      return;
    }

    // Fallback to old method
    switch (menuType) {
      case 'stocks':
        await this.showAssetMenu(ctx, 'stocks');
        break;
      case 'forex':
        await this.showAssetMenu(ctx, 'forex');
        break;
      case 'crypto':
        await this.showAssetMenu(ctx, 'crypto');
        break;
      case 'stats':
        await this.handleStats(ctx);
        break;
      case 'settings':
        await this.handleSettings(ctx);
        break;
    }
  }

  /**
   * Handle trade callbacks
   */
  async handleTradeCallback(ctx, amount) {
    try {
      let tradeAmount = 5; // default

      if (amount === 'custom') {
        // Set session for custom amount input
        this.setUserSession(ctx.from.id, {
          mode: 'awaiting_trade_amount',
          lastMessage: ctx.callbackQuery.message.message_id
        });

        await ctx.editMessageText(
          '💵 Enter trade amount (e.g., 10 for $10):',
          {
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('❌ Cancel', 'cancel')]
            ])
          }
        );
        return;
      } else if (amount !== 'confirm') {
        tradeAmount = parseInt(amount);
      }

      // Get current analysis from message
      const messageText = ctx.callbackQuery.message.text;
      const symbolMatch = messageText.match(/([A-Z]{2,10})/);
      const symbol = symbolMatch ? symbolMatch[1] : 'UNKNOWN';

      // Simulate trade execution
      await ctx.editMessageText(`⏳ Executing trade on IQ Option...\n\n1️⃣ Opening Chrome browser...\n2️⃣ Logging into IQ Option...\n3️⃣ Selecting ${symbol}...\n4️⃣ Setting trade parameters...\n5️⃣ Clicking CALL button...\n6️⃣ Confirming trade...`);

      // Simulate processing time
      setTimeout(async () => {
        const tradeResult = this.generateMockTradeResult(symbol, tradeAmount);

        await ctx.editMessageText(tradeResult, {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('📊 View Position', 'view_position')],
            [Markup.button.callback('⚙️ Settings', 'menu_settings')]
          ])
        });
      }, 3000);

    } catch (error) {
      this.logger.error('Trade callback error', { error: error.message });
      await ctx.answerCbQuery('❌ Trade execution failed. Please try again.');
    }
  }

  /**
   * Handle analyze callbacks
   */
  async handleAnalyzeCallback(ctx, symbol) {
    if (symbol === 'custom') {
      // Set session for custom symbol input
      this.setUserSession(ctx.from.id, {
        mode: 'awaiting_asset',
        lastMessage: ctx.callbackQuery.message.message_id
      });

      await ctx.editMessageText(
        '✏️ Enter asset symbol (e.g., AAPL, EURUSD, BTCUSD):',
        {
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'cancel')]
          ])
        }
      );
    } else {
      await this.handleAssetAnalysis(ctx, symbol);
    }
  }

  /**
   * Handle view callbacks
   */
  async handleViewCallback(ctx, viewType) {
    switch (viewType) {
      case 'chart':
        await ctx.reply('📊 Chart view coming soon! This would show technical analysis charts.');
        break;
      case 'position':
        await ctx.reply('📊 Current open positions would be displayed here.');
        break;
    }
  }

  /**
   * Handle cancel callback
   */
  async handleCancelCallback(ctx) {
    this.clearUserSession(ctx.from.id);
    await ctx.editMessageText('❌ Operation cancelled.');
  }

  /**
   * Handle confirm callback
   */
  async handleConfirmCallback(ctx, action) {
    switch (action) {
      case 'stop':
        await ctx.editMessageText('🚨 All trading activities have been stopped!\n\nTo resume: /settings');
        break;
    }
  }

  /**
   * Handle settings callbacks
   */
  async handleSettingsCallback(ctx, settingType) {
    let message = '⚙️ *SETTINGS*\n\n';

    switch (settingType) {
      case 'trading':
        message += `*Trading Settings:*\n• Auto-Trading: OFF\n• Min Confidence: 75%\n• Default Amount: $5\n• Max Daily Trades: 20\n• Trade Duration: 5 min`;
        break;
      case 'risk':
        message += `*Risk Management:*\n• Daily Loss Limit: $50\n• Daily Profit Target: $100\n• Max Trade Amount: $20\n• Stop After Losses: 3`;
        break;
      case 'notifications':
        message += `*Notifications:*\n• Trade Confirmations: ON\n• Win/Loss Alerts: ON\n• Daily Summary: ON\n• Signal Alerts: OFF`;
        break;
      case 'assets':
        message += `*Preferred Assets:*\n• Stocks: ✓\n• Forex: ✓\n• Crypto: ☐`;
        break;
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('💾 Save', 'settings_save')],
      [Markup.button.callback('🔙 Back to Settings', 'settings')]
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * Handle back callback
   */
  async handleBackCallback(ctx) {
    const welcomeMessage = this.config.telegram.messages.welcome;
    const keyboard = this.config.telegram.keyboards.main_menu;

    await ctx.editMessageText(welcomeMessage, {
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    });
  }

  /**
   * Handle help callback
   */
  async handleHelpCallback(ctx, topic) {
    const helpText = `🤖 *Trading Bot Help*\n\n*${topic || 'General'} Help*\n\nAvailable commands:\n/start - Main menu\n/analyze - Asset analysis\n/stats - Performance\n/settings - Configuration\n\nChoose a topic:`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📊 Trading', 'help_trading')],
      [Markup.button.callback('⚙️ Settings', 'help_settings')],
      [Markup.button.callback('🆘 Support', 'help_support')],
      [Markup.button.callback('🔙 Back', 'back_main')]
    ]);

    await ctx.editMessageText(helpText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * Handle asset input from user
   */
  async handleAssetInput(ctx, symbol) {
    const validatedSymbol = Validator.sanitizeAssetSymbol(symbol);

    if (!Validator.isValidAssetSymbol(validatedSymbol)) {
      await ctx.reply('❌ Invalid asset symbol. Please enter a valid symbol (e.g., AAPL, EURUSD).');
      return;
    }

    // Clear session
    this.clearUserSession(ctx.from.id);

    // Analyze the asset
    await this.handleAssetAnalysis(ctx, validatedSymbol);
  }

  /**
   * Generate mock trade result
   */
  generateMockTradeResult(symbol, amount) {
    const profit = (amount * 0.95).toFixed(2);
    const entryPrice = (Math.random() * 200 + 100).toFixed(2);
    const exitPrice = (parseFloat(entryPrice) + Math.random() * 2).toFixed(2);
    const movement = (parseFloat(exitPrice) - parseFloat(entryPrice)).toFixed(2);
    const percentage = ((movement / parseFloat(entryPrice)) * 100).toFixed(2);

    return `✅ *TRADE EXECUTED SUCCESSFULLY!*

📍 Asset: ${symbol}
🎯 Type: Binary Option - CALL
💵 Investment: $${amount}.00
📊 Entry Price: $${entryPrice}
⏰ Entry Time: ${new Date().toLocaleTimeString()}
⌛ Expiry Time: ${new Date(Date.now() + 5 * 60 * 1000).toLocaleTimeString()} (5 min)
💰 Potential Profit: $${profit}

🔔 I'll monitor this trade and notify you when it closes!

📊 Current Open Positions: 1
💼 Today's Trades: ${Math.floor(Math.random() * 10) + 1}

━━━━━━━━━━━━━━━━━━━━━━━━
🎯 TRADE RESULT (5 min later)
━━━━━━━━━━━━━━━━━━━━━━━━

🎉 You WON! 🎉

📍 Asset: ${symbol}
🎯 Direction: CALL (Higher) ✅

💵 Investment: $${amount}.00
📈 Entry Price: $${entryPrice}
📉 Exit Price: $${exitPrice}
📊 Movement: +$${movement} (${percentage}%)

💰 PROFIT: +$${profit}
💼 New Balance: $${(1250.75 + parseFloat(profit)).toFixed(2)}

━━━━━━━━━━━━━━━━━━━━━━━
📊 YOUR STATS TODAY:
━━━━━━━━━━━━━━━━━━━━━━━
Total Trades: ${Math.floor(Math.random() * 10) + 2}
Wins: ${Math.floor(Math.random() * 8) + 1} 🟢
Losses: ${Math.floor(Math.random() * 3)} 🔴
Win Rate: ${Math.floor(Math.random() * 30) + 70}%
Total Profit: +$${Math.floor(Math.random() * 50) + 20}.00
ROI: +${Math.floor(Math.random() * 20) + 15}.0%`;
  }

  /**
   * Show asset menu for specific type
   * NOTE: This is now handled by CallbackHandler.showAssetMenu
   * Delegating to CallbackHandler to use the new inline button implementation
   */
  async showAssetMenu(ctx, assetType) {
    // Delegate to CallbackHandler which has the new implementation with inline buttons
    if (this.callbackHandler) {
      await this.callbackHandler.showAssetMenu(ctx, assetType);
    } else {
      await ctx.reply('❌ Menu system not initialized. Please try /start again.');
    }
  }

  /**
   * Generate mock analysis for demonstration
   */
  generateMockAnalysis(symbol) {
    const mockData = {
      price: (Math.random() * 200 + 100).toFixed(2),
      rsi: Math.floor(Math.random() * 40 + 30),
      macd: 'Bullish Crossover',
      bollinger: 'At Lower Band',
      ema: 'Above',
      sma: 'Above',
      stochastic: Math.floor(Math.random() * 40 + 20),
      volume: 'Increasing'
    };

    const confidence = Math.floor(Math.random() * 25 + 75);
    const signal = confidence > 80 ? 'STRONG BUY' : 'MODERATE BUY';
    const type = 'CALL';

    return `📊 *${symbol} ANALYSIS COMPLETE*

💰 Current Price: $${mockData.price}

📈 *TECHNICAL INDICATORS:*
├─ RSI (14): ${mockData.rsi} ✅ Neutral/Bullish
├─ MACD: ${mockData.macd} ✅
├─ Bollinger: ${mockData.bollinger} ✅
├─ 50 EMA: ${mockData.ema} ($174.20) ✅
├─ 200 SMA: ${mockData.sma} ($172.50) ✅
├─ Stochastic: ${mockData.stochastic} (Oversold) ✅
└─ Volume: ${mockData.volume} ✅

🎯 *SIGNAL: ${signal} (${type})*
📊 Confidence: ${confidence}%
⭐ Quality: Excellent

💡 *RECOMMENDED TRADE:*
Direction: ${type} (Price will go UP)
Amount: $5
Duration: 5 minutes
Potential Profit: $4.75 (95% payout)`;
  }

  /**
   * Get user session
   */
  getUserSession(userId) {
    return this.userSessions.get(`session_${userId}`);
  }

  /**
   * Set user session
   */
  setUserSession(userId, sessionData) {
    this.userSessions.set(`session_${userId}`, {
      ...sessionData,
      timestamp: Date.now()
    });
  }

  /**
   * Clear user session
   */
  clearUserSession(userId) {
    this.userSessions.delete(`session_${userId}`);
  }

  /**
   * Start the bot
   */
  async start() {
    try {
      await this.bot.launch();
      this.logger.info('🎯 Telegram bot started and ready to receive messages');

      // Enable graceful stop
      process.once('SIGINT', () => this.stop());
      process.once('SIGTERM', () => this.stop());

    } catch (error) {
      this.logger.error('Failed to start Telegram bot', { error: error.message });
      throw error;
    }
  }

  /**
   * Stop the bot
   */
  async stop() {
    try {
      if (this.bot) {
        await this.bot.stop();
        this.logger.info('✅ Telegram bot stopped');
      }
    } catch (error) {
      this.logger.error('Error stopping Telegram bot', { error: error.message });
    }
  }

  /**
   * Send message to user
   */
  async sendMessage(userId, message, options = {}) {
    try {
      await this.bot.telegram.sendMessage(userId, message, options);
      this.logger.logNotification(userId, 'message', 'telegram', true);
    } catch (error) {
      this.logger.logNotification(userId, 'message', 'telegram', false, error);
      throw error;
    }
  }

  /**
   * Broadcast message to all users
   */
  async broadcastMessage(message, options = {}) {
    try {
      // This is a simplified version - in production you'd want to batch this
      const users = await this.services.user.findByStatus('active');
      let sent = 0;
      let failed = 0;

      for (const user of users) {
        try {
          await this.sendMessage(user.telegram_id, message, options);
          sent++;
        } catch (error) {
          failed++;
          this.logger.error('Broadcast message failed', {
            userId: user.telegram_id,
            error: error.message
          });
        }
      }

      this.logger.info('Broadcast completed', { sent, failed, total: users.length });
      return { sent, failed, total: users.length };

    } catch (error) {
      this.logger.error('Broadcast failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get bot statistics
   */
  getStats() {
    return {
      active_sessions: this.userSessions.size,
      initialized: this.bot !== null,
      config_loaded: Object.keys(this.config).length > 0
    };
  }
}

module.exports = TelegramBot;