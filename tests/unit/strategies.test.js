/**
 * Trading Strategies Unit Tests
 */

const StockStrategy = require('../../src/strategies/StockStrategy');
const ForexStrategy = require('../../src/strategies/ForexStrategy');
const SignalValidator = require('../../src/strategies/SignalValidator');

describe('StockStrategy', () => {
  let strategy;
  let mockServices;

  beforeEach(() => {
    mockServices = {};
    strategy = new StockStrategy(mockServices);
  });

  test('should analyze stock market data', async () => {
    const marketData = {
      highs: [100, 105, 110, 108, 112],
      lows: [95, 98, 105, 102, 105],
      closes: [98, 103, 108, 105, 110],
      volumes: [1000, 1200, 1500, 1100, 1300]
    };

    const result = await strategy.analyze(marketData);

    expect(result).toHaveProperty('signal');
    expect(result).toHaveProperty('type');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('strength');
    expect(result).toHaveProperty('reasoning');
    expect(['BUY', 'SELL', 'WAIT']).toContain(result.signal);
  });

  test('should calculate volatility correctly', () => {
    const highs = [100, 105, 110, 108, 112];
    const lows = [95, 98, 105, 102, 105];
    const closes = [98, 103, 108, 105, 110];

    const volatility = strategy.calculateVolatility(highs, lows, closes);
    expect(typeof volatility).toBe('number');
    expect(volatility).toBeGreaterThanOrEqual(0);
  });

  test('should get risk parameters', () => {
    const params = strategy.getRiskParameters();

    expect(params).toHaveProperty('maxPositionSize');
    expect(params).toHaveProperty('stopLoss');
    expect(params).toHaveProperty('takeProfit');
    expect(params).toHaveProperty('maxDailyTrades');
  });
});

describe('ForexStrategy', () => {
  let strategy;
  let mockServices;

  beforeEach(() => {
    mockServices = {};
    strategy = new ForexStrategy(mockServices);
  });

  test('should analyze forex market data', async () => {
    const marketData = {
      highs: [1.0500, 1.0520, 1.0480, 1.0510, 1.0490],
      lows: [1.0480, 1.0490, 1.0450, 1.0480, 1.0460],
      closes: [1.0490, 1.0510, 1.0470, 1.0500, 1.0480],
      volumes: [1000, 1200, 1500, 1100, 1300]
    };

    const result = await strategy.analyze(marketData);

    expect(result).toHaveProperty('signal');
    expect(result).toHaveProperty('type');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('strength');
    expect(['BUY', 'SELL', 'WAIT']).toContain(result.signal);
  });

  test('should calculate pip movement', () => {
    const highs = [1.0500, 1.0520, 1.0480, 1.0510, 1.0490];
    const lows = [1.0480, 1.0490, 1.0450, 1.0480, 1.0460];
    const closes = [1.0490, 1.0510, 1.0470, 1.0500, 1.0480];

    const pipMovement = strategy.calculatePipMovement(highs, lows, closes);
    expect(typeof pipMovement).toBe('number');
    expect(pipMovement).toBeGreaterThanOrEqual(0);
  });

  test('should validate market conditions', () => {
    const marketData = {
      highs: [1.0500, 1.0520, 1.0480, 1.0510, 1.0490],
      lows: [1.0480, 1.0490, 1.0450, 1.0480, 1.0460],
      closes: [1.0490, 1.0510, 1.0470, 1.0500, 1.0480],
      volumes: [1000, 1200, 1500, 1100, 1300]
    };

    const validation = strategy.validateConditions(marketData);
    expect(validation).toHaveProperty('valid');
    expect(validation).toHaveProperty('issues');
    expect(Array.isArray(validation.issues)).toBe(true);
  });
});

describe('SignalValidator', () => {
  let validator;
  let mockServices;

  beforeEach(() => {
    mockServices = {
      risk: {
        checkDailyLimits: jest.fn(),
        checkBalance: jest.fn(),
        validatePositionSize: jest.fn()
      }
    };
    validator = new SignalValidator(mockServices);
  });

  test('should validate signal structure', () => {
    const validSignal = {
      asset: 'AAPL',
      direction: 'CALL',
      confidence: 80,
      amount: 5
    };

    const validation = validator.validateSignalStructure(validSignal);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('should reject invalid signal structure', () => {
    const invalidSignal = {
      asset: '',
      direction: 'INVALID',
      confidence: 150,
      amount: -5
    };

    const validation = validator.validateSignalStructure(invalidSignal);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  test('should validate confidence levels', () => {
    const lowConfidence = validator.validateConfidence(50, { minConfidence: 75 });
    expect(lowConfidence.valid).toBe(true);
    expect(lowConfidence.warnings.length).toBeGreaterThan(0);

    const highConfidence = validator.validateConfidence(85, { minConfidence: 75 });
    expect(highConfidence.valid).toBe(true);
    expect(highConfidence.warnings).toHaveLength(0);
  });

  test('should generate recommendations', () => {
    const validation = {
      score: 50,
      errors: [],
      warnings: ['Low confidence']
    };

    const signal = { asset: 'AAPL' };
    const recommendations = validator.generateRecommendations(validation, signal);

    expect(Array.isArray(recommendations)).toBe(true);
    expect(recommendations.length).toBeGreaterThan(0);
  });
});