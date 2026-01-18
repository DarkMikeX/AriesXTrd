/**
 * Signal Repository
 * Data access layer for Signal model
 */

const Logger = require('../../utils/Logger');

class SignalRepository {
  constructor(database) {
    this.database = database;
    this.Signal = database.getModel('Signal');
    this.logger = Logger.getInstance();
  }

  /**
   * Create new signal
   */
  async create(signalData) {
    try {
      const signal = await this.Signal.create(signalData);
      this.logger.info('Signal created', {
        signalId: signal.id,
        userId: signal.user_id,
        asset: signal.asset_symbol,
        type: signal.signal_type,
        confidence: signal.confidence_score
      });
      return signal;
    } catch (error) {
      this.logger.error('Error creating signal', { signalData, error: error.message });
      throw error;
    }
  }

  /**
   * Find signal by ID
   */
  async findById(signalId) {
    try {
      return await this.Signal.findByPk(signalId, {
        include: [
          {
            model: this.database.getModel('User'),
            as: 'user',
            attributes: ['id', 'telegram_id', 'username']
          }
        ]
      });
    } catch (error) {
      this.logger.error('Error finding signal by ID', { signalId, error: error.message });
      throw error;
    }
  }

  /**
   * Find signals by user ID
   */
  async findByUserId(userId, options = {}) {
    try {
      const {
        status = 'ACTIVE',
        limit = 20,
        offset = 0,
        orderBy = 'created_at',
        orderDir = 'DESC'
      } = options;

      return await this.Signal.findAll({
        where: {
          user_id: userId,
          status: status
        },
        limit,
        offset,
        order: [[orderBy, orderDir]]
      });
    } catch (error) {
      this.logger.error('Error finding signals by user ID', { userId, options, error: error.message });
      throw error;
    }
  }

  /**
   * Find signals by asset
   */
  async findByAsset(assetSymbol, limit = 10) {
    try {
      return await this.Signal.findAll({
        where: {
          asset_symbol: assetSymbol,
          status: 'ACTIVE'
        },
        limit,
        order: [['confidence_score', 'DESC'], ['created_at', 'DESC']]
      });
    } catch (error) {
      this.logger.error('Error finding signals by asset', { assetSymbol, limit, error: error.message });
      throw error;
    }
  }

  /**
   * Update signal
   */
  async update(signalId, updateData) {
    try {
      const [affectedRows] = await this.Signal.update(updateData, {
        where: { id: signalId }
      });

      if (affectedRows > 0) {
        this.logger.info('Signal updated', { signalId, updateData });
        return await this.findById(signalId);
      }

      return null;
    } catch (error) {
      this.logger.error('Error updating signal', { signalId, updateData, error: error.message });
      throw error;
    }
  }

  /**
   * Mark signal as executed
   */
  async markExecuted(signalId) {
    try {
      const signal = await this.Signal.findByPk(signalId);
      if (!signal) return null;

      signal.markExecuted();
      await signal.save();

      this.logger.info('Signal marked as executed', { signalId });
      return signal;
    } catch (error) {
      this.logger.error('Error marking signal as executed', { signalId, error: error.message });
      throw error;
    }
  }

  /**
   * Mark signal as expired
   */
  async markExpired(signalId) {
    try {
      const signal = await this.Signal.findByPk(signalId);
      if (!signal) return null;

      signal.markExpired();
      await signal.save();

      this.logger.info('Signal marked as expired', { signalId });
      return signal;
    } catch (error) {
      this.logger.error('Error marking signal as expired', { signalId, error: error.message });
      throw error;
    }
  }

  /**
   * Get active signals
   */
  async getActiveSignals(limit = 50) {
    try {
      return await this.Signal.findAll({
        where: {
          status: 'ACTIVE',
          expires_at: {
            [this.database.getSequelize().Op.or]: {
              [this.database.getSequelize().Op.gt]: new Date(),
              [this.database.getSequelize().Op.is]: null
            }
          }
        },
        limit,
        order: [['confidence_score', 'DESC'], ['created_at', 'DESC']],
        include: [
          {
            model: this.database.getModel('User'),
            as: 'user',
            attributes: ['telegram_id', 'username']
          }
        ]
      });
    } catch (error) {
      this.logger.error('Error getting active signals', { limit, error: error.message });
      throw error;
    }
  }

  /**
   * Get high confidence signals
   */
  async getHighConfidenceSignals(minConfidence = 80, limit = 20) {
    try {
      return await this.Signal.findAll({
        where: {
          status: 'ACTIVE',
          confidence_score: { [this.database.getSequelize().Op.gte]: minConfidence },
          expires_at: {
            [this.database.getSequelize().Op.or]: {
              [this.database.getSequelize().Op.gt]: new Date(),
              [this.database.getSequelize().Op.is]: null
            }
          }
        },
        limit,
        order: [['confidence_score', 'DESC'], ['created_at', 'DESC']],
        include: [
          {
            model: this.database.getModel('User'),
            as: 'user',
            attributes: ['telegram_id', 'username']
          }
        ]
      });
    } catch (error) {
      this.logger.error('Error getting high confidence signals', { minConfidence, limit, error: error.message });
      throw error;
    }
  }

