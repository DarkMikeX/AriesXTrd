/**
 * Callback Handler
 * Handles inline keyboard callback queries
 */

const Logger = require('../utils/Logger');
const ErrorHandler = require('../utils/ErrorHandler');

class CallbackHandler {
  constructor(bot, services) {
    this.bot = bot;
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Handle callback query
   */
  async handleCallback(ctx) {
    try {
      const callbackData = ctx.callbackQuery.data;
      const userId = ctx.from.id;

      // Parse callback data (format: action_param)
      const [action, param] = callbackData.split('_');

      // Log user action
      const LoggerInstance = require('../utils/Logger');
      if (LoggerInstance.instance) {
        LoggerInstance.instance.logUserAction(userId, 'callback', { action, param });
      }

      // Route to appropriate handler
      switch (action) {
        case 'menu':
          await this.handleMenuCallback(ctx, param);
          break;

        case 'trade':
          await this.handleTradeCallback(ctx, param);
          break;

        case 'analyze':
          await this.handleAnalyzeCallback(ctx, param);
          break;

        case 'timeframe':
          await this.handleTimeframeCallback(ctx, callbackData);
          break;

        case 'tf':
          // Handle timeframe selection before asset (tf_select_ASSETTYPE_TIMEFRAME)
          await this.handleTimeframeFirstCallback(ctx, callbackData);
          break;

        case 'view':
          await this.handleViewCallback(ctx, param);
          break;

        case 'cancel':
          await this.handleCancelCallback(ctx);
          break;

        case 'confirm':
          await this.handleConfirmCallback(ctx, param);
          break;

        case 'settings':
          await this.handleSettingsCallback(ctx, param);
          break;

        case 'back':
          await this.handleBackCallback(ctx);
          break;

        case 'help':
          await this.handleHelpCallback(ctx, param);
          break;

        default:
          // Check if it's a tf_select callback
          if (callbackData.startsWith('tf_select_')) {
            await this.handleTimeframeFirstCallback(ctx, callbackData);
          } else {
            await ctx.answerCbQuery('Unknown action');
            await ctx.reply('❌ Unknown action. Please try again.');
          }
      }

      // Answer callback query to remove loading state
      await ctx.answerCbQuery();

    } catch (error) {
      this.logger.error('Callback handling error', {
        callbackData: ctx.callbackQuery.data,
        userId: ctx.from.id,
        error: error.message
      });

      await ctx.answerCbQuery('An error occurred. Please try again.');
    }
  }

  /**
   * Handle menu callbacks
   */
  async handleMenuCallback(ctx, menuType) {
    switch (menuType) {
      case 'stocks':
        // Stocks go directly to asset menu (no timeframe selection)
        const userIdStocks = ctx.from.id;
        if (this.services?.sessionManager) {
          this.services.sessionManager.setSessionProperty(userIdStocks, 'assetType', 'stock');
          this.services.sessionManager.setSessionProperty(userIdStocks, 'timeframe', '1H'); // Default for stocks
        }
        await this.showAssetMenu(ctx, 'stocks');
        break;

      case 'forex':
        // Forex shows timeframe selection first
        await this.showTimeframeSelection(ctx, null, 'forex');
        break;

      case 'crypto':
        // Crypto goes directly to asset menu (no timeframe selection)
        const userIdCrypto = ctx.from.id;
        if (this.services?.sessionManager) {
          this.services.sessionManager.setSessionProperty(userIdCrypto, 'assetType', 'crypto');
          this.services.sessionManager.setSessionProperty(userIdCrypto, 'timeframe', '4H'); // Default for crypto
        }
        await this.showAssetMenu(ctx, 'crypto');
        break;

      case 'recommended':
        await this.handleRecommendedSignal(ctx);
        break;

      case 'stats':
        await this.handleStats(ctx);
        break;

      case 'settings':
        await this.handleSettings(ctx);
        break;

      default:
        await ctx.answerCbQuery('Menu not found');
        await ctx.reply('❌ Menu not found. Please try again.');
    }
  }

  /**
   * Handle trade callbacks
   */
  async handleTradeCallback(ctx, amount) {
    try {
      // Get current analysis from message
      const messageText = ctx.callbackQuery.message.text;
      const symbolMatch = messageText.match(/([A-Z]{2,10})/);
      const symbol = symbolMatch ? symbolMatch[1] : 'UNKNOWN';

      // Parse trade parameters
      let tradeAmount = 5; // default
      let direction = 'CALL'; // default from analysis

      if (amount === 'custom') {
        // Handle custom amount input
        return await this.handleCustomAmount(ctx, symbol);
      } else if (amount !== 'confirm') {
        tradeAmount = parseInt(amount);
      }

      // Extract direction from message
      if (messageText.includes('SELL') || messageText.includes('PUT')) {
        direction = 'PUT';
      }

      // Execute trade
      await this.executeTrade(ctx, symbol, direction, tradeAmount);

    } catch (error) {
      this.logger.error('Trade callback error', { error: error.message });
      await ctx.answerCbQuery('Trade execution failed. Please try again.');
    }
  }

  /**
   * Handle analyze callbacks - when user clicks on a pair/asset
   */
  async handleAnalyzeCallback(ctx, symbol) {
    // User clicked on a pair button - analyze immediately
    const userId = ctx.from.id;
    const sessionManager = this.services?.sessionManager;
    
    // Get timeframe and assetType from session
    let timeframe = sessionManager?.getSessionProperty(userId, 'timeframe');
    const assetType = sessionManager?.getSessionProperty(userId, 'assetType') || 'stock';
    
    // If no timeframe in session, use defaults:
    // - Forex: 5m (from timeframe selection)
    // - Stocks: 1H (default)
    // - Crypto: 4H (default)
    if (!timeframe) {
      if (assetType === 'forex' || assetType === 'Forex') {
        timeframe = '5m';
      } else if (assetType === 'crypto' || assetType === 'Crypto') {
        timeframe = '4H';
      } else {
        timeframe = '1H'; // Default for stocks
      }
    }
    
    // Store symbol and assetType in session if not set
    if (sessionManager) {
      sessionManager.setSessionProperty(userId, 'selectedSymbol', symbol);
      // Set assetType if not in session (for stocks/crypto that skip timeframe)
      if (!assetType || assetType === 'stock') {
        // Determine assetType from symbol or context
        const normalizedType = this.determineAssetType(symbol, ctx);
        sessionManager.setSessionProperty(userId, 'assetType', normalizedType);
      }
      sessionManager.pushNavigation(userId, 'asset', { symbol, assetType: assetType || 'stock', timeframe });
    }
    
    // Analyze immediately with the selected/default timeframe
    await this.analyzeSymbol(ctx, symbol, assetType || 'stock', timeframe);
  }

  /**
   * Determine asset type from symbol or context
   */
  determineAssetType(symbol, ctx) {
    // Check if it's in the callback path or session
    const userId = ctx.from.id;
    const sessionManager = this.services?.sessionManager;
    const assetType = sessionManager?.getSessionProperty(userId, 'assetType');
    if (assetType) return assetType;

    // Forex pairs typically have USD, EUR, GBP, JPY, etc.
    const forexPattern = /^(EUR|GBP|USD|JPY|CHF|AUD|CAD|NZD)/i;
    if (forexPattern.test(symbol) && symbol.length <= 7) {
      return 'forex';
    }

    // Crypto typically ends with USD
    const cryptoPattern = /(BTC|ETH|BNB|ADA|SOL|DOT|DOGE|AVAX|LTC|LINK)USD$/i;
    if (cryptoPattern.test(symbol)) {
      return 'crypto';
    }

    // Default to stock
    return 'stock';
  }

  /**
   * Show timeframe selection menu
   */
  async showTimeframeSelection(ctx, symbol, assetType) {
    const TimeframeMenu = require('../menus/TimeframeMenu');
    const timeframeMenu = new TimeframeMenu(this.services);
    
    // Always show timeframe menu - if symbol is null, user is selecting timeframe FIRST
    await timeframeMenu.show(ctx, symbol, assetType);
  }

  /**
   * Handle timeframe selection callback (when asset already selected)
   * Format: timeframe_SYMBOL_ASSETTYPE_TIMEFRAME
   */
  async handleTimeframeCallback(ctx, callbackData) {
    // Format: timeframe_SYMBOL_ASSETTYPE_TIMEFRAME
    const parts = callbackData.split('_');
    if (parts.length < 4) {
      await ctx.reply('❌ Invalid timeframe selection. Please try again.');
      return;
    }

    const symbol = parts[1];
    const assetType = parts[2];
    const timeframe = parts[3];

    // Store in session
    const userId = ctx.from.id;
    if (this.services?.sessionManager) {
      this.services.sessionManager.setSessionProperty(userId, 'selectedSymbol', symbol);
      this.services.sessionManager.setSessionProperty(userId, 'assetType', assetType);
      this.services.sessionManager.setSessionProperty(userId, 'timeframe', timeframe);
      this.services.sessionManager.pushNavigation(userId, 'timeframe', { symbol, assetType, timeframe });
    }

    // Analyze with selected timeframe
    await this.analyzeSymbol(ctx, symbol, assetType, timeframe);
  }

  /**
   * Handle timeframe selection when timeframe is selected FIRST (before asset)
   * Format: tf_select_ASSETTYPE_TIMEFRAME
   */
  async handleTimeframeFirstCallback(ctx, callbackData) {
    // Format: tf_select_ASSETTYPE_TIMEFRAME
    const parts = callbackData.split('_');
    if (parts.length < 4 || parts[1] !== 'select') {
      await ctx.reply('❌ Invalid timeframe selection. Please try again.');
      return;
    }

    const assetType = parts[2];
    const timeframe = parts[3];

    // Store timeframe in session
    const userId = ctx.from.id;
    if (this.services?.sessionManager) {
      this.services.sessionManager.setSessionProperty(userId, 'assetType', assetType);
      this.services.sessionManager.setSessionProperty(userId, 'timeframe', timeframe);
      this.services.sessionManager.pushNavigation(userId, 'timeframe', { assetType, timeframe });
    }

    // Now show asset selection menu
    await this.showAssetMenu(ctx, assetType);
  }

  /**
   * Show asset menu for timeframe selection flow
   */
  async showAssetMenuForTimeframe(ctx, assetType) {
    await this.showAssetMenu(ctx, assetType);
  }

  /**
   * Handle recommended signal
   */
  async handleRecommendedSignal(ctx) {
    try {
      await ctx.editMessageText('⭐ Finding Best Signal...\n\nAnalyzing all markets for highest confidence signal...');

      // Get analysis service
      const analysisService = this.services?.analysisService;
      if (!analysisService) {
        await ctx.reply('❌ Analysis service not available. Please try again later.');
        return;
      }

      // Analyze multiple assets to find best signal
      const symbols = {
        stock: ['AAPL', 'TSLA', 'MSFT'],
        forex: ['EURUSD', 'GBPUSD', 'USDJPY'],
        crypto: ['BTCUSD', 'ETHUSD']
      };

      let bestSignal = null;
      let bestConfidence = 0;

      // Test a few symbols to find best signal
      const testSymbols = [
        { symbol: 'EURUSD', type: 'forex' },
        { symbol: 'AAPL', type: 'stock' },
        { symbol: 'BTCUSD', type: 'crypto' }
      ];

      for (const { symbol, type } of testSymbols) {
        try {
          const result = await analysisService.analyzeAsset(symbol, {
            assetType: type,
            timeframe: type === 'forex' ? '5m' : type === 'stock' ? '1H' : '4H'
          });

          if (result && result.signal && result.signal.confidence > bestConfidence) {
            bestConfidence = result.signal.confidence;
            bestSignal = { ...result, symbol, type };
          }
        } catch (error) {
          this.logger.warn('Error analyzing symbol for recommended', { symbol, error: error.message });
        }
      }

      if (!bestSignal) {
        await ctx.reply('❌ Could not generate recommended signal. Please try selecting an asset manually.');
        return;
      }

      // Format the detailed analysis result if available
      let formattedDetails = '';
      if (bestSignal.formatted && typeof bestSignal.formatted === 'object') {
        const fmt = bestSignal.formatted;
        const parts = [];
        
        if (fmt.price_info) {
          parts.push(fmt.price_info);
        }
        if (fmt.indicators_summary) {
          parts.push(fmt.indicators_summary);
        }
        if (fmt.signal_info) {
          parts.push(fmt.signal_info);
        }
        if (fmt.trade_recommendation) {
          parts.push(fmt.trade_recommendation);
        }
        
        formattedDetails = parts.length > 0 ? '\n\n' + parts.join('\n\n') : '';
      }

      // Display recommended signal
      const message = `⭐ RECOMMENDED SIGNAL\n\n📊 ${bestSignal.symbol} (${bestSignal.type.toUpperCase()})\n🎯 Signal: ${bestSignal.signal.signal}\n📈 Confidence: ${bestSignal.signal.confidence}%\n⏰ Timeframe: ${bestSignal.timeframe || 'Auto'}${formattedDetails}`;

      const keyboard = [
        [{ text: '✅ Trade This Signal', callback_data: `analyze_${bestSignal.symbol}` }],
        [{ text: '🔄 Find Another', callback_data: 'menu_recommended' }],
        [{ text: '🔙 Back', callback_data: 'back_main' }]
      ];

      await ctx.editMessageText(message, {
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (error) {
      this.logger.error('Error handling recommended signal', { error: error.message });
      await ctx.reply('❌ Error generating recommended signal. Please try again.');
    }
  }

  /**
   * Handle view callbacks
   */
  async handleViewCallback(ctx, viewType) {
    switch (viewType) {
      case 'chart':
        await ctx.reply('📊 Chart view coming soon! This would show technical analysis charts.');
        break;

      case 'position':
        await this.showOpenPositions(ctx);
        break;

      default:
        await ctx.answerCbQuery('View not available');
    }
  }

  /**
   * Handle cancel callback
   */
  async handleCancelCallback(ctx) {
    await ctx.editMessageText('❌ Operation cancelled.');
  }

  /**
   * Handle confirm callback
   */
  async handleConfirmCallback(ctx, action) {
    switch (action) {
      case 'stop':
        await ctx.editMessageText('🚨 All trading activities have been stopped!\n\nTo resume: /settings');
        break;

      case 'trade':
        // Trade confirmation logic would go here
        await ctx.answerCbQuery('Trade confirmed');
        break;
    }
  }

  /**
   * Handle settings callbacks
   */
  async handleSettingsCallback(ctx, settingType) {
    // Settings logic would go here
    await ctx.editMessageText(`⚙️ ${settingType} settings would be displayed here.`);
  }

  /**
   * Handle back callback
   */
  async handleBackCallback(ctx) {
    const userId = ctx.from.id;
    const sessionManager = this.services?.sessionManager;

    if (sessionManager) {
      // Pop navigation stack
      const previousNav = sessionManager.popNavigation(userId);
      
      if (previousNav) {
        // Go back to previous menu
        switch (previousNav.menuType) {
          case 'timeframe':
            // Show asset menu
            const assetType = previousNav.menuData?.assetType || 'stock';
            await this.showAssetMenu(ctx, assetType);
            break;
          case 'asset':
            // Go to main menu
            await this.showMainMenu(ctx);
            break;
          default:
            await this.showMainMenu(ctx);
        }
      } else {
        // No previous navigation, go to main menu
        await this.showMainMenu(ctx);
      }
    } else {
      // Fallback to main menu
      await this.showMainMenu(ctx);
    }
  }

  /**
   * Show main menu
   */
  async showMainMenu(ctx) {
    const MainMenu = require('../menus/MainMenu');
    const mainMenu = new MainMenu(this.services);
    
    try {
      await mainMenu.show(ctx);
    } catch (error) {
      // If editMessageText fails, try reply
      await ctx.reply('👋 Welcome back! Use /start to see the main menu.');
    }
  }

  /**
   * Handle help callback
   */
  async handleHelpCallback(ctx, topic) {
    const helpText = `🤖 *Trading Bot Help*\n\n*${topic || 'General'} Help*\n\nAvailable commands:\n/start - Main menu\n/help - Show help\n/analyze <symbol> - Analyze an asset\n/stats - View trading statistics\n/settings - Configure bot settings\n/stop - Emergency stop all trading\n\nChoose a topic:`;

    const keyboard = [
      [{ text: '📊 Trading', callback_data: 'help_trading' }],
      [{ text: '⚙️ Settings', callback_data: 'help_settings' }],
      [{ text: '🆘 Support', callback_data: 'help_support' }],
      [{ text: '🔙 Back', callback_data: 'back_main' }]
    ];

    await ctx.editMessageText(helpText, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  /**
   * Show asset menu for specific type
   */
  async showAssetMenu(ctx, assetType) {
    const assets = this.getAssetsForType(assetType);
    const emoji = this.getAssetEmoji(assetType);
    
    // Get recommended pair from market analysis service
    let recommendedPair = null;
    if (this.services?.marketAnalysis) {
      const normalizedType = assetType === 'stock' || assetType === 'stocks' ? 'stock' : 
                             assetType === 'forex' ? 'forex' : 
                             assetType === 'crypto' ? 'crypto' : assetType;
      recommendedPair = this.services.marketAnalysis.getRecommendedPair(normalizedType);
    }

    // Format message - NO TEXT LIST, only buttons
    let message = `Select a currency pair:`;
    
    // For Forex, show "Select a currency pair:" like in screenshot
    if (assetType === 'forex' || assetType === 'Forex') {
      message = `Select a currency pair:`;
    } else if (assetType === 'stocks' || assetType === 'Stocks') {
      message = `Select a stock:`;
    } else if (assetType === 'crypto' || assetType === 'Crypto') {
      message = `Select a cryptocurrency:`;
    }
    const buttons = [];

    // Add recommended pair button at top if available
    if (recommendedPair && recommendedPair.symbol) {
      // Format recommended pair for Forex
      let recommendedText = `⭐ Recommended: ${recommendedPair.symbol} (${recommendedPair.confidence}%)`;
      if (assetType === 'forex' || assetType === 'Forex') {
        const formatted = recommendedPair.symbol.replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2 OTC');
        recommendedText = `⭐ Recommended: ${formatted} (${recommendedPair.confidence}%)`;
      }
      buttons.push([
        { 
          text: recommendedText, 
          callback_data: `analyze_${recommendedPair.symbol}` 
        }
      ]);
      buttons.push([]); // Empty row for spacing
    }

    // Create asset buttons (2 per row for Forex like screenshot, 3 for others)
    const buttonsPerRow = (assetType === 'forex' || assetType === 'Forex') ? 2 : 3;
    
    assets.forEach((asset, index) => {
      if ((index + 1) % buttonsPerRow === 0 || index === assets.length - 1) {
        const rowStart = Math.floor(index / buttonsPerRow) * buttonsPerRow;
        const rowAssets = assets.slice(rowStart, index + 1);
        const row = rowAssets.map(assetItem => {
          // For Forex, format like "EUR/USD OTC" from screenshot
          if (assetType === 'forex' || assetType === 'Forex') {
            const formatted = assetItem.symbol.replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2 OTC');
            return {
              text: formatted,
              callback_data: `analyze_${assetItem.symbol}`
            };
          } else {
            return {
              text: `${emoji} ${assetItem.symbol}`,
              callback_data: `analyze_${assetItem.symbol}`
            };
          }
        });
        buttons.push(row);
      }
    });

    // Add back button at bottom
    buttons.push([
      { text: '🔙 Back', callback_data: 'back_previous' }
    ]);

    try {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
      });
    } catch (error) {
      // If editMessageText fails, use reply
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
      });
    }
  }

  /**
   * Execute trade
   */
  async executeTrade(ctx, symbol, direction, amount) {
    try {
      const userId = ctx.from.id;
      
      // Show loading message
      await ctx.editMessageText(`⏳ Executing trade on IQ Option...\n\n1️⃣ Opening Chrome browser...\n2️⃣ Logging into IQ Option...\n3️⃣ Selecting ${symbol}...\n4️⃣ Setting trade parameters...\n5️⃣ Clicking ${direction} button...\n6️⃣ Confirming trade...`);

      // Get trading service from services
      const tradingService = this.services?.trading;
      
      if (!tradingService) {
        throw new Error('Trading service not available');
      }

      // Get signal info from session if available
      const sessionManager = this.services?.sessionManager;
      let signalId = null;
      let confidence = 0;
      
      if (sessionManager) {
        const lastSignal = sessionManager.getSessionProperty(userId, 'lastSignal');
        if (lastSignal) {
          signalId = lastSignal.signalId;
          confidence = lastSignal.confidence || 0;
        }
      }

      // Execute trade using TradingService (which uses real IQ Option automation)
      const tradeResult = await tradingService.executeTrade({
        userId,
        assetSymbol: symbol,
        direction: direction === 'BUY' ? 'CALL' : 'PUT',
        amount: parseFloat(amount),
        duration: 5, // Default 5 minutes
        signalId,
        confidence
      });

      if (!tradeResult || !tradeResult.trade) {
        throw new Error('Trade execution failed - no result returned');
      }

      // Format success message
      const entryPrice = tradeResult.trade.entry_price || tradeResult.tradeResult?.entryPrice || 0;
      const expiryTime = tradeResult.trade.expiry_time || tradeResult.tradeResult?.expiryTime || new Date(Date.now() + 5 * 60 * 1000);
      const potentialProfit = (parseFloat(amount) * 0.95).toFixed(2);
      
      const entryTimeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const expiryTimeStr = new Date(expiryTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const successMessage = `✅ TRADE EXECUTED SUCCESSFULLY!\n\n📍 Asset: ${symbol}\n🎯 Type: Binary Option - ${direction === 'BUY' ? 'CALL' : 'PUT'}\n💵 Investment: $${parseFloat(amount).toFixed(2)}\n📊 Entry Price: $${entryPrice.toFixed(2)}\n⏰ Entry Time: ${entryTimeStr}\n⌛ Expiry Time: ${expiryTimeStr} (5 min)\n💰 Potential Profit: $${potentialProfit}\n\n🔔 I'll monitor this trade and notify you when it closes!`;

      await ctx.editMessageText(successMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📊 View Position', callback_data: 'view_position' }],
            [{ text: '⚙️ Settings', callback_data: 'menu_settings' }]
          ]
        }
      });

    } catch (error) {
      this.logger.error('Trade execution error', { symbol, direction, amount, error: error.message, stack: error.stack });
      await ctx.editMessageText(`❌ Trade execution failed: ${error.message}\n\nPlease check:\n1. IQ Option credentials are set in .env (IQ_OPTION_EMAIL, IQ_OPTION_PASSWORD)\n2. IQ Option demo account is accessible\n3. Browser automation is working (Puppeteer installed)\n\nTry again or contact support.`);
    }
  }

