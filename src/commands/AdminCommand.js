/**
 * Admin Command Handler
 * Handles admin-only commands
 */

const Logger = require('../utils/Logger');

class AdminCommand {
  constructor(services) {
    this.services = services;
    this.logger = Logger.getInstance();
    this.adminId = process.env.TELEGRAM_ADMIN_ID ? parseInt(process.env.TELEGRAM_ADMIN_ID) : null;
  }

  /**
   * Check if user is admin
   */
  isAdmin(userId) {
    return this.adminId && userId === this.adminId;
  }

  /**
   * Execute admin command
   */
  async execute(ctx, args) {
    const userId = ctx.from.id;

    if (!this.isAdmin(userId)) {
      await ctx.reply('❌ This command is only available to administrators.');
      return;
    }

    const command = args[0];

    switch (command) {
      case 'broadcast':
        await this.handleBroadcast(ctx, args.slice(1));
        break;
      case 'stats':
        await this.handleStats(ctx);
        break;
      case 'users':
        await this.handleUsers(ctx);
        break;
      case 'reset':
        await this.handleReset(ctx, args[1]);
        break;
      case 'signal':
        await this.handleSignalTest(ctx, args.slice(1));
        break;
      default:
        await this.showHelp(ctx);
    }
  }

  /**
   * Show admin help
   */
  async showHelp(ctx) {
    const message = `🔐 *Admin Commands*

*Available Commands:*

\`/admin broadcast <message>\` - Broadcast message to all users
\`/admin stats\` - Show bot statistics
\`/admin users\` - List all bot users
\`/admin reset <type>\` - Reset statistics/data
\`/admin signal <symbol> <type>\` - Test signal generation

*Usage:*
\`/admin <command> [args]\``;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  }

  /**
   * Handle broadcast command
   */
  async handleBroadcast(ctx, args) {
    if (args.length === 0) {
      await ctx.reply('❌ Please provide a message to broadcast.\nUsage: `/admin broadcast Your message here`', { parse_mode: 'Markdown' });
      return;
    }

    const message = args.join(' ');
    await ctx.reply(`⏳ Broadcasting message to all users...`);

    try {
      const userService = this.services.userService;
      if (!userService || !userService.database) {
        throw new Error('User service not available');
      }

      const User = userService.database.getModel('User');
      const users = await User.findAll({ attributes: ['telegram_id'] });

      let successCount = 0;
      let failCount = 0;

      for (const user of users) {
        try {
          await ctx.telegram.sendMessage(user.telegram_id, `📢 *Admin Broadcast*\n\n${message}`, { parse_mode: 'Markdown' });
          successCount++;
          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          failCount++;
          this.logger.warn('Failed to send broadcast to user', { userId: user.telegram_id, error: error.message });
        }
      }

      await ctx.reply(`✅ Broadcast completed!\n\n📊 *Results:*\n✅ Sent: ${successCount}\n❌ Failed: ${failCount}`, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error('Broadcast failed', { error: error.message });
      await ctx.reply(`❌ Broadcast failed: ${error.message}`);
    }
  }

  /**
   * Handle stats command
   */
  async handleStats(ctx) {
    try {
      const database = this.services.database;
      if (!database) {
        throw new Error('Database not available');
      }

      const User = database.getModel('User');
      const Trade = database.getModel('Trade');
      const Signal = database.getModel('Signal');

      const [userCount, tradeCount, signalCount] = await Promise.all([
        User.count(),
        Trade.count(),
        Signal.count()
      ]);

      const winTrades = await Trade.count({ where: { result: 'win' } });
      const lossTrades = await Trade.count({ where: { result: 'loss' } });
      const winRate = tradeCount > 0 ? ((winTrades / tradeCount) * 100).toFixed(2) : 0;

      const message = `📊 *Bot Statistics*

👥 *Users:* ${userCount}
📈 *Trades:* ${tradeCount}
📡 *Signals:* ${signalCount}
✅ *Win Rate:* ${winRate}%

*Trade Breakdown:*
✅ Wins: ${winTrades}
❌ Losses: ${lossTrades}`;

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error('Error getting stats', { error: error.message });
      await ctx.reply(`❌ Error getting statistics: ${error.message}`);
    }
  }

  /**
   * Handle users command
   */
  async handleUsers(ctx) {
    try {
      const userService = this.services.userService;
      if (!userService || !userService.database) {
        throw new Error('User service not available');
      }

      const User = userService.database.getModel('User');
      const users = await User.findAll({
        attributes: ['id', 'telegram_id', 'username', 'created_at'],
        order: [['created_at', 'DESC']],
        limit: 20
      });

      if (users.length === 0) {
        await ctx.reply('No users found.');
        return;
      }

      let message = `👥 *Recent Users* (Last 20)\n\n`;
      users.forEach((user, index) => {
        message += `${index + 1}. @${user.username || 'N/A'} (ID: ${user.telegram_id})\n`;
      });

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error('Error getting users', { error: error.message });
      await ctx.reply(`❌ Error getting users: ${error.message}`);
    }
  }

  /**
   * Handle reset command
   */
  async handleReset(ctx, type) {
    if (!type) {
      await ctx.reply('❌ Please specify what to reset.\nUsage: `/admin reset <stats|trades|signals>`', { parse_mode: 'Markdown' });
      return;
    }

    await ctx.reply(`⚠️ Reset functionality not implemented yet. Type: ${type}`);
  }

  /**
   * Handle signal test command
   */
  async handleSignalTest(ctx, args) {
    if (args.length < 2) {
      await ctx.reply('❌ Usage: `/admin signal <symbol> <type>`\nExample: `/admin signal AAPL stock`', { parse_mode: 'Markdown' });
      return;
    }

    const [symbol, type] = args;
    await ctx.reply(`⏳ Testing signal generation for ${symbol} (${type})...`);

    try {
      const analysisService = this.services.analysisService;
      if (!analysisService) {
        throw new Error('Analysis service not available');
      }

      const result = await analysisService.analyzeAsset(symbol, {
        assetType: type,
        timeframe: '1H'
      });

      const message = `📊 *Signal Test Results*

*Symbol:* ${symbol}
*Type:* ${type}
*Signal:* ${result.signal.signal}
*Confidence:* ${result.signal.confidence}%
*Timeframe:* ${result.timeframe || '1H'}

*Indicators:*
${Object.entries(result.indicators || {}).map(([key, val]) => `• ${key}: ${JSON.stringify(val)}`).join('\n')}`;

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error('Signal test failed', { error: error.message });
      await ctx.reply(`❌ Signal test failed: ${error.message}`);
    }
  }
}

module.exports = AdminCommand;