  /**
   * Get expiring signals
   */
  async getExpiringSignals(hoursFromNow = 1) {
    try {
      const expiryTime = new Date();
      expiryTime.setHours(expiryTime.getHours() + hoursFromNow);

      return await this.Signal.findAll({
        where: {
          status: 'ACTIVE',
          expires_at: {
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
      this.logger.error('Error getting expiring signals', { hoursFromNow, error: error.message });
      throw error;
    }
  }

  /**
   * Get signals by date range
   */
  async getSignalsByDateRange(userId, startDate, endDate, status = null) {
    try {
      const whereClause = {
        user_id: userId,
        created_at: {
          [this.database.getSequelize().Op.between]: [startDate, endDate]
        }
      };

      if (status) {
        whereClause.status = status;
      }

      return await this.Signal.findAll({
        where: whereClause,
        order: [['created_at', 'DESC']]
      });
    } catch (error) {
      this.logger.error('Error getting signals by date range', {
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
   * Get signal statistics
   */
  async getSignalStats(userId, period = 'all') {
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
        }
        whereClause.created_at = { [this.database.getSequelize().Op.gte]: startDate };
      }

      const signals = await this.Signal.findAll({
        where: whereClause,
        attributes: [
          'signal_type',
          [this.database.getSequelize().fn('COUNT', this.database.getSequelize().col('id')), 'count'],
          [this.database.getSequelize().fn('AVG', this.database.getSequelize().col('confidence_score')), 'avg_confidence']
        ],
        group: ['signal_type']
      });

      const total = await this.Signal.count({ where: whereClause });
      const active = await this.Signal.count({
        where: {
          ...whereClause,
          status: 'ACTIVE'
        }
      });

      const executed = await this.Signal.count({
        where: {
          ...whereClause,
          status: 'EXECUTED'
        }
      });

      const result = {
        period,
        total_signals: total,
        active_signals: active,
        executed_signals: executed,
        expired_signals: total - active - executed,
        by_type: {}
      };

      signals.forEach(signal => {
        result.by_type[signal.signal_type] = {
          count: parseInt(signal.dataValues.count),
          avg_confidence: parseFloat(signal.dataValues.avg_confidence || 0).toFixed(2)
        };
      });

      return result;
    } catch (error) {
      this.logger.error('Error getting signal stats', { userId, period, error: error.message });
      throw error;
    }
  }

  /**
   * Get asset signal performance
   */
  async getAssetSignalPerformance(userId) {
    try {
      const assets = await this.Signal.findAll({
        where: { user_id: userId },
        attributes: [
          'asset_symbol',
          'asset_name',
          [this.database.getSequelize().fn('COUNT', this.database.getSequelize().col('id')), 'total_signals'],
          [this.database.getSequelize().fn('AVG', this.database.getSequelize().col('confidence_score')), 'avg_confidence'],
          [this.database.getSequelize().fn('MAX', this.database.getSequelize().col('confidence_score')), 'max_confidence']
        ],
        group: ['asset_symbol', 'asset_name'],
        order: [[this.database.getSequelize().fn('AVG', this.database.getSequelize().col('confidence_score')), 'DESC']]
      });

      return assets.map(asset => ({
        symbol: asset.asset_symbol,
        name: asset.asset_name,
        total_signals: parseInt(asset.dataValues.total_signals),
        avg_confidence: parseFloat(asset.dataValues.avg_confidence || 0).toFixed(2),
        max_confidence: parseInt(asset.dataValues.max_confidence || 0)
      }));
    } catch (error) {
      this.logger.error('Error getting asset signal performance', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Delete signal
   */
  async delete(signalId) {
    try {
      const deleted = await this.Signal.destroy({
        where: { id: signalId }
      });

      if (deleted > 0) {
        this.logger.info('Signal deleted', { signalId });
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Error deleting signal', { signalId, error: error.message });
      throw error;
    }
  }

  /**
   * Bulk create signals
   */
  async bulkCreate(signalsData) {
    try {
      const signals = await this.Signal.bulkCreate(signalsData);
      this.logger.info('Signals bulk created', { count: signals.length });
      return signals;
    } catch (error) {
      this.logger.error('Error bulk creating signals', { signalsData, error: error.message });
      throw error;
    }
  }

  /**
   * Clean expired signals
   */
  async cleanExpiredSignals() {
    try {
      const expiredSignals = await this.Signal.update(
        { status: 'EXPIRED' },
        {
          where: {
            status: 'ACTIVE',
            expires_at: {
              [this.database.getSequelize().Op.lt]: new Date()
            }
          }
        }
      );

      if (expiredSignals[0] > 0) {
        this.logger.info('Expired signals cleaned', { count: expiredSignals[0] });
      }

      return expiredSignals[0];
    } catch (error) {
      this.logger.error('Error cleaning expired signals', { error: error.message });
      throw error;
    }
  }

  /**
   * Get signal success rate by confidence
   */
  async getSignalSuccessRate(userId) {
    try {
      // This would require joining with trades to calculate success rates
      // For now, return basic stats
      const confidenceRanges = await this.Signal.findAll({
        where: { user_id: userId },
        attributes: [
          [this.database.getSequelize().literal(`
            CASE
              WHEN confidence_score >= 90 THEN '90-100'
              WHEN confidence_score >= 80 THEN '80-89'
              WHEN confidence_score >= 70 THEN '70-79'
              WHEN confidence_score >= 60 THEN '60-69'
              ELSE '0-59'
            END
          `), 'confidence_range'],
          [this.database.getSequelize().fn('COUNT', this.database.getSequelize().col('id')), 'count']
        ],
        group: [this.database.getSequelize().literal(`
          CASE
            WHEN confidence_score >= 90 THEN '90-100'
            WHEN confidence_score >= 80 THEN '80-89'
            WHEN confidence_score >= 70 THEN '70-79'
            WHEN confidence_score >= 60 THEN '60-69'
            ELSE '0-59'
          END
        `)]
      });

      const result = {};
      confidenceRanges.forEach(range => {
        result[range.dataValues.confidence_range] = parseInt(range.dataValues.count);
      });

      return result;
    } catch (error) {
      this.logger.error('Error getting signal success rate', { userId, error: error.message });
      throw error;
    }
  }
}

module.exports = SignalRepository;