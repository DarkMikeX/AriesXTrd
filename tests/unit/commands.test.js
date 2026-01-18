/**
 * Commands Unit Tests
 */

const AnalyzeCommand = require('../../src/commands/AnalyzeCommand');

describe('AnalyzeCommand', () => {
  let mockServices;
  let mockCtx;

  beforeEach(() => {
    mockServices = {
      analysis: {
        analyzeAsset: jest.fn()
      }
    };

    mockCtx = {
      from: { id: 12345 },
      reply: jest.fn()
    };
  });

  test('should analyze valid symbol', async () => {
    mockServices.analysis.analyzeAsset.mockResolvedValue({
      formatted: {
        signal_info: 'Mock signal info'
      }
    });

    const command = new AnalyzeCommand(mockServices);
    await command.execute(mockCtx, ['AAPL']);

    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Analyzing AAPL'),
      expect.any(Object)
    );
  });

  test('should reject invalid symbol', async () => {
    const command = new AnalyzeCommand(mockServices);
    await command.execute(mockCtx, ['INVALID123']);

    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Invalid symbol format')
    );
  });

  test('should show asset selection when no symbol provided', async () => {
    const command = new AnalyzeCommand(mockServices);
    await command.execute(mockCtx, []);

    expect(mockCtx.reply).toHaveBeenCalledWith(
      'Choose what you want to analyze:',
      expect.any(Object)
    );
  });
});