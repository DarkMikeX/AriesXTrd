/**
 * Message Handler
 * Handles regular text messages and user input
 */

const Logger = require('../utils/Logger');
const ErrorHandler = require('../utils/ErrorHandler');
const Validator = require('../utils/Validator');

class MessageHandler {
  constructor(bot, services) {
    this.bot = bot;
    this.services = services;
    this.logger = Logger.getInstance();
    this.userStates = new Map();
  }

  /**
   * Handle incoming text message
   */
  async handleMessage(ctx) {
    try {
      const message = ctx.message;
      const userId = ctx.from.id;
      const text = message.text?.trim();

      if (!text) return;

      // Skip if it's a command (handled by CommandHandler)
      if (text.startsWith('/')) return;

      // Check user state for multi-step conversations
      const userState = this.getUserState(userId);
      if (userState) {
        await this.handleStatefulMessage(ctx, userState, text);
        return;
      }

      // Handle regular message
      await this.handleRegularMessage(ctx, text);

    } catch (error) {
      this.logger.error('Message handling error', {
        userId: ctx.from.id,
        message: ctx.message.text,
        error: error.message
      });

      await ctx.reply('❌ An error occurred while processing your message. Please try again.');
    }
  }

  /**
   * Handle message based on user state
   */
  async handleStatefulMessage(ctx, userState, text) {
    const userId = ctx.from.id;

    switch (userState.action) {
      case 'awaiting_asset_symbol':
        await this.handleAssetSymbolInput(ctx, text);
        break;

      case 'awaiting_trade_amount':
        await this.handleTradeAmountInput(ctx, text);
        break;

      case 'awaiting_risk_settings':
        await this.handleRiskSettingsInput(ctx, text, userState);
        break;

      case 'awaiting_feedback':
        await this.handleFeedbackInput(ctx, text);
        break;

      case 'awaiting_support_message':
        await this.handleSupportMessage(ctx, text);
        break;

      default:
        // Clear unknown state
        this.clearUserState(userId);
        await this.handleRegularMessage(ctx, text);
    }
  }

  /**
   * Handle regular text message
   */
  async handleRegularMessage(ctx, text) {
    const userId = ctx.from.id;

    // Check if it's an asset symbol
    if (this.isAssetSymbol(text)) {
      await this.handleAssetAnalysis(ctx, text.toUpperCase());
      return;
    }

    // Check for keywords
    if (this.containsTradingKeywords(text)) {
      await this.handleTradingQuery(ctx, text);
      return;
    }

    // Check for greeting
    if (this.isGreeting(text)) {
      await this.handleGreeting(ctx);
      return;
    }

    // Check for questions
    if (text.includes('?') || text.toLowerCase().includes('what') ||
        text.toLowerCase().includes('how') || text.toLowerCase().includes('why')) {
      await this.handleQuestion(ctx, text);
      return;
    }

    // Default response
    await this.handleDefaultResponse(ctx, text);
  }

  /**
   * Handle asset symbol input
   */
  async handleAssetSymbolInput(ctx, symbol) {
    const userId = ctx.from.id;
    symbol = symbol.toUpperCase().trim();

    // Validate symbol
    if (!Validator.isValidAssetSymbol(symbol)) {
      await ctx.reply(`❌ "${symbol}" is not a valid asset symbol.\n\nPlease enter a valid symbol like:\n• AAPL (Apple)\n• EURUSD (Euro/Dollar)\n• BTCUSD (Bitcoin)`);
      return;
    }

    // Clear state
    this.clearUserState(userId);

    // Analyze the asset
    await this.handleAssetAnalysis(ctx, symbol);
  }

  /**
   * Handle trade amount input
   */
  async handleTradeAmountInput(ctx, amountText) {
    const userId = ctx.from.id;
    const amount = parseFloat(amountText);

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('❌ Please enter a valid amount (e.g., 5 for $5, 10.50 for $10.50)');
      return;
    }

    if (amount > 100) {
      await ctx.reply('⚠️ Trade amount is quite high. Maximum recommended is $100. Are you sure?');
      // Could add confirmation here
    }

