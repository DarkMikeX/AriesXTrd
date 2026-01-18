/**
 * Technical Indicators Unit Tests
 */

const RSIIndicator = require('../../src/indicators/RSI');
const MACDIndicator = require('../../src/indicators/MACD');
const BollingerBandsIndicator = require('../../src/indicators/BollingerBands');

describe('RSI Indicator', () => {
  test('should calculate RSI correctly', () => {
    const closes = [10, 11, 12, 11, 10, 9, 10, 11, 12, 13, 14, 13, 12, 11];
    const rsiValues = RSIIndicator.calculate(closes, 14);

    expect(rsiValues).toBeDefined();
    expect(rsiValues.length).toBeGreaterThan(0);
    expect(rsiValues[rsiValues.length - 1]).toBeGreaterThanOrEqual(0);
    expect(rsiValues[rsiValues.length - 1]).toBeLessThanOrEqual(100);
  });

  test('should return empty array for insufficient data', () => {
    const closes = [10, 11, 12];
    const rsiValues = RSIIndicator.calculate(closes, 14);

    expect(rsiValues).toEqual([]);
  });

  test('should interpret RSI values correctly', () => {
    expect(RSIIndicator.interpret(25)).toEqual({
      status: 'Oversold',
      signal: 'BUY'
    });

    expect(RSIIndicator.interpret(75)).toEqual({
      status: 'Overbought',
      signal: 'SELL'
    });

    expect(RSIIndicator.interpret(50)).toEqual({
      status: 'Neutral',
      signal: 'WAIT'
    });
  });
});

describe('MACD Indicator', () => {
  test('should calculate MACD correctly', () => {
    const closes = Array.from({ length: 50 }, () => Math.random() * 100 + 50);
    const macdValues = MACDIndicator.calculate(closes);

    expect(macdValues).toBeDefined();
    expect(macdValues.length).toBeGreaterThan(0);
    expect(macdValues[0]).toHaveProperty('MACD');
    expect(macdValues[0]).toHaveProperty('signal');
    expect(macdValues[0]).toHaveProperty('histogram');
  });

  test('should interpret MACD values correctly', () => {
    const bullishMacd = { MACD: 1.5, signal: 1.2, histogram: 0.3 };
    const bearishMacd = { MACD: 1.2, signal: 1.5, histogram: -0.3 };

    expect(MACDIndicator.interpret(bullishMacd)).toEqual({
      status: 'Bullish Crossover',
      signal: 'BUY'
    });

    expect(MACDIndicator.interpret(bearishMacd)).toEqual({
      status: 'Bearish Crossover',
      signal: 'SELL'
    });
  });
});

describe('Bollinger Bands Indicator', () => {
  test('should calculate Bollinger Bands correctly', () => {
    const closes = Array.from({ length: 30 }, () => Math.random() * 100 + 50);
    const bbValues = BollingerBandsIndicator.calculate(closes);

    expect(bbValues).toBeDefined();
    expect(bbValues.length).toBeGreaterThan(0);
    expect(bbValues[0]).toHaveProperty('middle');
    expect(bbValues[0]).toHaveProperty('upper');
    expect(bbValues[0]).toHaveProperty('lower');
  });

  test('should interpret Bollinger Bands correctly', () => {
    const currentPrice = 100;
    const bb = { middle: 95, upper: 105, lower: 85 };

    expect(BollingerBandsIndicator.interpret(currentPrice, bb)).toEqual({
      status: 'Above Middle Band',
      signal: 'WAIT'
    });

    expect(BollingerBandsIndicator.interpret(80, bb)).toEqual({
      status: 'At Lower Band (Oversold)',
      signal: 'BUY'
    });

    expect(BollingerBandsIndicator.interpret(110, bb)).toEqual({
      status: 'At Upper Band (Overbought)',
      signal: 'SELL'
    });
  });
});