  /**
   * Analyze symbol with timeframe
   */
  async analyzeSymbol(ctx, symbol, assetType = 'stock', timeframe = '1H') {
    try {
      // Get from session if not provided
      if (!timeframe || !assetType) {
        const userId = ctx.from.id;
        const sessionManager = this.services?.sessionManager;
        if (sessionManager) {
          timeframe = timeframe || sessionManager.getSessionProperty(userId, 'timeframe') || '1H';
          assetType = assetType || sessionManager.getSessionProperty(userId, 'assetType') || 'stock';
        }
      }

      await ctx.editMessageText(`⏳ Analyzing ${symbol}...\n\n📊 Fetching candle data from TradingView...\n📈 Reading ${timeframe} timeframe charts...\n🔍 Calculating 7 technical indicators...\n🎯 Generating signal from candle patterns...`);

      // Use actual analysis service
      const analysisService = this.services?.analysisService;
      let result;

      if (analysisService) {
        try {
          result = await analysisService.analyzeAsset(symbol, {
            assetType,
            timeframe,
            userId: ctx.from.id,
            includeCharts: false
          });
        } catch (error) {
          this.logger.error('Analysis service error', { symbol, error: error.message });
          result = null;
        }
      }

      // If service fails, use mock
      if (!result) {
        result = this.generateMockAnalysis(symbol, assetType, timeframe);
      }

      // Format result message - ensure it's a string
      let analysisResult;
      
      if (result.formatted && typeof result.formatted === 'object') {
        // AnalysisService returns formatted as an object, build complete string message
        const fmt = result.formatted;
        
        // Build the complete message string matching the screenshot format
        const parts = [];
        
        // Header
        parts.push(fmt.header || `📊 ${symbol.toUpperCase()} ANALYSIS COMPLETE`);
        parts.push(''); // Empty line
        
        // Price
        parts.push(fmt.price_info || `💰 Current Price: $${result.market_data?.current_price || result.currentPrice || result.price || 'N/A'}`);
        parts.push(''); // Empty line
        
        // Indicators Summary (already includes "TECHNICAL INDICATORS:" header)
        if (fmt.indicators_summary) {
          parts.push(fmt.indicators_summary);
          parts.push(''); // Empty line
        }
        
        // Signal Info (already formatted)
        if (fmt.signal_info) {
          parts.push(fmt.signal_info);
          parts.push(''); // Empty line
        }
        
        // Trade Recommendation
        if (fmt.trade_recommendation) {
          parts.push(fmt.trade_recommendation);
          parts.push(''); // Empty line
        }
        
        // Chart Analysis
        parts.push('💡 CHART ANALYSIS:');
        parts.push(`• Analyzed ${timeframe} candle patterns`);
        // Get actual data source from market data
        // Priority: historical_data.source (most accurate) > price_data.source > default
        let dataSource = result.market_data?.historical_data?.source || result.market_data?.price_data?.source;
        
        // Map source to display name
        const sourceMap = {
          'yahoo_finance': 'Yahoo Finance',
          'binance': 'Binance',
          'finnhub': 'Finnhub',
          'alpha_vantage': 'Alpha Vantage',
          'exchangerate_api': 'ExchangeRate-API',
          'free_api': 'Yahoo Finance/Binance', // Generic fallback - show as free APIs
          'tradingview': 'TradingView',
          'tradingview_rest': 'TradingView REST',
          'tradingview_websocket': 'TradingView WebSocket'
        };
        
        const displaySource = dataSource ? (sourceMap[dataSource] || dataSource) : 'Market Data';
        parts.push(`• Based on OHLCV data from ${displaySource}`);
        const confidence = result.signal?.confidence || 0;
        parts.push(confidence >= 75 ? '• ✅ Signal validated' : '• ⚠️ Low confidence');
        
        analysisResult = parts.join('\n');
        
      } else if (result.formatted && typeof result.formatted === 'string') {
        // Already a string
        analysisResult = result.formatted;
      } else {
        // Fallback to formatAnalysisResult
        analysisResult = this.formatAnalysisResult(result, symbol, assetType, timeframe);
      }

      const keyboard = [
        [
          { text: '✅ Execute $5', callback_data: `trade_5_${symbol}` },
          { text: '💰 Execute $10', callback_data: `trade_10_${symbol}` }
        ],
        [
          { text: '💵 Custom Amount', callback_data: `trade_custom_${symbol}` },
          { text: '📊 View Chart', callback_data: `view_chart_${symbol}` }
        ],
        [
          { text: '🔄 Re-analyze', callback_data: `analyze_${symbol}` },
          { text: '🔙 Back', callback_data: 'back_previous' }
        ]
      ];

      // Remove parse_mode to avoid Markdown parsing errors with dynamic content
      // Telegram will still display emojis and formatting nicely without Markdown
      await ctx.editMessageText(analysisResult, {
        reply_markup: { inline_keyboard: keyboard }
      });

      // Register signal for validation if service available
      if (result && result.signal && this.services?.signalValidation) {
        const signalId = `signal_${Date.now()}_${symbol}`;
        
        // Extract entry price from multiple possible locations in the result
        let entryPrice = 0;
        if (result.market_data && result.market_data.current_price) {
          entryPrice = parseFloat(result.market_data.current_price);
        } else if (result.currentPrice) {
          entryPrice = parseFloat(result.currentPrice);
        } else if (result.price) {
          entryPrice = parseFloat(result.price);
        } else if (result.market_data && result.market_data.price_data && result.market_data.price_data.price) {
          entryPrice = parseFloat(result.market_data.price_data.price);
        }
        
        // Store signal info in session for trade execution
        const sessionManager = this.services?.sessionManager;
        if (sessionManager) {
          sessionManager.setSessionProperty(ctx.from.id, 'lastSignal', {
            signalId,
            confidence: result.signal.confidence
          });
        }
        
        this.services.signalValidation.registerSignal(signalId, {
          symbol,
          assetType,
          direction: result.signal.signal.includes('BUY') || result.signal.signal.includes('CALL') ? 'CALL' : 'PUT',
          entryPrice: entryPrice || 0,
          timeframe,
          confidence: result.signal.confidence,
          userId: ctx.from.id
        });
      }

    } catch (error) {
      this.logger.error('Symbol analysis error', { symbol, error: error.message });
      await ctx.editMessageText('❌ Analysis failed. Please try again.');
      await ctx.reply('❌ An error occurred during analysis. Please try again or contact support.');
    }
  }

