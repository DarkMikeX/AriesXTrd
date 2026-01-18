/**
 * Trading Integration Tests
 */

const TradeExecutor = require('../../src/execution/TradeExecutor');
const IQOptionBot = require('../../src/execution/IQOptionBot');

describe('Trading Integration', () => {
  let tradeExecutor;
  let mockServices;

  beforeEach(() => {
    mockServices = {
      database: {
        getModel: jest.fn().mockReturnValue({
          create: jest.fn(),
          update: jest.fn(),
          findByPk: jest.fn()
        })
      },
      trading: {
        executeTradeOnIQOption: jest.fn()
      },
      monitor: {
        startMonitoringTrade: jest.fn()
      },
      notification: {
        sendTradeConfirmation: jest.fn()
      },
      user: {
        updateTradingStats: jest.fn()
      },
      risk: {
        checkTradeEligibility: jest.fn(),
        validatePositionSize: jest.fn()
      }
    };

    tradeExecutor = new TradeExecutor(mockServices);
  });

  test('should initialize trade executor', async () => {
    await tradeExecutor.initialize();
    expect(tradeExecutor.isInitialized).toBe(true);
  });

  test('should execute trade successfully', async () => {
    // Mock successful trade execution
    mockServices.risk.checkTradeEligibility.mockResolvedValue({
      isEligible: true
    });

    mockServices.risk.validatePositionSize.mockReturnValue({
      valid: true
    });

    mockServices.trading.executeTradeOnIQOption.mockResolvedValue({
      success: true,
      iqOptionTradeId: 'IQ123456',
      entryPrice: 175.50
    });

    mockServices.database.getModel.mockReturnValue({
      create: jest.fn().mockResolvedValue({
        id: 1,
        user_id: 123,
        asset_symbol: 'AAPL'
      })
    });

    const tradeRequest = {
      userId: 123,
      asset: 'AAPL',
      direction: 'CALL',
      amount: 5,
      expiryMinutes: 5
    };

    const result = await tradeExecutor.executeTrade(tradeRequest);

    expect(result.success).toBe(true);
    expect(result.trade).toBeDefined();
    expect(result.executionResult.success).toBe(true);
    expect(mockServices.monitor.startMonitoringTrade).toHaveBeenCalled();
    expect(mockServices.notification.sendTradeConfirmation).toHaveBeenCalled();
  });

  test('should reject invalid trade request', async () => {
    const invalidRequest = {
      userId: 123,
      asset: '', // Invalid asset
      direction: 'INVALID', // Invalid direction
      amount: -5 // Invalid amount
    };

    await expect(tradeExecutor.executeTrade(invalidRequest)).rejects.toThrow();
  });

  test('should handle risk check failure', async () => {
    mockServices.risk.checkTradeEligibility.mockResolvedValue({
      isEligible: false,
      reason: 'Daily loss limit exceeded'
    });

    const tradeRequest = {
      userId: 123,
      asset: 'AAPL',
      direction: 'CALL',
      amount: 5
    };

    const result = await tradeExecutor.executeTrade(tradeRequest);
    expect(result.success).toBe(false);
  });

  test('should handle IQ Option execution failure', async () => {
    mockServices.risk.checkTradeEligibility.mockResolvedValue({
      isEligible: true
    });

    mockServices.trading.executeTradeOnIQOption.mockResolvedValue({
      success: false,
      error: 'Insufficient balance'
    });

    const tradeRequest = {
      userId: 123,
      asset: 'AAPL',
      direction: 'CALL',
      amount: 5
    };

    const result = await tradeExecutor.executeTrade(tradeRequest);
    expect(result.success).toBe(false);
    expect(result.executionResult.success).toBe(false);
  });

  test('should cancel trade', async () => {
    mockServices.database.getModel.mockReturnValue({
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        user_id: 123,
        status: 'OPEN',
        iq_option_trade_id: 'IQ123456'
      }),
      update: jest.fn()
    });

    const result = await tradeExecutor.cancelTrade(1, 123, 'User cancelled');

    expect(result.success).toBe(true);
    expect(result.trade.status).toBe('CANCELLED');
  });

  test('should reject cancellation of executed trade', async () => {
    mockServices.database.getModel.mockReturnValue({
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        user_id: 123,
        status: 'CLOSED'
      })
    });

    await expect(tradeExecutor.cancelTrade(1, 123)).rejects.toThrow('Cannot cancel executed trade');
  });

  test('should execute batch trades', async () => {
    mockServices.risk.checkTradeEligibility.mockResolvedValue({
      isEligible: true
    });

    mockServices.trading.executeTradeOnIQOption.mockResolvedValue({
      success: true,
      iqOptionTradeId: 'IQ123456',
      entryPrice: 175.50
    });

    mockServices.database.getModel.mockReturnValue({
      create: jest.fn().mockResolvedValue({
        id: 1,
        user_id: 123
      })
    });

    const tradeRequests = [
      {
        userId: 123,
        asset: 'AAPL',
        direction: 'CALL',
        amount: 5
      },
      {
        userId: 123,
        asset: 'TSLA',
        direction: 'PUT',
        amount: 10
      }
    ];

    const results = await tradeExecutor.executeBatchTrades(tradeRequests);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
  });

  test('should validate trade request', async () => {
    const validRequest = {
      userId: 123,
      asset: 'AAPL',
      direction: 'CALL',
      amount: 5
    };

    let error;
    try {
      await tradeExecutor.validateTradeRequest(validRequest);
    } catch (e) {
      error = e;
    }

    expect(error).toBeUndefined();

    // Test invalid request
    const invalidRequest = {
      userId: null,
      asset: '',
      direction: 'INVALID',
      amount: 0
    };

    try {
      await tradeExecutor.validateTradeRequest(invalidRequest);
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.message).toContain('Validation failed');
  });

  test('should get trade execution statistics', () => {
    const stats = tradeExecutor.getExecutionStatistics();

    expect(stats).toHaveProperty('status');
    expect(stats).toHaveProperty('pendingTrades');
    expect(stats).toHaveProperty('activeTrades');
    expect(stats).toHaveProperty('lastExecutionTime');
  });

  test('should cleanup resources', async () => {
    await tradeExecutor.cleanup();
    expect(tradeExecutor.isInitialized).toBeDefined();
  });
});

describe('IQ Option Bot', () => {
  let iqOptionBot;

  beforeEach(() => {
    // Mock IQ Option credentials
    iqOptionBot = new IQOptionBot('test@example.com', 'testpassword');
  });

  test('should initialize IQ Option bot', async () => {
    await iqOptionBot.initialize();
    expect(iqOptionBot.browser).toBeDefined();
  });

  test('should validate credentials format', () => {
    expect(iqOptionBot.email).toBe('test@example.com');
    expect(iqOptionBot.password).toBe('testpassword');
  });

  test('should have correct selectors', () => {
    expect(iqOptionBot.selectors).toBeDefined();
    expect(iqOptionBot.selectors.login).toBeDefined();
    expect(iqOptionBot.selectors.trade).toBeDefined();
  });

  test('should have correct base URL', () => {
    expect(iqOptionBot.baseUrl).toContain('iqoption.com');
  });

  test('should handle login state', () => {
    expect(iqOptionBot.isLoggedIn).toBe(false);

    iqOptionBot.isLoggedIn = true;
    expect(iqOptionBot.isLoggedIn).toBe(true);
  });
});