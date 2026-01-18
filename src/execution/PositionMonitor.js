/**
 * Position Monitor
 * Monitors open positions and handles position lifecycle
 */

const Logger = require('../utils/Logger');
const ErrorHandler = require('../utils/ErrorHandler');

class PositionMonitor {
  constructor(database, iqOptionBot, notificationService) {
    this.database = database;
    this.iqOptionBot = iqOptionBot;
    this.notificationService = notificationService;
    this.logger = Logger.getInstance();
    this.monitoredPositions = new Map();
    this.monitoringInterval = null;
    this.checkInterval = 10000; // 10 seconds
  }

  /**
   * Start monitoring positions
   */
  startMonitoring() {
    if (this.monitoringInterval) {
      this.logger.warn('Position monitoring already running');
      return;
    }

    this.logger.info('Starting position monitoring');

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkAllPositions();
      } catch (error) {
        this.logger.error('Position monitoring error', { error: error.message });
      }
    }, this.checkInterval);
  }

  /**
   * Stop monitoring positions
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.info('Position monitoring stopped');
    }
  }

  /**
   * Add position to monitoring
   */
  addPosition(tradeId, tradeData) {
    const position = {
      tradeId,
      ...tradeData,
      startTime: new Date(),
      lastCheck: new Date(),
      checkCount: 0,
      expiryTime: new Date(Date.now() + (tradeData.duration || 5) * 60 * 1000)
    };

    this.monitoredPositions.set(tradeId, position);
    this.logger.info('Position added to monitoring', { tradeId, asset: tradeData.asset });
  }

  /**
   * Remove position from monitoring
   */
  removePosition(tradeId) {
    const removed = this.monitoredPositions.delete(tradeId);
    if (removed) {
      this.logger.info('Position removed from monitoring', { tradeId });
    }
    return removed;
  }

  /**
   * Check all monitored positions
   */
  async checkAllPositions() {
    const positions = Array.from(this.monitoredPositions.values());
    const now = new Date();

    for (const position of positions) {
      try {
        await this.checkPosition(position, now);
      } catch (error) {
        this.logger.error('Position check error', {
          tradeId: position.tradeId,
          error: error.message
        });
      }
    }
  }

  /**
   * Check individual position
   */
  async checkPosition(position, currentTime) {
    position.lastCheck = currentTime;
    position.checkCount++;

    // Check if position has expired
    if (currentTime >= position.expiryTime) {
      await this.handlePositionExpiry(position);
      return;
    }

    // Get current price
    try {
      const currentPrice = await this.getCurrentPrice(position.asset, position.assetType);

      if (currentPrice) {
        position.currentPrice = currentPrice;
        position.priceChange = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

        // Update position in database
        await this.updatePositionInDatabase(position);

        // Check for alerts
        await this.checkPositionAlerts(position);
      }

    } catch (error) {
      this.logger.error('Failed to get current price', {
        tradeId: position.tradeId,
        asset: position.asset,
        error: error.message
      });
    }
  }

  /**
   * Handle position expiry
   */
  async handlePositionExpiry(position) {
    try {
      this.logger.info('Position expired, checking final result', {
        tradeId: position.tradeId,
        asset: position.asset
      });

      // Get final price
      const finalPrice = position.currentPrice || await this.getCurrentPrice(position.asset, position.assetType);

      if (!finalPrice) {
        this.logger.error('Could not get final price for expired position', {
          tradeId: position.tradeId
        });
        return;
      }

      // Determine result
      const priceMovement = finalPrice - position.entryPrice;
      const isWin = (position.direction === 'CALL' && priceMovement > 0) ||
                   (position.direction === 'PUT' && priceMovement < 0);

      const payoutRate = 0.95; // 95% payout for demo
      const profit = isWin ? position.amount * payoutRate : -position.amount;

      // Update position in database
      await this.finalizePosition(position, {
        exitPrice: finalPrice,
        result: isWin ? 'WIN' : 'LOSS',
        profit,
        closeTime: new Date()
      });

      // Send notification
      await this.sendPositionResultNotification(position, {
        result: isWin ? 'WIN' : 'LOSS',
        profit,
        exitPrice: finalPrice
      });

      // Remove from monitoring
      this.removePosition(position.tradeId);

      this.logger.info('Position finalized', {
        tradeId: position.tradeId,
        result: isWin ? 'WIN' : 'LOSS',
        profit
      });

    } catch (error) {
      this.logger.error('Position expiry handling error', {
        tradeId: position.tradeId,
        error: error.message
      });
    }
  }

  /**
   * Get current price for asset
   */
  async getCurrentPrice(asset, assetType) {
    try {
      // This would integrate with price feeds
      // For now, simulate price movement
      const basePrice = 100; // Mock base price
      const volatility = 0.02; // 2% volatility
      const randomChange = (Math.random() - 0.5) * 2 * volatility;

      return basePrice * (1 + randomChange);
    } catch (error) {
      this.logger.error('Price fetch error', { asset, assetType, error: error.message });
      return null;
    }
  }

  /**
   * Update position in database
   */
  async updatePositionInDatabase(position) {
    try {
      if (!this.database) return;

      const Trade = this.database.getModel('Trade');
      await Trade.update({
        current_price: position.currentPrice,
        price_change_percent: position.priceChange,
        last_checked_at: position.lastCheck
      }, {
        where: { id: position.tradeId }
      });

    } catch (error) {
      this.logger.error('Database update error', {
        tradeId: position.tradeId,
        error: error.message
      });
    }
  }

  /**
   * Finalize position in database
   */
  async finalizePosition(position, finalData) {
    try {
      if (!this.database) return;

      const Trade = this.database.getModel('Trade');
      await Trade.update({
        status: 'CLOSED',
        exit_price: finalData.exitPrice,
        result: finalData.result,
        profit_loss: finalData.profit,
        close_time: finalData.closeTime
      }, {
        where: { id: position.tradeId }
      });

    } catch (error) {
      this.logger.error('Position finalization error', {
        tradeId: position.tradeId,
        error: error.message
      });
    }
  }

  /**
   * Check for position alerts
   */
  async checkPositionAlerts(position) {
    const alertsTriggered = [];

    // Price movement alerts
    if (Math.abs(position.priceChange) > 5) {
      alertsTriggered.push('significant_movement');
    }

    // Time-based alerts
    const timeRemaining = position.expiryTime - new Date();
    const minutesRemaining = timeRemaining / (1000 * 60);

    if (minutesRemaining <= 1) {
      alertsTriggered.push('expiring_soon');
    }

    // Send alerts if any triggered
    for (const alertType of alertsTriggered) {
      await this.sendPositionAlert(position, alertType);
    }
  }

  /**
   * Send position alert
   */
  async sendPositionAlert(position, alertType) {
    try {
      let message = '';

      switch (alertType) {
        case 'significant_movement':
          message = `📊 *POSITION ALERT*

${position.asset} ${position.direction}
Price Change: ${position.priceChange?.toFixed(2)}%
Current: $${position.currentPrice?.toFixed(2)}

${position.priceChange > 0 ? '📈 Price moving up' : '📉 Price moving down'}`;
          break;

        case 'expiring_soon':
          message = `⏰ *POSITION EXPIRING*

${position.asset} ${position.direction}
Expires in: < 1 minute
Current P&L: ${position.priceChange?.toFixed(2)}%

Position will close automatically.`;
          break;
      }

      if (message && this.notificationService) {
        await this.notificationService.sendTradeUpdate(position.userId, {
          tradeId: position.tradeId,
          alertType,
          message
        });
      }

    } catch (error) {
      this.logger.error('Position alert error', {
        tradeId: position.tradeId,
        alertType,
        error: error.message
      });
    }
  }

  /**
   * Send position result notification
   */
  async sendPositionResultNotification(position, result) {
    try {
      if (!this.notificationService) return;

      await this.notificationService.sendTradeResult(position.userId, {
        ...position,
        ...result
      });

    } catch (error) {
      this.logger.error('Result notification error', {
        tradeId: position.tradeId,
        error: error.message
      });
    }
  }

  /**
   * Get monitored positions
   */
  getMonitoredPositions(userId = null) {
    const positions = Array.from(this.monitoredPositions.values());

    if (userId) {
      return positions.filter(pos => pos.userId === userId);
    }

    return positions;
  }

  /**
   * Get position statistics
   */
  getPositionStatistics() {
    const positions = Array.from(this.monitoredPositions.values());
    const stats = {
      total: positions.length,
      byAsset: {},
      byDirection: { CALL: 0, PUT: 0 },
      expiringSoon: 0,
      avgPriceChange: 0
    };

    let totalPriceChange = 0;

    positions.forEach(pos => {
      // Count by asset
      stats.byAsset[pos.asset] = (stats.byAsset[pos.asset] || 0) + 1;

      // Count by direction
      stats.byDirection[pos.direction]++;

      // Check if expiring soon
      const timeRemaining = pos.expiryTime - new Date();
      if (timeRemaining < 60000) { // 1 minute
        stats.expiringSoon++;
      }

      // Accumulate price change
      if (pos.priceChange) {
        totalPriceChange += pos.priceChange;
      }
    });

    stats.avgPriceChange = positions.length > 0 ? totalPriceChange / positions.length : 0;

    return stats;
  }

  /**
   * Force close position
   */
  async forceClosePosition(tradeId, reason = 'Manual close') {
    const position = this.monitoredPositions.get(tradeId);

    if (!position) {
      throw new Error(`Position not found: ${tradeId}`);
    }

    // Get current price
    const currentPrice = position.currentPrice || await this.getCurrentPrice(position.asset, position.assetType);

    if (!currentPrice) {
      throw new Error('Could not get current price for force close');
    }

    // Calculate result
    const priceMovement = currentPrice - position.entryPrice;
    const isWin = (position.direction === 'CALL' && priceMovement > 0) ||
                 (position.direction === 'PUT' && priceMovement < 0);

    const profit = isWin ? position.amount * 0.95 : -position.amount;

    // Finalize position
    await this.finalizePosition(position, {
      exitPrice: currentPrice,
      result: isWin ? 'WIN' : 'LOSS',
      profit,
      closeTime: new Date(),
      notes: reason
    });

    // Send notification
    await this.sendPositionResultNotification(position, {
      result: isWin ? 'WIN' : 'LOSS',
      profit,
      exitPrice: currentPrice
    });

    // Remove from monitoring
    this.removePosition(tradeId);

    this.logger.info('Position force closed', {
      tradeId,
      reason,
      result: isWin ? 'WIN' : 'LOSS',
      profit
    });

    return {
      success: true,
      result: isWin ? 'WIN' : 'LOSS',
      profit,
      exitPrice: currentPrice
    };
  }

  /**
   * Cleanup expired positions
   */
  cleanupExpiredPositions() {
    const now = new Date();
    const toRemove = [];

    for (const [tradeId, position] of this.monitoredPositions.entries()) {
      if (now > position.expiryTime) {
        toRemove.push(tradeId);
      }
    }

    toRemove.forEach(tradeId => this.removePosition(tradeId));

    if (toRemove.length > 0) {
      this.logger.info('Expired positions cleaned up', { count: toRemove.length });
    }

    return toRemove.length;
  }

  /**
   * Get position summary for user
   */
  getPositionSummary(userId) {
    const userPositions = this.getMonitoredPositions(userId);

    return {
      total: userPositions.length,
      byDirection: userPositions.reduce((acc, pos) => {
        acc[pos.direction] = (acc[pos.direction] || 0) + 1;
        return acc;
      }, {}),
      expiringSoon: userPositions.filter(pos => {
        const timeRemaining = pos.expiryTime - new Date();
        return timeRemaining < 300000; // 5 minutes
      }).length,
      totalExposure: userPositions.reduce((sum, pos) => sum + pos.amount, 0)
    };
  }
}

module.exports = PositionMonitor;