  /**
   * Format analysis result
   */
  formatAnalysisResult(result, symbol, assetType, timeframe) {
    const signal = result.signal || { signal: 'NEUTRAL', confidence: 50 };
    const price = result.currentPrice || result.price || 'N/A';
    const indicators = result.indicators || {};

    return `📊 *${symbol} ANALYSIS* (${timeframe})

💰 Current Price: $${price}

📈 *TECHNICAL INDICATORS:*
${Object.entries(indicators).map(([key, val]) => `├─ ${key}: ${JSON.stringify(val)}`).join('\n')}

🎯 *SIGNAL: ${signal.signal}*
📊 Confidence: ${signal.confidence}%
⭐ Quality: ${signal.confidence >= 80 ? 'Excellent' : signal.confidence >= 60 ? 'Good' : 'Fair'}

💡 *CHART ANALYSIS:*
• Analyzed ${timeframe} candle patterns
• Based on OHLCV data from Market Data
• ${signal.confidence >= 75 ? '✅ Signal validated' : '⚠️ Low confidence'}`;
  }

  /**
   * Handle stats callback
   */
  async handleStats(ctx) {
    // Stats logic would go here
    await ctx.editMessageText('📊 Statistics would be displayed here.');
  }

  /**
   * Handle settings callback
   */
  async handleSettings(ctx) {
    // Settings logic would go here
    await ctx.editMessageText('⚙️ Settings would be displayed here.');
  }

