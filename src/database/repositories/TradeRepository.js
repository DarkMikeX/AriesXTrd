/**
 * Trade Repository
 * Data access layer for Trade model
 */

const Logger = require('../../utils/Logger');

class TradeRepository {
  constructor(database) {
    this.database = database;
    this.Trade = database.getModel('Trade');
    this.logger = Logger.getInstance();
  }

  /**
   * Create new trade
   */
  async create(tradeData) {
    try {
      const trade = await this.Trade.create(tradeData);
      this.logger.info('Trade created', {
        tradeId: trade.id,
        userId: trade.user_id,
        asset: trade.asset_symbol,
        type: trade.direction,
        amount: trade.amount
      });
      return trade;
    } catch (error) {
      this.logger.error('Error creating trade', { tradeData, error: error.message });
      throw error;
    }
  }

  /**
   * Find trade by ID
   */
  async findById(tradeId) {
    try {
      return await this.Trade.findByPk(tradeId, {
        include: [
          {
            model: this.database.getModel('User'),
            as: 'user',
            attributes: ['id', 'telegram_id', 'username']
          },
          {
            model: this.database.getModel('Signal'),
            as: 'signal',
            attributes: ['id', 'confidence_score', 'signal_type']
          }
        ]
      });
    } catch (error) {
      this.logger.error('Error finding trade by ID', { tradeId, error: error.message });
      throw error;
    }
  }

  /**
   * Find trades by user ID
   */
  async findByUserId(userId, options = {}) {
    try {
      const {
        status = null,
        limit = 50,
        offset = 0,
        orderBy = 'created_at',
        orderDir = 'DESC'
      } = options;

      const whereClause = { user_id: userId };
      if (status) {
        whereClause.status = status;
      }

      return await this.Trade.findAll({
        where: whereClause,
        include: [
          {
            model: this.database.getModel('Signal'),
            as: 'signal',
            attributes: ['id', 'confidence_score', 'signal_type'],
            required: false
          }
        ],
        limit,
        offset,
        order: [[orderBy, orderDir]]
      });
    } catch (error) {
      this.logger.error('Error finding trades by user ID', { userId, options, error: error.message });
      throw error;
    }
  }

  /**
   * Update trade
   */
  async update(tradeId, updateData) {
    try {
      const [affectedRows] = await this.Trade.update(updateData, {
        where: { id: tradeId }
      });

      if (affectedRows > 0) {
        this.logger.info('Trade updated', { tradeId, updateData });
        return await this.findById(tradeId);
      }

      return null;
    } catch (error) {
      this.logger.error('Error updating trade', { tradeId, updateData, error: error.message });
      throw error;
    }
  }

  /**
   * Update trade result
   */
  async updateResult(tradeId, exitPrice, result) {
    try {
      const trade = await this.Trade.findByPk(tradeId);
      if (!trade) return null;

      trade.updateResult(exitPrice, result);
      await trade.save();

      this.logger.info('Trade result updated', {
        tradeId,
        result,
        profit: trade.profit_loss
      });

      return trade;
    } catch (error) {
      this.logger.error('Error updating trade result', { tradeId, exitPrice, result, error: error.message });
      throw error;
    }
  }

  /**
   * Close trade
   */
  async closeTrade(tradeId, exitPrice, result, profit) {
    try {
      const trade = await this.Trade.findByPk(tradeId);
      if (!trade) return null;

      trade.status = 'CLOSED';
      trade.exit_price = exitPrice;
      trade.result = result;
      trade.profit_loss = profit;
      trade.exit_time = new Date();
      trade.updated_at = new Date();

      await trade.save();

      this.logger.info('Trade closed', {
        tradeId,
        result,
        profit,
        asset: trade.asset_symbol
      });

      return trade;
    } catch (error) {
      this.logger.error('Error closing trade', { tradeId, exitPrice, result, profit, error: error.message });
      throw error;
    }
  }