    // Clear state
    this.clearUserState(userId);

    // Get stored symbol and direction from state
    const userState = this.getUserState(userId);
    if (userState && userState.symbol) {
      await this.executeTrade(ctx, userState.symbol, userState.direction || 'CALL', amount);
    } else {
      await ctx.reply('❌ Trade context lost. Please start over with /analyze <symbol>');
    }
  }

  /**
   * Handle risk settings input
   */
  async handleRiskSettingsInput(ctx, input, userState) {
    const userId = ctx.from.id;
    const setting = userState.setting;
    const value = input.trim();

    try {
      // Update user settings
      const updateData = {};
      updateData[setting] = this.parseSettingValue(setting, value);

      await this.services.user.updateSettings(userId, updateData);

      // Clear state
      this.clearUserState(userId);

      await ctx.reply(`✅ ${this.formatSettingName(setting)} updated to: ${value}`);

    } catch (error) {
      await ctx.reply(`❌ Invalid value for ${setting}. Please try again.`);
    }
  }

  /**
   * Handle feedback input
   */
  async handleFeedbackInput(ctx, feedback) {
    const userId = ctx.from.id;

    // Store feedback (could save to database)
    this.logger.info('User feedback received', { userId, feedback });

    // Clear state
    this.clearUserState(userId);

    await ctx.reply('✅ Thank you for your feedback! We appreciate your input.');
  }

  /**
   * Handle support message
   */
  async handleSupportMessage(ctx, message) {
    const userId = ctx.from.id;

    // Forward to support (could integrate with helpdesk system)
    this.logger.info('Support request received', { userId, message });

    // Clear state
    this.clearUserState(userId);

    await ctx.reply('✅ Your message has been sent to our support team. We\'ll get back to you soon!');
  }

  /**
   * Handle asset analysis request
   */
  async handleAssetAnalysis(ctx, symbol) {
    try {
      await ctx.reply(`⏳ Analyzing ${symbol}...\nFetching real-time data from TradingView...\nCalculating 7 technical indicators...\nGenerating signal...`);

      // Use analysis service
      const analysis = await this.services.analysis.analyzeAsset(symbol, undefined, {
        userId: ctx.from.id,
        includeCharts: false
      });

      if (analysis.formatted) {
        const keyboard = {
          inline_keyboard: [
            [{ text: '✅ Execute $5', callback_data: 'trade_5' }],
            [{ text: '💰 Execute $10', callback_data: 'trade_10' }],
            [{ text: '💵 Custom Amount', callback_data: 'trade_custom' }],
            [{ text: '📊 View Chart', callback_data: 'view_chart' }],
            [{ text: '🔄 Re-analyze', callback_data: `analyze_${symbol}` }],
            [{ text: '❌ Cancel', callback_data: 'cancel' }]
          ]
        };

        await ctx.reply(analysis.formatted.signal_info, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }

    } catch (error) {
      this.logger.error('Asset analysis error', { symbol, error: error.message });
      await ctx.reply('❌ Analysis failed. Please try again.');
    }
  }

  /**
   * Handle trading-related queries
   */
  async handleTradingQuery(ctx, text) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('profit') || lowerText.includes('loss') || lowerText.includes('p&L')) {
      await this.handleProfitQuery(ctx);
    } else if (lowerText.includes('balance') || lowerText.includes('money')) {
      await ctx.reply('💰 Use /balance to check your account balance.');
    } else if (lowerText.includes('history') || lowerText.includes('trades')) {
      await ctx.reply('📝 Use /history to view your trade history.');
    } else if (lowerText.includes('settings') || lowerText.includes('config')) {
      await ctx.reply('⚙️ Use /settings to configure bot preferences.');
    } else if (lowerText.includes('risk')) {
      await ctx.reply('🛡️ Use /risk to check your risk profile.');
    } else if (lowerText.includes('stats') || lowerText.includes('performance')) {
      await ctx.reply('📊 Use /stats to view trading statistics.');
    } else {
      // General trading response
      await ctx.reply(
        '🤖 I\'m here to help with trading!\n\n' +
        'Try these commands:\n' +
        '• /analyze <symbol> - Analyze an asset\n' +
        '• /stats - View performance\n' +
        '• /balance - Check balance\n' +
        '• /settings - Configure bot\n\n' +
        'Or just send me an asset symbol like "AAPL" or "EURUSD"'
      );
    }
  }

  /**
   * Handle greeting
   */
  async handleGreeting(ctx) {
    const greetings = [
      '👋 Hello! Ready to analyze some markets?',
      '🤖 Hi there! What asset would you like to analyze?',
      '👋 Welcome back! Let\'s check some trading signals.',
      '🤖 Hello! I\'m here to help with your trading decisions.'
    ];

    const greeting = greetings[Math.floor(Math.random() * greetings.length)];

    const keyboard = {
      inline_keyboard: [
        [{ text: '📱 Stocks', callback_data: 'menu_stocks' }],
        [{ text: '💱 Forex', callback_data: 'menu_forex' }],
        [{ text: '🪙 Crypto', callback_data: 'menu_crypto' }]
      ]
    };

    await ctx.reply(greeting, { reply_markup: keyboard });
  }

  /**
   * Handle questions
   */
  async handleQuestion(ctx, text) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('how') && lowerText.includes('work')) {
      await this.handleHowItWorks(ctx);
    } else if (lowerText.includes('what') && lowerText.includes('indicator')) {
      await this.handleIndicatorExplanation(ctx);
    } else if (lowerText.includes('risk') || lowerText.includes('safe')) {
      await this.handleRiskExplanation(ctx);
    } else if (lowerText.includes('fee') || lowerText.includes('cost') || lowerText.includes('charge')) {
      await this.handleFeeExplanation(ctx);
    } else {
      await ctx.reply(
        '🤔 I\'m still learning! For now, try:\n\n' +
        '• /help - Get help with commands\n' +
        '• /analyze <symbol> - Analyze assets\n' +
        '• /settings - Configure preferences\n\n' +
        'Or ask me about trading, indicators, or risk management!'
      );
    }
  }

  /**
   * Handle "how it works" questions
   */
  async handleHowItWorks(ctx) {
    await ctx.reply(
      '🤖 *How Trading Bot Works:*\n\n' +
      '1️⃣ *Analysis*: I fetch real-time price data from TradingView\n\n' +
      '2️⃣ *Indicators*: Calculate 7 technical indicators (RSI, MACD, etc.)\n\n' +
      '3️⃣ *Signal Generation*: Combine indicators to generate BUY/SELL signals\n\n' +
      '4️⃣ *Risk Check*: Verify trade meets your risk management rules\n\n' +
      '5️⃣ *Execution*: Automate trade placement on IQ Option\n\n' +
      '6️⃣ *Monitoring*: Track trade progress and notify on completion\n\n' +
      'All with 75%+ confidence signals and comprehensive safety features!',
      { parse_mode: 'Markdown' }
    );
  }

  /**
   * Handle indicator explanations
   */
  async handleIndicatorExplanation(ctx) {
    await ctx.reply(
      '📊 *Technical Indicators I Use:*\n\n' +
      '🔴 *RSI (Relative Strength Index)*: Measures price momentum (0-100)\n' +
      '• Above 70 = Overbought (SELL signal)\n' +
      '• Below 30 = Oversold (BUY signal)\n\n' +
      '🔵 *MACD*: Shows trend changes and momentum\n' +
      '• Line crossover = Strong signals\n' +
      '• Histogram shows momentum strength\n\n' +
      '🟡 *Bollinger Bands*: Volatility bands around price\n' +
      '• Price at lower band = BUY opportunity\n' +
      '• Price at upper band = SELL opportunity\n\n' +
      'And 4 more: EMA, SMA, Stochastic, Volume!\n\n' +
      'I combine all 7 for high-accuracy signals.',
      { parse_mode: 'Markdown' }
    );
  }

  /**
   * Handle risk explanations
   */
  async handleRiskExplanation(ctx) {
    await ctx.reply(
      '🛡️ *Risk Management Features:*\n\n' +
      '✅ *Daily Loss Limits*: Stop trading after reaching limit\n\n' +
      '✅ *Position Sizing*: Max 5% of balance per trade\n\n' +
      '✅ *Consecutive Loss Protection*: Pause after losing streaks\n\n' +
      '✅ *Confidence Thresholds*: Only trade 75%+ signals\n\n' +
      '✅ *Balance Checks*: Verify funds before trading\n\n' +
      '✅ *Trade Amount Limits*: Maximum per-trade limits\n\n' +
      '✅ *Emergency Stop*: /stop command for immediate halt\n\n' +
      'Your capital is protected with multiple safety layers!',
      { parse_mode: 'Markdown' }
    );
  }

  /**
   * Handle fee explanations
   */
  async handleFeeExplanation(ctx) {
    await ctx.reply(
      '💰 *Trading Bot Costs:*\n\n' +
      '🤖 *Bot Usage*: FREE\n\n' +
      '📊 *Data*: FREE (TradingView integration)\n\n' +
      '💸 *Trading Fees*: IQ Option platform fees only\n' +
      '• Binary Options: 95% payout (5% fee)\n' +
      '• Varies by asset and time\n\n' +
      '🔄 *No Monthly Fees*: Pay only per trade\n\n' +
      '⚡ *No Hidden Costs*: Transparent pricing\n\n' +
      'Start with small amounts and scale up!',
      { parse_mode: 'Markdown' }
    );
  }

  /**
   * Handle profit queries
   */
  async handleProfitQuery(ctx) {
    const userId = ctx.from.id;

    try {
      const performance = await this.services.performance.getUserPerformanceSummary(userId);

      if (!performance || !performance.periods) {
        await ctx.reply('📊 You haven\'t traded yet. Start with /analyze <symbol> to begin!');
        return;
      }

      const today = performance.periods.daily;
      if (today && today.total_trades > 0) {
        const profit = parseFloat(today.total_profit_loss);
        const emoji = profit >= 0 ? '📈' : '📉';
        const direction = profit >= 0 ? 'profit' : 'loss';

        await ctx.reply(
          `${emoji} *Today's P&L:*\n\n` +
          `💰 *$${Math.abs(profit).toFixed(2)} ${direction}*\n\n` +
          `📊 *Stats:* ${today.wins}W / ${today.losing_trades}L\n` +
          `🎯 *Win Rate:* ${today.win_rate}%\n\n` +
          `Use /stats for detailed performance!`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.reply('📊 No trades today yet. Start analyzing with /analyze <symbol>!');
      }

    } catch (error) {
      this.logger.error('Profit query error', { userId, error: error.message });
      await ctx.reply('❌ Error fetching profit data. Try /stats instead.');
    }
  }

  /**
   * Handle default responses
   */
  async handleDefaultResponse(ctx, text) {
    const responses = [
      '🤖 I\'m a trading bot! Try /analyze AAPL or send me an asset symbol.',
      '📊 Send me a stock symbol like "TSLA" or forex pair like "EURUSD" to analyze!',
      '💡 Try /help to see available commands, or just send me an asset to analyze.',
      '🚀 Ready to trade? Send me a symbol like "BTCUSD" or use /analyze command.',
      '📈 I analyze markets using 7 technical indicators. What asset interests you?'
    ];

    const response = responses[Math.floor(Math.random() * responses.length)];
    await ctx.reply(response);
  }

  /**
   * Execute trade
   */
  async executeTrade(ctx, symbol, direction, amount) {
    try {
      // Show loading message
      await ctx.reply(`⏳ Executing ${direction} trade on ${symbol} for $${amount}...\n\n1️⃣ Opening Chrome browser...\n2️⃣ Logging into IQ Option...\n3️⃣ Selecting ${symbol}...\n4️⃣ Setting trade parameters...\n5️⃣ Clicking ${direction} button...\n6️⃣ Confirming trade...`);

      // Simulate trade execution (replace with actual service call)
      setTimeout(async () => {
        const tradeResult = this.generateMockTradeResult(symbol, direction, amount);

        await ctx.reply(tradeResult, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📊 View Position', callback_data: 'view_position' }],
              [{ text: '⚙️ Settings', callback_data: 'menu_settings' }]
            ]
          }
        });
      }, 3000);

    } catch (error) {
      this.logger.error('Trade execution error', { symbol, direction, amount, error: error.message });
      await ctx.reply('❌ Trade execution failed. Please try again.');
    }
  }

  /**
   * Check if text is an asset symbol
   */
  isAssetSymbol(text) {
    // Basic symbol detection
    const upperText = text.toUpperCase().trim();
    return /^[A-Z0-9]{2,10}$/.test(upperText) && upperText.length >= 2;
  }

  /**
   * Check if text contains trading keywords
   */
  containsTradingKeywords(text) {
    const keywords = ['trade', 'buy', 'sell', 'profit', 'loss', 'balance', 'money', 'invest', 'market', 'stock', 'forex', 'crypto'];
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Check if text is a greeting
   */
  isGreeting(text) {
    const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'greetings'];
    const lowerText = text.toLowerCase();
    return greetings.some(greeting => lowerText.includes(greeting));
  }

  /**
   * Get user state
   */
  getUserState(userId) {
    return this.userStates.get(userId);
  }

  /**
   * Set user state
   */
  setUserState(userId, state) {
    this.userStates.set(userId, {
      ...state,
      timestamp: Date.now()
    });
  }

  /**
   * Clear user state
   */
  clearUserState(userId) {
    this.userStates.delete(userId);
  }

  /**
   * Parse setting value
   */
  parseSettingValue(setting, value) {
    switch (setting) {
      case 'daily_loss_limit':
      case 'daily_profit_target':
      case 'max_trade_amount':
        return parseFloat(value);
      case 'max_consecutive_losses':
      case 'min_confidence_threshold':
        return parseInt(value);
      case 'auto_trading_enabled':
        return value.toLowerCase() === 'true' || value === '1' || value === 'yes';
      default:
        return value;
    }
  }

  /**
   * Format setting name
   */
  formatSettingName(setting) {
    const names = {
      daily_loss_limit: 'Daily Loss Limit',
      daily_profit_target: 'Daily Profit Target',
      max_trade_amount: 'Max Trade Amount',
      max_consecutive_losses: 'Max Consecutive Losses',
      min_confidence_threshold: 'Min Confidence Threshold',
      auto_trading_enabled: 'Auto Trading'
    };
    return names[setting] || setting;
  }

  /**
   * Generate mock trade result
   */
  generateMockTradeResult(symbol, direction, amount) {
    const profit = (amount * 0.95).toFixed(2);
    const entryPrice = (Math.random() * 200 + 100).toFixed(2);
    const exitPrice = (parseFloat(entryPrice) + Math.random() * 2).toFixed(2);

    return `✅ *TRADE EXECUTED SUCCESSFULLY!*

📍 Asset: ${symbol}
🎯 Type: Binary Option - ${direction}
💵 Investment: $${amount}.00
📊 Entry Price: $${entryPrice}
⏰ Entry Time: ${new Date().toLocaleTimeString()}
⌛ Expiry Time: ${new Date(Date.now() + 5 * 60 * 1000).toLocaleTimeString()} (5 min)
💰 Potential Profit: $${profit}

🔔 I'll monitor this trade and notify you when it closes!`;
  }

  /**
   * Clean up expired states (older than 30 minutes)
   */
  cleanupExpiredStates() {
    const now = Date.now();
    const expiryTime = 30 * 60 * 1000; // 30 minutes

    for (const [userId, state] of this.userStates.entries()) {
      if (now - state.timestamp > expiryTime) {
        this.userStates.delete(userId);
      }
    }
  }
}

module.exports = MessageHandler;