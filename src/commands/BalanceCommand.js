/**
 * Balance Command
 * Handles the /balance command to check account balance
 */

const Logger = require('../utils/Logger');

class BalanceCommand {
  constructor(services) {
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Execute the balance command
   */
  async execute(ctx, args) {
    try {
      const userId = ctx.from.id;

      // Get user balance info (mock data for now)
      const balanceInfo = await this.getBalanceInfo(userId);

      const balanceMessage = `
💼 *ACCOUNT BALANCE*

💰 Current Balance: ${this.formatCurrency(balanceInfo.balance)}
📈 Today's P&L: ${this.formatCurrency(balanceInfo.todayPnL)}
📊 Available for Trading: ${this.formatCurrency(balanceInfo.available)}

━━━━━━━━━━━━━━━━━━━━━━━
💳 IQ Option Account
━━━━━━━━━━━━━━━━━━━━━━━
• Account Type: ${balanceInfo.accountType}
• Status: ${balanceInfo.status}
• Last Updated: ${balanceInfo.lastUpdated}

⚠️ *Risk Management:*
• Daily Loss Limit: ${this.formatCurrency(balanceInfo.dailyLossLimit)}
• Daily Profit Target: ${this.formatCurrency(balanceInfo.dailyProfitTarget)}
• Max Trade Amount: ${this.formatCurrency(balanceInfo.maxTradeAmount)}
      `;

      await ctx.reply(balanceMessage, { parse_mode: 'Markdown' });

    } catch (error) {
      this.logger.error('Balance command error', { error: error.message });
      await ctx.reply('❌ Error loading balance. Please try again.');
    }
  }

  /**
   * Get balance information
   */
  async getBalanceInfo(userId) {
    // Mock balance data - in production, integrate with IQ Option API
    const mockBalance = 1250.75;
    const todayPnL = Math.floor((Math.random() - 0.5) * 100 * 100) / 100; // -50 to +50

    return {
      balance: mockBalance,
      todayPnL,
      available: mockBalance,
      accountType: 'REAL',
      status: 'Active',
      lastUpdated: new Date().toLocaleString(),
      dailyLossLimit: 50,
      dailyProfitTarget: 100,
      maxTradeAmount: 20
    };
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
}

module.exports = BalanceCommand;