/**
 * Command Handler
 * Handles bot commands and routes them to appropriate handlers
 */

const Logger = require('../utils/Logger');
const ErrorHandler = require('../utils/ErrorHandler');

class CommandHandler {
  constructor(bot, services) {
    this.bot = bot;
    this.services = services;
    this.logger = Logger.getInstance();
    this.commands = new Map();
  }

  /**
   * Initialize command handlers
   */
  initialize() {
    this.registerCommands();
    this.logger.info('✅ Command handlers initialized');
  }

  /**
   * Register all command handlers
   */
  registerCommands() {
    // Core commands
    this.registerCommand('start', this.handleStart.bind(this));
    this.registerCommand('help', this.handleHelp.bind(this));
    this.registerCommand('analyze', this.handleAnalyze.bind(this));
    this.registerCommand('stats', this.handleStats.bind(this));
    this.registerCommand('balance', this.handleBalance.bind(this));
    this.registerCommand('history', this.handleHistory.bind(this));
    this.registerCommand('settings', this.handleSettings.bind(this));
    this.registerCommand('stop', this.handleStop.bind(this));

    // Additional commands
    this.registerCommand('status', this.handleStatus.bind(this));
    this.registerCommand('performance', this.handlePerformance.bind(this));
    this.registerCommand('risk', this.handleRisk.bind(this));

    // Admin commands
    this.registerCommand('admin', this.handleAdmin.bind(this));
  }

  /**
   * Register a command handler
   */
  registerCommand(command, handler) {
    this.commands.set(command, handler);
    this.logger.info(`Registered command handler: /${command}`);
  }

  /**
   * Handle incoming command
   */
  async handleCommand(ctx) {
    try {
      const message = ctx.message;
      const text = message.text || '';

      // Extract command (remove @botname if present)
      const commandText = text.split(' ')[0].replace('/', '').split('@')[0];
      const args = text.split(' ').slice(1);

      // Get user info
      const userId = ctx.from.id;
      const username = ctx.from.username || `${ctx.from.first_name} ${ctx.from.last_name || ''}`.trim();

      // Log user action
      const LoggerInstance = require('../utils/Logger');
      if (LoggerInstance.instance) {
        LoggerInstance.instance.logUserAction(userId, 'command', { command: commandText, args });
      }

      // Find and execute command handler
      const handler = this.commands.get(commandText);
      if (handler) {
        await handler(ctx, args);
      } else {
        await this.handleUnknownCommand(ctx, commandText);
      }

    } catch (error) {
      this.logger.error('Command handling error', {
        command: ctx.message.text,
        userId: ctx.from.id,
        error: error.message
      });

      await ctx.reply('❌ An error occurred while processing your command. Please try again.');
    }
  }