  /**
   * Get open trades for user
   */
  async getOpenTrades(userId) {
    try {
      return await this.Trade.findAll({
        where: {
          user_id: userId,
          status: 'OPEN'
        },
        order: [['entry_time', 'ASC']]
      });
    } catch (error) {
      this.logger.error('Error getting open trades', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get trades by date range
   */
  async getTradesByDateRange(userId, startDate, endDate, status = null) {
    try {
      const whereClause = {
        user_id: userId,
        entry_time: {
          [this.database.getSequelize().Op.between]: [startDate, endDate]
        }
      };

      if (status) {
        whereClause.status = status;
      }

      return await this.Trade.findAll({
        where: whereClause,
        order: [['entry_time', 'DESC']]
      });
    } catch (error) {
      this.logger.error('Error getting trades by date range', {
        userId,
        startDate,
        endDate,
        status,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get trades by asset
   */
  async getTradesByAsset(userId, assetSymbol, limit = 20) {
    try {
      return await this.Trade.findAll({
        where: {
          user_id: userId,
          asset_symbol: assetSymbol
        },
        limit,
        order: [['entry_time', 'DESC']]
      });
    } catch (error) {
      this.logger.error('Error getting trades by asset', { userId, assetSymbol, limit, error: error.message });
      throw error;
    }
  }

  /**
   * Get trade statistics
   */
  async getTradeStats(userId, period = 'all') {
    try {
      let whereClause = { user_id: userId };

      if (period !== 'all') {
        const startDate = new Date();
        switch (period) {
          case 'today':
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            startDate.setDate(startDate.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(startDate.getMonth() - 1);
            break;
          case 'year':
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
        }
        whereClause.entry_time = { [this.database.getSequelize().Op.gte]: startDate };
      }

      const trades = await this.Trade.findAll({
        where: whereClause,
        attributes: [
          'result',
          [this.database.getSequelize().fn('COUNT', this.database.getSequelize().col('id')), 'count'],
          [this.database.getSequelize().fn('SUM', this.database.getSequelize().col('profit_loss')), 'total_profit']
        ],
        group: ['result']
      });

      let totalTrades = 0;
      let wins = 0;
      let losses = 0;
      let totalProfit = 0;

      trades.forEach(trade => {
        const count = parseInt(trade.dataValues.count);
        const profit = parseFloat(trade.dataValues.total_profit || 0);

        totalTrades += count;
        totalProfit += profit;

        if (trade.result === 'WIN') wins += count;
        if (trade.result === 'LOSS') losses += count;
      });

      const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(2) : 0;

      return {
        period,
        total_trades: totalTrades,
        wins,
        losses,
        win_rate: winRate,
        total_profit: totalProfit.toFixed(2),
        avg_trade: totalTrades > 0 ? (totalProfit / totalTrades).toFixed(2) : 0
      };
    } catch (error) {
      this.logger.error('Error getting trade stats', { userId, period, error: error.message });
      throw error;
    }
  }

  /**
   * Get asset performance
   */
  async getAssetPerformance(userId) {
    try {
      const assets = await this.Trade.findAll({
        where: { user_id: userId },
        attributes: [
          'asset_symbol',
          'asset_name',
          [this.database.getSequelize().fn('COUNT', this.database.getSequelize().col('id')), 'total_trades'],
          [this.database.getSequelize().fn('SUM',
            this.database.getSequelize().literal('CASE WHEN result = "WIN" THEN 1 ELSE 0 END')
          ), 'wins'],
          [this.database.getSequelize().fn('AVG', this.database.getSequelize().col('profit_loss')), 'avg_profit']
        ],
        group: ['asset_symbol', 'asset_name'],
        order: [[this.database.getSequelize().fn('AVG', this.database.getSequelize().col('profit_loss')), 'DESC']]
      });

      return assets.map(asset => ({
        symbol: asset.asset_symbol,
        name: asset.asset_name,
        total_trades: parseInt(asset.dataValues.total_trades),
        wins: parseInt(asset.dataValues.wins || 0),
        win_rate: parseInt(asset.dataValues.total_trades) > 0 ?
          ((parseInt(asset.dataValues.wins || 0) / parseInt(asset.dataValues.total_trades)) * 100).toFixed(2) : 0,
        avg_profit: parseFloat(asset.dataValues.avg_profit || 0).toFixed(2)
      }));
    } catch (error) {
      this.logger.error('Error getting asset performance', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get trades count by status
   */
  async getTradesCountByStatus(userId) {
    try {
      const counts = await this.Trade.findAll({
        where: { user_id: userId },
        attributes: [
          'status',
          [this.database.getSequelize().fn('COUNT', this.database.getSequelize().col('id')), 'count']
        ],
        group: ['status']
      });

      const result = { OPEN: 0, CLOSED: 0, CANCELLED: 0, EXPIRED: 0 };
      counts.forEach(count => {
        result[count.status] = parseInt(count.dataValues.count);
      });

      return result;
    } catch (error) {
      this.logger.error('Error getting trades count by status', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Delete trade
   */
  async delete(tradeId) {
    try {
      const deleted = await this.Trade.destroy({
        where: { id: tradeId }
      });

      if (deleted > 0) {
        this.logger.info('Trade deleted', { tradeId });
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Error deleting trade', { tradeId, error: error.message });
      throw error;
    }
  }

  /**
   * Get expiring trades
   */
  async getExpiringTrades(minutesFromNow = 5) {
    try {
      const expiryTime = new Date();
      expiryTime.setMinutes(expiryTime.getMinutes() + minutesFromNow);

      return await this.Trade.findAll({
        where: {
          status: 'OPEN',
          expiry_time: {
            [this.database.getSequelize().Op.lte]: expiryTime,
            [this.database.getSequelize().Op.gt]: new Date()
          }
        },
        include: [
          {
            model: this.database.getModel('User'),
            as: 'user',
            attributes: ['telegram_id', 'username']
          }
        ]
      });
    } catch (error) {
      this.logger.error('Error getting expiring trades', { minutesFromNow, error: error.message });
      throw error;
    }
  }

  /**
   * Bulk update trade results (for expired trades)
   */
  async bulkUpdateResults(tradeUpdates) {
    try {
      const results = [];

      for (const update of tradeUpdates) {
        const trade = await this.updateResult(update.tradeId, update.exitPrice, update.result);
        results.push(trade);
      }

      this.logger.info('Bulk trade results updated', { count: results.length });
      return results;
    } catch (error) {
      this.logger.error('Error in bulk update results', { tradeUpdates, error: error.message });
      throw error;
    }
  }
}

module.exports = TradeRepository;