  /**
   * Show open positions
   */
  async showOpenPositions(ctx) {
    // Open positions logic would go here
    await ctx.reply('📊 Open positions would be displayed here.');
  }

  /**
   * Handle custom amount input
   */
  async handleCustomAmount(ctx, symbol) {
    // Custom amount logic would go here
    await ctx.editMessageText('💵 Enter trade amount (e.g., 10 for $10):', {
      reply_markup: {
        inline_keyboard: [[
          { text: '❌ Cancel', callback_data: 'cancel' }
        ]]
      }
    });
  }

  /**
   * Get assets for type - loads from config/assets.json
   */
  getAssetsForType(assetType) {
    try {
      // Load from config file
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(__dirname, '../../config/assets.json');
      
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        // Normalize asset type
        const normalizedType = assetType === 'stock' || assetType === 'stocks' ? 'stocks' : 
                               assetType === 'forex' ? 'forex' : 
                               assetType === 'crypto' ? 'crypto' : assetType;
        
        const assetsConfig = config[normalizedType] || {};
        
        // Convert config format to array format
        const assets = Object.entries(assetsConfig)
          .filter(([symbol, data]) => data.enabled !== false)
          .map(([symbol, data]) => ({
            symbol: symbol,
            name: data.name || symbol
          }));
        
        return assets;
      }
    } catch (error) {
      this.logger.error('Error loading assets config', { assetType, error: error.message });
    }

