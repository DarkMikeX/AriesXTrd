/**
 * Order Manager
 * Manages order creation, modification, and tracking
 */

const Logger = require('../utils/Logger');
const ErrorHandler = require('../utils/ErrorHandler');

class OrderManager {
  constructor(database, iqOptionBot) {
    this.database = database;
    this.iqOptionBot = iqOptionBot;
    this.logger = Logger.getInstance();
    this.activeOrders = new Map();
  }

  /**
   * Create new order
   */
  async createOrder(orderData) {
    try {
      const {
        userId,
        asset,
        assetType,
        direction,
        amount,
        expiryMinutes = 5,
        signalData = null
      } = orderData;

      // Validate order data
      const validation = this.validateOrder(orderData);
      if (!validation.valid) {
        throw new Error(`Invalid order: ${validation.errors.join(', ')}`);
      }

      // Create order record
      const order = {
        id: this.generateOrderId(),
        userId,
        asset,
        assetType,
        direction,
        amount,
        expiryMinutes,
        status: 'pending',
        createdAt: new Date(),
        signalData,
        attempts: 0,
        maxAttempts: 3
      };

      // Store in active orders
      this.activeOrders.set(order.id, order);

      this.logger.info('Order created', {
        orderId: order.id,
        userId,
        asset,
        direction,
        amount
      });

      return order;

    } catch (error) {
      this.logger.error('Failed to create order', { error: error.message });
      throw ErrorHandler.handle(error, { service: 'order_manager', operation: 'create_order' });
    }
  }

  /**
   * Execute order
   */
  async executeOrder(orderId) {
    try {
      const order = this.activeOrders.get(orderId);
      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      if (order.status !== 'pending') {
        throw new Error(`Order already processed: ${order.status}`);
      }

      order.attempts++;
      order.status = 'executing';
      order.executedAt = new Date();

      // Execute on IQ Option
      const result = await this.iqOptionBot.placeTrade(
        order.asset,
        order.direction,
        order.amount,
        order.expiryMinutes
      );

      if (result.success) {
        order.status = 'executed';
        order.iqOptionTradeId = result.iqOptionTradeId;
        order.entryPrice = result.entryPrice;
        order.executionTime = new Date();

        // Save to database
        await this.saveOrderToDatabase(order);

        this.logger.info('Order executed successfully', {
          orderId,
          iqOptionTradeId: result.iqOptionTradeId,
          entryPrice: result.entryPrice
        });

        return {
          success: true,
          order,
          iqOptionResult: result
        };

      } else {
        order.status = 'failed';
        order.error = result.message;

        this.logger.error('Order execution failed', {
          orderId,
          error: result.message
        });

        // Retry logic
        if (order.attempts < order.maxAttempts) {
          order.status = 'pending';
          return await this.retryOrder(orderId);
        }

        return {
          success: false,
          order,
          error: result.message
        };
      }

    } catch (error) {
      this.logger.error('Order execution error', { orderId, error: error.message });

      const order = this.activeOrders.get(orderId);
      if (order) {
        order.status = 'error';
        order.error = error.message;
      }

      throw error;
    }
  }

