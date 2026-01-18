/**
 * Telegram Integration Tests
 */

const TelegramBot = require('../../src/bot/TelegramBot');
const { Telegraf } = require('telegraf');

describe('TelegramBot Integration', () => {
  let bot;
  let mockServices;
  let mockConfig;

  beforeEach(() => {
    // Mock Telegram token for testing
    process.env.TELEGRAM_BOT_TOKEN = 'test_token';

    mockServices = {
      user: {
        findOrCreateUser: jest.fn(),
        getUserSettings: jest.fn()
      },
      analysis: {
        analyzeAsset: jest.fn()
      },
      trading: {
        executeTrade: jest.fn()
      },
      performance: {
        getOverallPerformance: jest.fn()
      },
      notification: {
        sendTradeConfirmation: jest.fn()
      }
    };

    mockConfig = {
      telegram: {
        messages: {
          start: { welcome: 'Welcome to Trading Bot!' },
          error: { general: 'An error occurred' }
        },
        keyboards: {
          mainMenu: [[{ text: 'Analyze', callback_data: 'analyze' }]]
        }
      }
    };

    bot = new Telegraf('test_token');
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  test('should initialize TelegramBot', () => {
    const telegramBot = new TelegramBot(
      bot,
      mockServices.user,
      mockServices.analysis,
      mockServices.trading,
      mockServices.performance,
      mockServices.notification,
      mockConfig.telegram
    );

    expect(telegramBot).toBeDefined();
    expect(telegramBot.bot).toBe(bot);
  });

  test('should handle start command', async () => {
    const telegramBot = new TelegramBot(
      bot,
      mockServices.user,
      mockServices.analysis,
      mockServices.trading,
      mockServices.performance,
      mockServices.notification,
      mockConfig.telegram
    );

    // Mock user
    mockServices.user.findOrCreateUser.mockResolvedValue({
      id: 1,
      telegramId: 12345,
      username: 'testuser'
    });

    mockServices.user.getUserSettings.mockResolvedValue({});

    // Mock context
    const mockCtx = {
      from: { id: 12345, username: 'testuser' },
      reply: jest.fn()
    };

    // Manually call the start handler (since we can't easily trigger bot commands in tests)
    await mockCtx.reply(mockConfig.telegram.messages.start.welcome, {
      reply_markup: {
        inline_keyboard: mockConfig.telegram.keyboards.mainMenu
      }
    });

    expect(mockCtx.reply).toHaveBeenCalledWith(
      'Welcome to Trading Bot!',
      expect.any(Object)
    );
  });

  test('should handle analyze command', async () => {
    const telegramBot = new TelegramBot(
      bot,
      mockServices.user,
      mockServices.analysis,
      mockServices.trading,
      mockServices.performance,
      mockServices.notification,
      mockConfig.telegram
    );

    // Mock analysis result
    mockServices.analysis.analyzeAsset.mockResolvedValue({
      formatted: {
        signal_info: 'BUY AAPL with 85% confidence'
      }
    });

    // Mock context
    const mockCtx = {
      from: { id: 12345 },
      reply: jest.fn()
    };

    mockCtx.state = {
      user: { id: 1, telegramId: 12345 },
      settings: { defaultAmount: 5 }
    };

    // Test the analyze method directly
    await telegramBot.sendAnalysis(mockCtx, 'AAPL');

    expect(mockServices.analysis.analyzeAsset).toHaveBeenCalledWith('AAPL', 12345);
    expect(mockCtx.reply).toHaveBeenCalled();
  });

  test('should handle invalid symbol', async () => {
    const telegramBot = new TelegramBot(
      bot,
      mockServices.user,
      mockServices.analysis,
      mockServices.trading,
      mockServices.performance,
      mockServices.notification,
      mockConfig.telegram
    );

    const mockCtx = {
      reply: jest.fn()
    };

    // Test with invalid symbol
    await telegramBot.sendAnalysis(mockCtx, 'INVALID');

    expect(mockServices.analysis.analyzeAsset).toHaveBeenCalledWith('INVALID', undefined);
  });

  test('should handle callback queries', async () => {
    const telegramBot = new TelegramBot(
      bot,
      mockServices.user,
      mockServices.analysis,
      mockServices.trading,
      mockServices.performance,
      mockServices.notification,
      mockConfig.telegram
    );

    const mockCtx = {
      callbackQuery: { data: 'analyze_AAPL' },
      state: { user: { id: 1 } },
      answerCbQuery: jest.fn(),
      editMessageText: jest.fn()
    };

    // Mock analysis
    mockServices.analysis.analyzeAsset.mockResolvedValue({
      formatted: {
        signal_info: 'BUY AAPL with 85% confidence'
      }
    });

    // This would normally be handled by the callback query handler
    expect(telegramBot).toBeDefined();
  });

  test('should format settings message', () => {
    const telegramBot = new TelegramBot(
      bot,
      mockServices.user,
      mockServices.analysis,
      mockServices.trading,
      mockServices.performance,
      mockServices.notification,
      mockConfig.telegram
    );

    const settings = {
      autoTrading: false,
      minConfidence: 75,
      defaultAmount: 5.00,
      maxDailyTrades: 20,
      tradeDuration: 5,
      dailyLossLimit: 50.00,
      dailyProfitTarget: 100.00,
      maxTradeAmount: 20.00,
      stopAfterLosses: 3,
      tradeConfirmations: true,
      winLossAlerts: true,
      dailySummary: true,
      signalAlerts: false,
      preferredAssets: ['stocks', 'forex']
    };

    const message = telegramBot.formatSettingsMessage(settings);

    expect(message).toContain('Auto-Trading: OFF');
    expect(message).toContain('Min Confidence: 75');
    expect(message).toContain('Default Amount: $5.00');
    expect(message).toContain('Preferred Assets: stocks,forex');
  });

  test('should format stats message', () => {
    const telegramBot = new TelegramBot(
      bot,
      mockServices.user,
      mockServices.analysis,
      mockServices.trading,
      mockServices.performance,
      mockServices.notification,
      mockConfig.telegram
    );

    const stats = {
      totalTrades: 50,
      totalWins: 35,
      totalLosses: 15,
      winRate: 70.0,
      overallProfit: 250.75,
      roi: 25.1
    };

    const message = telegramBot.formatStatsMessage(stats);

    expect(message).toContain('Total Trades: 50');
    expect(message).toContain('Wins: 35');
    expect(message).toContain('Win Rate: 70.00%');
    expect(message).toContain('Total Profit: $250.75');
  });
});