    // Fallback to default list if config load fails (includes ALL pairs)
    const fallbackAssets = {
      stocks: [
        { symbol: 'AAPL', name: 'Apple Inc.' },
        { symbol: 'TSLA', name: 'Tesla Inc.' },
        { symbol: 'MSFT', name: 'Microsoft Corp.' },
        { symbol: 'AMZN', name: 'Amazon.com Inc.' },
        { symbol: 'GOOGL', name: 'Alphabet Inc.' },
        { symbol: 'NVDA', name: 'NVIDIA Corp.' },
        { symbol: 'META', name: 'Meta Platforms' },
        { symbol: 'NFLX', name: 'Netflix Inc.' },
        { symbol: 'AMD', name: 'Advanced Micro Devices' },
        { symbol: 'SPY', name: 'SPDR S&P 500 ETF' }
      ],
      forex: [
        { symbol: 'EURUSD', name: 'Euro vs US Dollar' },
        { symbol: 'GBPUSD', name: 'British Pound vs US Dollar' },
        { symbol: 'USDJPY', name: 'US Dollar vs Japanese Yen' },
        { symbol: 'USDCHF', name: 'US Dollar vs Swiss Franc' },
        { symbol: 'AUDUSD', name: 'Australian Dollar vs US Dollar' },
        { symbol: 'USDCAD', name: 'US Dollar vs Canadian Dollar' },
        { symbol: 'NZDUSD', name: 'New Zealand Dollar vs US Dollar' },
        { symbol: 'EURJPY', name: 'Euro vs Japanese Yen' },
        { symbol: 'GBPJPY', name: 'British Pound vs Japanese Yen' },
        { symbol: 'EURGBP', name: 'Euro vs British Pound' }
      ],
      crypto: [
        { symbol: 'BTCUSD', name: 'Bitcoin' },
        { symbol: 'ETHUSD', name: 'Ethereum' },
        { symbol: 'BNBUSD', name: 'Binance Coin' },
        { symbol: 'ADAUSD', name: 'Cardano' },
        { symbol: 'SOLUSD', name: 'Solana' },
        { symbol: 'DOTUSD', name: 'Polkadot' },
        { symbol: 'DOGEUSD', name: 'Dogecoin' },
        { symbol: 'AVAXUSD', name: 'Avalanche' },
        { symbol: 'LTCUSD', name: 'Litecoin' },
        { symbol: 'LINKUSD', name: 'Chainlink' }
      ]
    };