  /**
   * Retry failed order
   */
  async retryOrder(orderId) {
    const order = this.activeOrders.get(orderId);

    if (!order || order.attempts >= order.maxAttempts) {
      return { success: false, error: 'Max retries exceeded' };
    }

    // Wait before retry (exponential backoff)
    const delay = Math.pow(2, order.attempts) * 1000; // 2s, 4s, 8s...
    await new Promise(resolve => setTimeout(resolve, delay));

    this.logger.info('Retrying order', { orderId, attempt: order.attempts });
    return await this.executeOrder(orderId);
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId, reason = 'User cancelled') {
    try {
      const order = this.activeOrders.get(orderId);

      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      if (order.status === 'executed') {
        throw new Error('Cannot cancel executed order');
      }

      order.status = 'cancelled';
      order.cancelledAt = new Date();
      order.cancelReason = reason;

      // Remove from active orders
      this.activeOrders.delete(orderId);

      this.logger.info('Order cancelled', { orderId, reason });
      return order;

    } catch (error) {
      this.logger.error('Order cancellation error', { orderId, error: error.message });
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  getOrder(orderId) {
    return this.activeOrders.get(orderId) || null;
  }

  /**
   * Get orders by user
   */
  getOrdersByUser(userId) {
    const userOrders = [];

    for (const [orderId, order] of this.activeOrders.entries()) {
      if (order.userId === userId) {
        userOrders.push(order);
      }
    }

    return userOrders;
  }

  /**
   * Get active orders count
   */
  getActiveOrdersCount(userId = null) {
    if (userId) {
      return this.getOrdersByUser(userId).filter(order =>
        ['pending', 'executing'].includes(order.status)
      ).length;
    }

    return Array.from(this.activeOrders.values()).filter(order =>
      ['pending', 'executing'].includes(order.status)
    ).length;
  }

  /**
   * Update order status
   */
  updateOrderStatus(orderId, status, additionalData = {}) {
    const order = this.activeOrders.get(orderId);

    if (!order) {
      this.logger.warn('Order not found for status update', { orderId });
      return false;
    }

    const oldStatus = order.status;
    order.status = status;
    order.updatedAt = new Date();

    // Add additional data
    Object.assign(order, additionalData);

    // If order is completed, remove from active orders
    if (['executed', 'failed', 'cancelled', 'expired'].includes(status)) {
      setTimeout(() => {
        this.activeOrders.delete(orderId);
      }, 60000); // Keep for 1 minute after completion
    }

    this.logger.info('Order status updated', {
      orderId,
      oldStatus,
      newStatus: status
    });

    return true;
  }

  /**
   * Save order to database
   */
  async saveOrderToDatabase(order) {
    try {
      if (!this.database) return;

      const Trade = this.database.getModel('Trade');

      const tradeData = {
        user_id: order.userId,
        asset_symbol: order.asset,
        asset_type: order.assetType,
        direction: order.direction,
        amount: order.amount,
        entry_price: order.entryPrice,
        iq_option_trade_id: order.iqOptionTradeId,
        status: 'OPEN',
        entry_time: order.executionTime,
        expiry_minutes: order.expiryMinutes,
        signal_data: order.signalData
      };

      const trade = await Trade.create(tradeData);

      this.logger.info('Order saved to database', {
        orderId: order.id,
        tradeId: trade.id
      });

      return trade;

    } catch (error) {
      this.logger.error('Failed to save order to database', {
        orderId: order.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Validate order data
   */
  validateOrder(orderData) {
    const errors = [];

    if (!orderData.userId) errors.push('User ID required');
    if (!orderData.asset) errors.push('Asset required');
    if (!orderData.assetType) errors.push('Asset type required');
    if (!['CALL', 'PUT'].includes(orderData.direction)) errors.push('Invalid direction');
    if (!orderData.amount || orderData.amount <= 0) errors.push('Invalid amount');
    if (!orderData.expiryMinutes || orderData.expiryMinutes < 1) errors.push('Invalid expiry time');

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate unique order ID
   */
  generateOrderId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `order_${timestamp}_${random}`;
  }

  /**
   * Get order statistics
   */
  getOrderStatistics() {
    const stats = {
      total: this.activeOrders.size,
      pending: 0,
      executing: 0,
      executed: 0,
      failed: 0,
      cancelled: 0
    };

    for (const order of this.activeOrders.values()) {
      stats[order.status] = (stats[order.status] || 0) + 1;
    }

    return stats;
  }

  /**
   * Cleanup old orders
   */
  cleanupOldOrders(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
    const now = Date.now();
    const toRemove = [];

    for (const [orderId, order] of this.activeOrders.entries()) {
      const age = now - order.createdAt.getTime();
      if (age > maxAge) {
        toRemove.push(orderId);
      }
    }

    toRemove.forEach(orderId => {
      this.activeOrders.delete(orderId);
    });

    if (toRemove.length > 0) {
      this.logger.info('Old orders cleaned up', { count: toRemove.length });
    }

    return toRemove.length;
  }

  /**
   * Get pending orders for execution
   */
  getPendingOrders() {
    return Array.from(this.activeOrders.values()).filter(order =>
      order.status === 'pending'
    );
  }

  /**
   * Process pending orders (for batch execution)
   */
  async processPendingOrders() {
    const pendingOrders = this.getPendingOrders();
    const results = [];

    for (const order of pendingOrders) {
      try {
        const result = await this.executeOrder(order.id);
        results.push(result);
      } catch (error) {
        this.logger.error('Batch order processing error', {
          orderId: order.id,
          error: error.message
        });
        results.push({ success: false, orderId: order.id, error: error.message });
      }
    }

    return results;
  }

  /**
   * Export orders for analysis
   */
  exportOrders(userId = null, format = 'json') {
    let orders = Array.from(this.activeOrders.values());

    if (userId) {
      orders = orders.filter(order => order.userId === userId);
    }

    if (format === 'csv') {
      return this.convertOrdersToCSV(orders);
    }

    return orders;
  }

  /**
   * Convert orders to CSV
   */
  convertOrdersToCSV(orders) {
    const headers = ['Order ID', 'User ID', 'Asset', 'Direction', 'Amount', 'Status', 'Created At'];
    const rows = orders.map(order => [
      order.id,
      order.userId,
      order.asset,
      order.direction,
      order.amount,
      order.status,
      order.createdAt.toISOString()
    ]);

    const csv = [headers, ...rows].map(row =>
      row.map(field => `"${field}"`).join(',')
    ).join('\n');

    return csv;
  }
}

module.exports = OrderManager;