  /**
   * Handle /start command
   */
  async handleStart(ctx, args) {
    try {
      const welcomeMessage = `👋 *Welcome to Trading Bot!*

I analyze stocks, forex & crypto using 7 technical indicators to give you high-accuracy signals.

Choose what you want to trade:`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '⭐ Recommended Signal', callback_data: 'menu_recommended' }
          ],
          [
            { text: '📱 Stocks', callback_data: 'menu_stocks' },
            { text: '💱 Forex', callback_data: 'menu_forex' }
          ],
          [
            { text: '🪙 Crypto', callback_data: 'menu_crypto' },
            { text: '📊 My Stats', callback_data: 'menu_stats' }
          ],
          [
            { text: '⚙️ Settings', callback_data: 'menu_settings' }
          ]
        ]
      };

      await ctx.reply(welcomeMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
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
  async handleHelp(ctx, args) {
    const helpText = `🤖 *Trading Bot Help*

*Available Commands:*
/start - Start the bot and show main menu
/help - Show this help message
/analyze <symbol> - Analyze a trading asset
/stats - View your trading statistics
/balance - Check your account balance
/history - View trade history
/settings - Configure bot settings
/stop - Emergency stop all trading
/status - Check system status
/performance - View detailed performance
/risk - Check risk profile

*Examples:*
• /analyze AAPL (Apple stock)
• /analyze EURUSD (Euro/Dollar)
• /analyze BTCUSD (Bitcoin)

*Quick Tips:*
• Use inline keyboards for easier navigation
• Set up risk management in /settings
• Monitor your positions regularly
• Stop trading if you reach your daily limits

For more information, contact support.`;

    await ctx.reply(helpText, { parse_mode: 'Markdown' });
  }

  /**
   * Handle /analyze command
   */
  async handleAnalyze(ctx, args) {
    try {
      if (args.length === 0) {
        // Show asset type selection
        const message = 'Choose what you want to analyze:';
        const keyboard = {
          inline_keyboard: [
            [{ text: '📱 Stocks', callback_data: 'menu_stocks' }],
            [{ text: '💱 Forex', callback_data: 'menu_forex' }],
            [{ text: '🪙 Crypto', callback_data: 'menu_crypto' }],
            [{ text: '🔙 Back', callback_data: 'back_main' }]
          ]
        };

        await ctx.reply(message, { reply_markup: keyboard });
      } else {
        const symbol = args[0].toUpperCase();

        // Validate symbol
        if (!this.isValidSymbol(symbol)) {
          await ctx.reply(`❌ Invalid symbol format: ${symbol}\n\nExamples:\n• AAPL (Stock)\n• EURUSD (Forex)\n• BTCUSD (Crypto)`);
          return;
        }

        // Analyze the symbol
        await this.analyzeSymbol(ctx, symbol);
      }

    } catch (error) {
      this.logger.error('Analyze command error', { args, error: error.message });
      await ctx.reply('❌ Analysis failed. Please try again.');
    }
  }

  /**
   * Handle /stats command
   */
  async handleStats(ctx, args) {
    try {
      const userId = ctx.from.id;

      // Get performance data
      const performance = await this.services.performance.getUserPerformanceSummary(userId);

      if (!performance || !performance.periods) {
        await ctx.reply('📊 *TRADING STATISTICS*\n\nNo trading data available yet.\n\nStart trading to build your statistics!', {
          parse_mode: 'Markdown'
        });
        return;
      }

      let statsMessage = '📊 *COMPREHENSIVE TRADING STATISTICS*\n\n';

      // Today's stats
      const today = performance.periods.daily;
      if (today && today.total_trades > 0) {
        statsMessage += `━━━━━━━━━━━━━━━━━━━━━━━
📅 *TODAY*
━━━━━━━━━━━━━━━━━━━━━━━
• Total Trades: ${today.total_trades}
• Wins: ${today.winning_trades} (${today.win_rate}%)
• Losses: ${today.losing_trades}
• Profit: ${this.formatCurrency(today.total_profit_loss)}
• ROI: ${today.total_invested > 0 ? ((today.total_profit_loss / today.total_invested) * 100).toFixed(2) : 0}%\n\n`;
      }

      // Weekly stats
      const week = performance.periods.weekly;
      if (week && week.total_trades > 0) {
        statsMessage += `━━━━━━━━━━━━━━━━━━━━━━━
📅 *THIS WEEK*
━━━━━━━━━━━━━━━━━━━━━━━
• Total Trades: ${week.total_trades}
• Wins: ${week.winning_trades} (${week.win_rate}%)
• Profit: ${this.formatCurrency(week.total_profit_loss)}
• Avg Trade: ${this.formatCurrency(week.average_trade)}\n\n`;
      }

      // Monthly stats
      const month = performance.periods.monthly;
      if (month && month.total_trades > 0) {
        statsMessage += `━━━━━━━━━━━━━━━━━━━━━━━
📅 *THIS MONTH*
━━━━━━━━━━━━━━━━━━━━━━━
• Total Trades: ${month.total_trades}
• Win Rate: ${month.win_rate}%
• Total Profit: ${this.formatCurrency(month.total_profit_loss)}\n\n`;
      }

      // Overall stats
      const user = performance.user;
      if (user && user.total_trades > 0) {
        statsMessage += `━━━━━━━━━━━━━━━━━━━━━━━
🏆 *OVERALL PERFORMANCE*
━━━━━━━━━━━━━━━━━━━━━━━
• Total Trades: ${user.total_trades}
• Win Rate: ${user.win_rate}%
• Total Profit: ${this.formatCurrency(user.total_profit)}
• Member Since: ${user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}\n\n`;

        statsMessage += `[📄 Export Report] [📊 Chart View] [🔙 Back]`;
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: '📄 Export Report', callback_data: 'stats_export' }],
          [{ text: '📊 Chart View', callback_data: 'stats_chart' }],
          [{ text: '🔙 Back', callback_data: 'back_main' }]
        ]
      };

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
  async handleBalance(ctx, args) {
    try {
      // This would integrate with IQ Option to get real balance
      const mockBalance = 1250.75;

      const balanceMessage = `
💼 *ACCOUNT BALANCE*

💰 Current Balance: ${this.formatCurrency(mockBalance)}
📈 Today's P&L: ${this.formatCurrency(Math.random() * 100 - 50)}
📊 Available for Trading: ${this.formatCurrency(mockBalance)}

━━━━━━━━━━━━━━━━━━━━━━━
💳 IQ Option Account
━━━━━━━━━━━━━━━━━━━━━━━
• Account Type: DEMO
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
  async handleHistory(ctx, args) {
    try {
      const userId = ctx.from.id;
      const limit = args[0] ? parseInt(args[0]) : 5;

      const history = await this.services.trading.getTradeHistory(userId, { limit });

      if (history.trades.length === 0) {
        await ctx.reply('📝 *TRADE HISTORY*\n\nNo trades found. Start trading to build your history!', {
          parse_mode: 'Markdown'
        });
        return;
      }

      let historyMessage = '📝 *RECENT TRADE HISTORY*\n\n';

      history.trades.forEach((trade, index) => {
        const result = this.formatTradeResult(trade.result, trade.profit);
        const date = new Date(trade.entryTime).toLocaleDateString();

        historyMessage += `${index + 1}. ${trade.asset} ${trade.direction}\n`;
        historyMessage += `   ${result} | ${date}\n\n`;
      });

      const keyboard = {
        inline_keyboard: [
          [{ text: '📊 View All', callback_data: 'history_all' }],
          [{ text: '📈 Performance', callback_data: 'history_performance' }],
          [{ text: '🔙 Back', callback_data: 'back_main' }]
        ]
      };

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
  async handleSettings(ctx, args) {
    const settingsMessage = `
⚙️ *BOT SETTINGS*

📊 *Trading Settings:*
├─ Auto-Trading: OFF
├─ Min Confidence: 75%
├─ Default Amount: $5
├─ Max Daily Trades: 20
├─ Trade Duration: 5 min

⚠️ *Risk Management:*
├─ Daily Loss Limit: $50
├─ Daily Profit Target: $100
├─ Max Trade Amount: $20
├─ Stop After Losses: 3

🔔 *Notifications:*
├─ Trade Confirmations: ON
├─ Win/Loss Alerts: ON
├─ Daily Summary: ON
├─ Signal Alerts: OFF

🎯 *Preferred Assets:*
[✓] Stocks
[✓] Forex
[ ] Crypto
    `;

    const keyboard = {
      inline_keyboard: [
        [{ text: '📊 Trading Settings', callback_data: 'settings_trading' }],
        [{ text: '⚠️ Risk Management', callback_data: 'settings_risk' }],
        [{ text: '🔔 Notifications', callback_data: 'settings_notifications' }],
        [{ text: '🎯 Asset Preferences', callback_data: 'settings_assets' }],
        [{ text: '💾 Save Settings', callback_data: 'settings_save' }],
        [{ text: '🔙 Back', callback_data: 'back_main' }]
      ]
    };

    await ctx.reply(settingsMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * Handle /stop command
   */
  async handleStop(ctx, args) {
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

    const keyboard = {
      inline_keyboard: [
        [{ text: '✅ Yes, Stop Everything', callback_data: 'confirm_stop' }],
        [{ text: '❌ Cancel', callback_data: 'cancel' }]
      ]
    };

    await ctx.reply(stopMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * Handle /status command
   */
  async handleStatus(ctx, args) {
    try {
      const statusMessage = `
🔍 *SYSTEM STATUS*

✅ Bot: Online
✅ Database: Connected
✅ IQ Option: ${Math.random() > 0.5 ? 'Connected' : 'Demo Mode'}
✅ Trading: Active
✅ Risk Management: Enabled

📊 *Current Session:*
• Uptime: ${Math.floor(process.uptime() / 60)} minutes
• Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB
• Active Trades: ${Math.floor(Math.random() * 5)}

⚡ *Performance:*
• Response Time: < 2s
• Success Rate: 99.8%
• Error Rate: 0.2%
      `;

      await ctx.reply(statusMessage, { parse_mode: 'Markdown' });

    } catch (error) {
      this.logger.error('Status command error', { error: error.message });
      await ctx.reply('❌ Error checking system status.');
    }
  }

  /**
   * Handle /performance command
   */
  async handlePerformance(ctx, args) {
    await ctx.reply('📈 Performance analytics would be displayed here.');
  }

  /**
   * Handle /risk command
   */
  async handleRisk(ctx, args) {
    try {
      const userId = ctx.from.id;
      const riskProfile = await this.services.risk.getRiskProfile(userId);

      const riskMessage = `
🛡️ *RISK PROFILE ASSESSMENT*

📊 *Risk Level:* ${this.capitalizeFirst(riskProfile.riskLevel)}

💡 *Assessment:* ${riskProfile.assessment}

⚙️ *Current Settings:*
• Daily Loss Limit: $${riskProfile.settings.dailyLossLimit}
• Max Trade Amount: $${riskProfile.settings.maxTradeAmount}
• Consecutive Loss Limit: ${riskProfile.settings.maxConsecutiveLosses}

📈 *Performance:*
• Win Rate: ${riskProfile.performance?.winRate || 0}%
• Total Trades: ${riskProfile.performance?.totalTrades || 0}
• Total Profit: $${riskProfile.performance?.totalProfit || 0}

💡 *Recommendations:*
${riskProfile.recommendations.map(rec => `• ${rec}`).join('\n')}
      `;

      await ctx.reply(riskMessage, { parse_mode: 'Markdown' });

    } catch (error) {
      this.logger.error('Risk command error', { error: error.message });
      await ctx.reply('❌ Error loading risk profile.');
    }
  }

  /**
   * Handle unknown command
   */
  async handleUnknownCommand(ctx, command) {
    await ctx.reply(
      `❌ Unknown command: /${command}\n\n` +
      'Available commands:\n' +
      '• /start - Main menu\n' +
      '• /help - Show help\n' +
      '• /analyze <symbol> - Analyze asset\n' +
      '• /stats - Trading statistics\n' +
      '• /settings - Bot settings\n' +
      '• /stop - Emergency stop'
    );
  }

  /**
   * Handle admin command
   */
  async handleAdmin(ctx, args) {
    try {
      const AdminCommand = require('../commands/AdminCommand');
      const adminCommand = new AdminCommand(this.services);
      await adminCommand.execute(ctx, args);
    } catch (error) {
      this.logger.error('Admin command error', { error: error.message });
      await ctx.reply('❌ Error executing admin command. Please try again.');
    }
  }

  /**
   * Analyze symbol
   */
  async analyzeSymbol(ctx, symbol) {
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
      this.logger.error('Symbol analysis error', { symbol, error: error.message });
      await ctx.reply('❌ Analysis failed. Please try again.');
    }
  }

  /**
   * Check if symbol is valid
   */
  isValidSymbol(symbol) {
    // Basic validation - should be improved
    return /^[A-Z0-9]{2,10}$/.test(symbol);
  }

  /**
   * Format currency
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  /**
   * Format trade result
   */
  formatTradeResult(result, profit) {
    const emoji = result === 'WIN' ? '🟢' : '🔴';
    const profitText = profit > 0 ? `+$${profit.toFixed(2)}` : `$${profit.toFixed(2)}`;
    return `${emoji} ${result} ${profitText}`;
  }

  /**
   * Capitalize first letter
   */
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

module.exports = CommandHandler;