    const normalizedType = assetType === 'stock' || assetType === 'stocks' ? 'stocks' : 
                           assetType === 'forex' ? 'forex' : 
                           assetType === 'crypto' ? 'crypto' : assetType;

    return fallbackAssets[normalizedType] || [];
  }

  /**
   * Get asset emoji
   */
  getAssetEmoji(assetType) {
    const emojis = {
      stocks: '📱',
      forex: '💱',
      crypto: '🪙'
    };
    return emojis[assetType] || '📊';
  }

  /**
   * Get main menu keyboard
   */
  getMainMenuKeyboard() {
    return [
      [
        { text: '📱 Stocks', callback_data: 'menu_stocks' },
        { text: '💱 Forex', callback_data: 'menu_forex' }
      ],
      [
        { text: '🪙 Crypto', callback_data: 'menu_crypto' },
        { text: '📊 My Stats', callback_data: 'menu_stats' }
      ],
      [
        { text: '⚙️ Settings', callback_data: 'menu_settings' }
      ]
    ];
  }

  /**
   * Generate mock analysis result
   */
  generateMockAnalysis(symbol) {
    const mockData = {
      price: (Math.random() * 200 + 100).toFixed(2),
      rsi: Math.floor(Math.random() * 40 + 30),
      macd: 'Bullish Crossover',
      bollinger: 'At Lower Band',
      ema: 'Above',
      sma: 'Above',
      stochastic: Math.floor(Math.random() * 40 + 20),
      volume: 'Increasing'
    };

    const confidence = Math.floor(Math.random() * 25 + 75);
    const signal = confidence > 80 ? 'STRONG BUY' : 'MODERATE BUY';
    const type = 'CALL';

    return `📊 *${symbol} ANALYSIS COMPLETE*

💰 Current Price: $${mockData.price}

📈 *TECHNICAL INDICATORS:*
├─ RSI (14): ${mockData.rsi} ✅ Neutral/Bullish
├─ MACD: ${mockData.macd} ✅
├─ Bollinger: ${mockData.bollinger} ✅
├─ 50 EMA: ${mockData.ema} ($174.20) ✅
├─ 200 SMA: ${mockData.sma} ($172.50) ✅
├─ Stochastic: ${mockData.stochastic} (Oversold) ✅
└─ Volume: ${mockData.volume} ✅

🎯 *SIGNAL: ${signal} (${type})*
📊 Confidence: ${confidence}%
⭐ Quality: Excellent

💡 *RECOMMENDED TRADE:*
Direction: ${type} (Price will go UP)
Amount: $5
Duration: 5 minutes
Potential Profit: $4.75 (95% payout)`;
  }

  /**
   * Generate mock trade result
   */
  generateMockTradeResult(symbol, direction, amount) {
    const profit = (amount * 0.95).toFixed(2);
    const entryPrice = (Math.random() * 200 + 100).toFixed(2);
    const exitPrice = (parseFloat(entryPrice) + Math.random() * 2).toFixed(2);

    return `✅ *TRADE EXECUTED SUCCESSFULLY!*

📍 Asset: ${symbol}
🎯 Type: Binary Option - ${direction}
💵 Investment: $${amount}.00
📊 Entry Price: $${entryPrice}
⏰ Entry Time: ${new Date().toLocaleTimeString()}
⌛ Expiry Time: ${new Date(Date.now() + 5 * 60 * 1000).toLocaleTimeString()} (5 min)
💰 Potential Profit: $${profit}

🔔 I'll monitor this trade and notify you when it closes!

📊 Current Open Positions: 1
💼 Today's Trades: ${Math.floor(Math.random() * 10) + 1}`;
  }
}

module.exports = CallbackHandler;