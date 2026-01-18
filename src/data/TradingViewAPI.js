/**
 * TradingView API Service
 * Handles data fetching from TradingView and other financial data sources
 */

const axios = require('axios');
const WebSocket = require('ws');
const Logger = require('../utils/Logger');
const ErrorHandler = require('../utils/ErrorHandler');
const Validator = require('../utils/Validator');

class TradingViewAPI {
  constructor() {
    this.logger = Logger.getInstance();
    this.config = {};
    this.cache = new Map();
    this.activeConnections = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize the TradingView API service
   */
  async initialize(config = {}) {
    try {
      // Load configuration
      this.config = {
        baseUrl: process.env.TRADINGVIEW_API_URL || 'https://api.tradingview.com',
        websocketUrl: process.env.TRADINGVIEW_WS_URL || 'wss://data.tradingview.com',
        apiKey: process.env.TRADINGVIEW_API_KEY,
        username: process.env.TRADINGVIEW_USERNAME,
        // Professional API keys (free tiers available)
        alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY,
        finnhubApiKey: process.env.FINNHUB_API_KEY,
        timeout: parseInt(process.env.API_TIMEOUT) || 30000,
        retryAttempts: 3,
        cacheEnabled: true,
        cacheTtl: 5 * 60 * 1000, // 5 minutes
        ...config
      };

      // Validate configuration
      if (!this.config.apiKey) {
        this.logger.warn('TradingView API key not configured - using mock data');
      }

      // Setup axios instance
      this.httpClient = axios.create({
        baseURL: this.config.baseUrl,
        timeout: this.config.timeout,
        headers: {
          'Authorization': this.config.apiKey ? `Bearer ${this.config.apiKey}` : undefined,
          'User-Agent': 'TradingBot/1.0'
        }
      });

      // Setup request/response interceptors
      this.setupInterceptors();

      this.isInitialized = true;
      this.logger.info('✅ TradingView API service initialized');

    } catch (error) {
      this.logger.error('Failed to initialize TradingView API', { error: error.message });
      throw error;
    }
  }

  /**
   * Setup axios interceptors for logging and error handling
   */
  setupInterceptors() {
    // Request interceptor
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.logApiCall('TradingView', config.url, config.method?.toUpperCase());
        return config;
      },
      (error) => {
        this.logger.logApiCall('TradingView', error.config?.url, 'ERROR');
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.logApiCall('TradingView', response.config.url, response.config.method?.toUpperCase(), response.status);
        return response;
      },
      (error) => {
        const status = error.response?.status;
        this.logger.logApiCall('TradingView', error.config?.url, error.config?.method?.toUpperCase(), status, null, error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get real-time price for a symbol
   */
  async getRealTimePrice(symbol, assetType = 'stock') {
    try {
      const cacheKey = `price_${symbol}_${assetType}`;
      const cached = this.getCachedData(cacheKey);

      if (cached) {
        return cached;
      }

      // Convert symbol to TradingView format
      const tvSymbol = this.convertToTradingViewSymbol(symbol, assetType);

      // Professional data source priority:
      // 1. Finnhub (all markets: stocks, crypto, forex) - 60 calls/min free
      // 2. Free APIs (Yahoo Finance, Binance, ExchangeRate-API) - no API key needed
      // 3. TradingView REST (if API key available) - paid
      // 4. Mock data - last resort
      let priceData;
      
      // Priority 1: Try Finnhub first (covers all markets)
      if (this.config.finnhubApiKey) {
        try {
          priceData = await this.fetchPriceViaFinnhub(symbol, assetType);
          this.logger.info('Real-time price fetched via Finnhub', { symbol, source: 'finnhub' });
        } catch (finnhubError) {
          this.logger.warn('Finnhub failed, trying free APIs', { symbol, error: finnhubError.message });
          // Fall through to free APIs
        }
      }

      // Priority 2: Try free alternative APIs (Yahoo Finance, Binance, ExchangeRate-API)
      if (!priceData) {
        try {
          priceData = await this.fetchPriceViaFreeAPI(symbol, assetType, tvSymbol);
          this.logger.info('Real-time price fetched via free API', { symbol, source: 'free_api' });
        } catch (freeApiError) {
          this.logger.warn('Free API failed, trying TradingView REST (if API key available)', { symbol, error: freeApiError.message });
          
          // Priority 3: Try TradingView REST API if API key is available (paid service)
          if (this.config.apiKey) {
            try {
              priceData = await this.fetchRealTimePrice(tvSymbol);
              this.logger.info('Price fetched via TradingView REST API', { symbol, source: 'tradingview_rest' });
            } catch (restError) {
              this.logger.warn('TradingView REST failed, using mock data', { symbol, error: restError.message });
              priceData = this.generateMockPriceData(symbol, assetType);
            }
          } else {
            // Last resort: mock data
            this.logger.warn('All APIs failed, using mock data', { symbol });
            priceData = this.generateMockPriceData(symbol, assetType);
          }
        }
      }

      // Cache the result
      this.setCachedData(cacheKey, priceData, 30000); // 30 second cache

      return priceData;

    } catch (error) {
      this.logger.error('Error getting real-time price', { symbol, assetType, error: error.message });
      throw error;
    }
  }

  /**
   * Get historical candlestick data
   */
  async getHistoricalData(symbol, assetType = 'stock', timeframe = '1D', barsCount = 100) {
    try {
      // Normalize timeframe for short Forex timeframes (10m -> 15m, 2m/3m -> 5m, etc.)
      const normalizedTimeframe = this.normalizeTimeframe ? this.normalizeTimeframe(timeframe) : timeframe;
      
      const cacheKey = `historical_${symbol}_${assetType}_${normalizedTimeframe}_${barsCount}`;
      const cached = this.getCachedData(cacheKey);

      if (cached) {
        return cached;
      }
      
      // Convert symbol to TradingView format
      const tvSymbol = this.convertToTradingViewSymbol(symbol, assetType);

      // Validate parameters (check normalized timeframe)
      if (!this.isValidTimeframe(normalizedTimeframe)) {
        throw new Error(`Invalid timeframe: ${timeframe} (normalized: ${normalizedTimeframe})`);
      }

      if (barsCount < 1 || barsCount > 5000) {
        throw new Error(`Invalid bars count: ${barsCount}. Must be between 1 and 5000`);
      }

      let historicalData;

      // Professional data source priority:
      // 1. Finnhub (all markets: stocks, crypto, forex) - 60 calls/min free
      // 2. Alpha Vantage (forex) - 5 calls/min, 500/day free
      // 3. Free APIs (Yahoo Finance, Binance) - no API key needed
      // 4. TradingView REST (if API key available) - paid
      // 5. Mock data - last resort

      try {
        // Priority 1: Try Finnhub first (covers all markets)
        if (this.config.finnhubApiKey) {
          try {
            historicalData = await this.fetchHistoricalViaFinnhub(symbol, assetType, normalizedTimeframe, barsCount);
            this.logger.info('Historical data fetched via Finnhub', { symbol, timeframe: normalizedTimeframe, source: 'finnhub' });
          } catch (finnhubError) {
            this.logger.warn('Finnhub historical data failed, trying fallback APIs', { symbol, assetType, error: finnhubError.message });
            throw finnhubError; // Re-throw to continue to next try-catch
          }
        } else {
          throw new Error('Finnhub API key not configured');
        }
      } catch (finnhubOrConfigError) {
        // Priority 2: Try Alpha Vantage for forex
        if (assetType === 'forex' && this.config.alphaVantageApiKey) {
          try {
            historicalData = await this.fetchHistoricalViaAlphaVantage(symbol, assetType, normalizedTimeframe, barsCount);
            this.logger.info('Historical data fetched via Alpha Vantage', { symbol, timeframe: normalizedTimeframe, source: 'alpha_vantage' });
          } catch (alphaVantageError) {
            this.logger.warn('Alpha Vantage failed, trying free APIs', { symbol, error: alphaVantageError.message });
            // Fall through to free APIs
          }
        }

        // Priority 3: Try free APIs (Yahoo Finance, Binance, etc.) - no API key needed
        if (!historicalData) {
          try {
            historicalData = await this.fetchHistoricalViaFreeAPI(symbol, assetType, tvSymbol, normalizedTimeframe, barsCount);
            this.logger.info('Historical data fetched via free API', { symbol, timeframe: normalizedTimeframe, source: 'free_api' });
          } catch (freeApiError) {
            this.logger.warn('Free API failed, trying TradingView REST (if API key available)', { symbol, error: freeApiError.message });
            
            // Priority 4: Try TradingView REST API if API key is available (paid service)
            if (this.config.apiKey) {
              try {
                historicalData = await this.fetchHistoricalData(tvSymbol, normalizedTimeframe, barsCount);
                this.logger.info('Historical data fetched via TradingView REST API', { symbol, source: 'tradingview_rest' });
              } catch (restError) {
                this.logger.warn('TradingView REST failed, using mock historical data', { symbol, error: restError.message });
                historicalData = this.generateMockHistoricalData(symbol, assetType, normalizedTimeframe, barsCount);
              }
            } else {
              // Last resort: mock data
              this.logger.warn('All APIs failed, using mock historical data', { symbol });
              historicalData = this.generateMockHistoricalData(symbol, assetType, normalizedTimeframe, barsCount);
            }
          }
        }
      }

      // Cache the result (longer cache for historical data)
      this.setCachedData(cacheKey, historicalData, 300000); // 5 minute cache

      return historicalData;

    } catch (error) {
      this.logger.error('Error getting historical data', { symbol, assetType, timeframe, barsCount, error: error.message });
      throw error;
    }
  }

  /**
   * Fetch real-time price from TradingView API
   */
  async fetchRealTimePrice(tvSymbol) {
    try {
      const response = await this.httpClient.get('/api/v1/quote', {
        params: {
          symbol: tvSymbol,
          fields: 'price,change,change_percent,volume,market_cap'
        }
      });

      const data = response.data;

      return {
        symbol: tvSymbol,
        price: parseFloat(data.price),
        change: parseFloat(data.change || 0),
        changePercent: parseFloat(data.change_percent || 0),
        volume: parseInt(data.volume || 0),
        marketCap: parseFloat(data.market_cap || 0),
        timestamp: new Date(),
        source: 'tradingview_api'
      };

    } catch (error) {
      throw ErrorHandler.handleTradingViewError(error, { symbol: tvSymbol });
    }
  }

  /**
   * Fetch historical data from TradingView API
   */
  async fetchHistoricalData(tvSymbol, timeframe, barsCount) {
    try {
      const response = await this.httpClient.get('/api/v1/history', {
        params: {
          symbol: tvSymbol,
          resolution: this.convertTimeframeToResolution(timeframe),
          count: barsCount,
          fields: 'timestamp,open,high,low,close,volume'
        }
      });

      const data = response.data;

      // Convert to OHLCV format
      const candles = [];
      for (let i = 0; i < data.timestamp.length; i++) {
        candles.push({
          timestamp: new Date(data.timestamp[i] * 1000),
          open: parseFloat(data.open[i]),
          high: parseFloat(data.high[i]),
          low: parseFloat(data.low[i]),
          close: parseFloat(data.close[i]),
          volume: parseInt(data.volume[i] || 0)
        });
      }

      return {
        symbol: tvSymbol,
        timeframe,
        candles,
        count: candles.length,
        source: 'tradingview_api'
      };

    } catch (error) {
      throw ErrorHandler.handleTradingViewError(error, {
        symbol: tvSymbol,
        timeframe,
        barsCount
      });
    }
  }

  /**
   * Generate mock price data for development/testing
   */
  generateMockPriceData(symbol, assetType) {
    const basePrices = {
      stock: 150,
      forex: 1.0,
      crypto: 50000
    };

    const basePrice = basePrices[assetType] || 100;
    const price = basePrice + (Math.random() - 0.5) * basePrice * 0.1; // ±10% variation
    const change = (Math.random() - 0.5) * price * 0.05; // ±5% change
    const changePercent = (change / (price - change)) * 100;

    return {
      symbol: this.convertToTradingViewSymbol(symbol, assetType),
      price: parseFloat(price.toFixed(assetType === 'forex' ? 5 : 2)),
      change: parseFloat(change.toFixed(assetType === 'forex' ? 5 : 2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      volume: Math.floor(Math.random() * 1000000),
      marketCap: assetType === 'crypto' ? Math.floor(Math.random() * 1000000000) : undefined,
      timestamp: new Date(),
      source: 'mock_data'
    };
  }

  /**
   * Generate mock historical data
   */
  generateMockHistoricalData(symbol, assetType, timeframe, barsCount) {
    const candles = [];
    const basePrices = {
      stock: 150,
      forex: 1.0,
      crypto: 50000
    };

    const basePrice = basePrices[assetType] || 100;
    let currentPrice = basePrice;
    const now = new Date();

    // Generate candles going backwards from now
    for (let i = barsCount - 1; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - (i * this.getTimeframeMs(timeframe)));

      // Simulate price movement
      const volatility = assetType === 'crypto' ? 0.05 : assetType === 'forex' ? 0.01 : 0.02;
      const change = (Math.random() - 0.5) * currentPrice * volatility;
      currentPrice += change;

      // Ensure price doesn't go negative
      currentPrice = Math.max(currentPrice, basePrice * 0.1);

      // Generate OHLC
      const open = currentPrice;
      const volatility_range = currentPrice * (volatility / 2);
      const high = open + Math.random() * volatility_range;
      const low = open - Math.random() * volatility_range;
      const close = low + Math.random() * (high - low);
      const volume = Math.floor(Math.random() * 1000000);

      candles.push({
        timestamp,
        open: parseFloat(open.toFixed(assetType === 'forex' ? 5 : 2)),
        high: parseFloat(high.toFixed(assetType === 'forex' ? 5 : 2)),
        low: parseFloat(low.toFixed(assetType === 'forex' ? 5 : 2)),
        close: parseFloat(close.toFixed(assetType === 'forex' ? 5 : 2)),
        volume
      });

      currentPrice = close;
    }

    return {
      symbol: this.convertToTradingViewSymbol(symbol, assetType),
      timeframe,
      candles,
      count: candles.length,
      source: 'mock_data'
    };
  }

  /**
   * Convert symbol to TradingView format
   */
  convertToTradingViewSymbol(symbol, assetType) {
    // Load asset mappings from config
    const assets = require('../../config/assets.json');

    if (assets[assetType] && assets[assetType][symbol]) {
      return assets[assetType][symbol].tradingview_symbol || symbol;
    }

    // Fallback conversions
    switch (assetType) {
      case 'stock':
        return `NASDAQ:${symbol}`;
      case 'forex':
        return `FX:${symbol}`;
      case 'crypto':
        return `BINANCE:${symbol}USDT`;
      default:
        return symbol;
    }
  }

  /**
   * Convert timeframe to TradingView resolution
   */
  convertTimeframeToResolution(timeframe) {
    const resolutions = {
      '1m': '1',
      '5m': '5',
      '15m': '15',
      '30m': '30',
      '1H': '60',
      '4H': '240',
      '1D': 'D',
      '1W': 'W',
      '1M': 'M'
    };

    return resolutions[timeframe] || 'D';
  }

  /**
   * Get timeframe in milliseconds
   */
  getTimeframeMs(timeframe) {
    const multipliers = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1H': 60 * 60 * 1000,
      '4H': 4 * 60 * 60 * 1000,
      '1D': 24 * 60 * 60 * 1000,
      '1W': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000
    };

    return multipliers[timeframe] || 24 * 60 * 60 * 1000;
  }

  /**
   * Validate timeframe
   */
  isValidTimeframe(timeframe) {
    const validTimeframes = ['5s', '15s', '30s', '1m', '2m', '3m', '5m', '10m', '15m', '30m', '1H', '4H', '1D', '1W', '1M'];
    return validTimeframes.includes(timeframe);
  }

  /**
   * Normalize timeframe - convert short timeframes to supported ones
   */
  normalizeTimeframe(timeframe) {
    // Map short timeframes to closest supported TradingView timeframe
    const timeframeMap = {
      '5s': '1m',   // Map 5 seconds to 1 minute
      '15s': '1m',  // Map 15 seconds to 1 minute
      '30s': '1m',  // Map 30 seconds to 1 minute
      '2m': '5m',   // Map 2 minutes to 5 minutes
      '3m': '5m',   // Map 3 minutes to 5 minutes
      '10m': '15m'  // Map 10 minutes to 15 minutes (closest)
    };

    return timeframeMap[timeframe] || timeframe;
  }

  /**
   * Get cached data
   */
  getCachedData(key) {
    if (!this.config.cacheEnabled) return null;

    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cached data
   */
  setCachedData(key, data, ttl = null) {
    if (!this.config.cacheEnabled) return;

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.cacheTtl
    });
  }

  /**
   * Clear cache
   */
  clearCache(pattern = null) {
    if (pattern) {
      // Clear cache entries matching pattern
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
    }

    this.logger.info('Cache cleared', { pattern });
  }

  /**
   * Get market status
   */
  getMarketStatus(assetType, symbol = null) {
    // Load market hours from config
    const assets = require('../../config/assets.json');
    const marketStatus = assets.market_status?.[assetType];

    if (!marketStatus) {
      return { status: 'unknown', message: 'Market status unavailable' };
    }

    const now = new Date();
    const timezone = marketStatus.timezone || 'America/New_York';

    // Convert to market timezone
    const marketTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const currentHour = marketTime.getHours();
    const currentMinute = marketTime.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const openTime = this.parseTime(marketStatus.open);
    const closeTime = this.parseTime(marketStatus.close);

    let status = 'closed';
    let message = 'Market is closed';

    if (marketStatus.session === '24/7') {
      status = 'open';
      message = 'Market is open 24/7';
    } else {
      const isWeekend = marketTime.getDay() === 0 || marketTime.getDay() === 6;
      const holidays = marketStatus.holidays || [];

      // Check if today is a holiday
      const todayString = marketTime.toISOString().split('T')[0];
      const isHoliday = holidays.includes(todayString);

      if (!isWeekend && !isHoliday && currentTime >= openTime && currentTime <= closeTime) {
        status = 'open';
        message = `Market is open (${marketStatus.open} - ${marketStatus.close} ${timezone})`;
      } else if (isHoliday) {
        message = 'Market is closed (holiday)';
      } else if (isWeekend) {
        message = 'Market is closed (weekend)';
      } else {
        message = `Market is closed (${marketStatus.open} - ${marketStatus.close} ${timezone})`;
      }
    }

    return {
      status,
      message,
      timezone,
      nextOpen: status === 'closed' ? this.getNextOpenTime(marketStatus, marketTime) : null
    };
  }

  /**
   * Parse time string to minutes
   */
  parseTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Get next market open time
   */
  getNextOpenTime(marketStatus, currentTime) {
    // Simplified - in production would handle holidays, weekends, etc.
    const openTime = this.parseTime(marketStatus.open);
    const closeTime = this.parseTime(marketStatus.close);

    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

    if (currentMinutes < openTime) {
      // Opens today
      return new Date(currentTime);
    } else {
      // Opens tomorrow
      const tomorrow = new Date(currentTime);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }
  }

  /**
   * Search symbols
   */
  async searchSymbols(query, assetType = null, limit = 10) {
    try {
      // Load assets from config
      const assets = require('../../config/assets.json');
      const results = [];

      // Search through all asset types or specific type
      const typesToSearch = assetType ? [assetType] : Object.keys(assets);

      for (const type of typesToSearch) {
        if (!assets[type] || typeof assets[type] !== 'object') continue;

        for (const [symbol, assetData] of Object.entries(assets[type])) {
          if (results.length >= limit) break;

          // Search by symbol or name
          const searchTerm = query.toLowerCase();
          if (symbol.toLowerCase().includes(searchTerm) ||
              assetData.name.toLowerCase().includes(searchTerm)) {

            results.push({
              symbol,
              name: assetData.name,
              type,
              tradingview_symbol: assetData.tradingview_symbol,
              exchange: assetData.exchange,
              category: assetData.category
            });
          }
        }
      }

      return {
        query,
        results,
        count: results.length,
        source: 'config_data'
      };

    } catch (error) {
      this.logger.error('Error searching symbols', { query, assetType, error: error.message });
      throw error;
    }
  }

  /**
   * Get asset information
   */
  getAssetInfo(symbol, assetType = null) {
    const assets = require('../../config/assets.json');

    // Search through all asset types
    const typesToSearch = assetType ? [assetType] : Object.keys(assets);

    for (const type of typesToSearch) {
      if (assets[type] && assets[type][symbol]) {
        return {
          ...assets[type][symbol],
          symbol,
          type
        };
      }
    }

    return null;
  }

  /**
   * Fetch price via free alternative APIs (Yahoo Finance, CoinGecko, ExchangeRate-API)
   * Priority: Free APIs > TradingView WebSocket > TradingView REST > Mock
   */
  /**
   * Fetch real-time price via Finnhub API (all markets)
   * Free tier: 60 calls/min
   */
  async fetchPriceViaFinnhub(symbol, assetType) {
    try {
      if (!this.config.finnhubApiKey) {
        throw new Error('Finnhub API key not configured');
      }

      // Convert symbol to Finnhub format
      let finnhubSymbol = symbol;
      if (assetType === 'forex') {
        // Finnhub forex format: OANDA:EUR_USD
        finnhubSymbol = `OANDA:${symbol.substring(0, 3)}_${symbol.substring(3, 6)}`;
      } else if (assetType === 'crypto') {
        // Finnhub crypto format: BINANCE:BTCUSDT
        // Convert BTCUSD -> BTCUSDT for Binance
        const baseSymbol = symbol.replace('USD', '');
        finnhubSymbol = `BINANCE:${baseSymbol}USDT`;
      }
      // Stocks use symbol as-is

      const apiUrl = 'https://finnhub.io/api/v1/quote';
      const response = await axios.get(apiUrl, {
        params: {
          symbol: finnhubSymbol,
          token: this.config.finnhubApiKey
        },
        timeout: 5000,
        validateStatus: (status) => status < 500 // Accept 4xx for error handling
      });

      const data = response.data;

      // Handle API errors
      if (response.status === 403) {
        throw new Error('Finnhub API key invalid or rate limit exceeded. Check your API key in .env');
      }
      if (response.status === 429) {
        throw new Error('Finnhub rate limit exceeded (60 calls/min free tier). Please wait.');
      }

      if (!data || !data.c || data.c === 0) {
        throw new Error(`Finnhub returned invalid price data for ${finnhubSymbol} (response: ${JSON.stringify(data).substring(0, 100)})`);
      }

      return {
        symbol,
        price: parseFloat(data.c), // Current price
        change: parseFloat(data.d || 0), // Change amount
        changePercent: parseFloat(data.dp || 0), // Change percent
        high: parseFloat(data.h || 0), // High
        low: parseFloat(data.l || 0), // Low
        open: parseFloat(data.o || 0), // Open
        previousClose: parseFloat(data.pc || 0), // Previous close
        timestamp: new Date(),
        source: 'finnhub'
      };

    } catch (error) {
      throw new Error(`Finnhub price fetch failed: ${error.message}`);
    }
  }

  async fetchPriceViaFreeAPI(symbol, assetType, tvSymbol) {
    try {
      if (assetType === 'stock') {
        // Use Yahoo Finance v8 chart API for stocks (free, reliable, works without auth)
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
        
        const response = await axios.get(yahooUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json',
            'Referer': 'https://finance.yahoo.com/'
          },
          timeout: 5000
        });
        
        const result = response.data;
        if (result.chart && result.chart.result && result.chart.result[0]) {
          const quote = result.chart.result[0].meta;
          const price = quote.regularMarketPrice || quote.previousClose || quote.chartPreviousClose;
          const previousClose = quote.previousClose || quote.chartPreviousClose || price;
          const change = price - previousClose;
          const changePercent = previousClose ? ((change / previousClose) * 100) : 0;
          
          return {
            symbol: tvSymbol,
            price: parseFloat(price.toFixed(2)),
            change: parseFloat(change.toFixed(2)),
            changePercent: parseFloat(changePercent.toFixed(2)),
            volume: parseInt(quote.regularMarketVolume || 0),
            marketCap: parseFloat(quote.marketCap || 0),
            timestamp: new Date(),
            source: 'yahoo_finance'
          };
        }
        throw new Error('Invalid Yahoo Finance response');
        
      } else if (assetType === 'crypto') {
        // Use Binance Public API for crypto (free, no auth, high rate limits)
        // Convert symbol format: BTCUSD -> BTCUSDT
        const base = symbol.replace('USD', '').toUpperCase();
        const binanceSymbol = `${base}USDT`;
        
        const binanceUrl = `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`;
        
        try {
          const response = await axios.get(binanceUrl, {
            headers: {
              'Accept': 'application/json'
            },
            timeout: 5000
          });
          
          const result = response.data;
          if (result.lastPrice) {
            const price = parseFloat(result.lastPrice);
            const openPrice = parseFloat(result.openPrice || result.prevClosePrice || price);
            const change = price - openPrice;
            const changePercent = openPrice ? ((change / openPrice) * 100) : 0;
            
            return {
              symbol: tvSymbol,
              price: parseFloat(price.toFixed(2)),
              change: parseFloat(change.toFixed(2)),
              changePercent: parseFloat(changePercent.toFixed(2)),
              volume: parseFloat(result.volume || 0),
              marketCap: 0,
              timestamp: new Date(),
              source: 'binance'
            };
          }
        } catch (binanceError) {
          // Fallback to CoinGecko if Binance fails
          const coinMap = {
            'BTCUSD': 'bitcoin',
            'ETHUSD': 'ethereum',
            'BNBUSD': 'binancecoin',
            'ADAUSD': 'cardano',
            'SOLUSD': 'solana',
            'DOTUSD': 'polkadot',
            'DOGEUSD': 'dogecoin',
            'AVAXUSD': 'avalanche-2',
            'LTCUSD': 'litecoin',
            'LINKUSD': 'chainlink'
          };
          
          const coinId = coinMap[symbol] || symbol.toLowerCase().replace('usd', '');
          const coinGeckoUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`;
          
          const response = await axios.get(coinGeckoUrl, {
            headers: { 'Accept': 'application/json' },
            timeout: 5000
          });
          
          const result = response.data;
          if (result[coinId] && result[coinId].usd) {
            const price = result[coinId].usd;
            const changePercent = result[coinId].usd_24h_change || 0;
            const change = (price * changePercent) / 100;
            
            return {
              symbol: tvSymbol,
              price: parseFloat(price.toFixed(2)),
              change: parseFloat(change.toFixed(2)),
              changePercent: parseFloat(changePercent.toFixed(2)),
              volume: 0,
              marketCap: 0,
              timestamp: new Date(),
              source: 'coingecko'
            };
          }
        }
        throw new Error('Binance and CoinGecko both failed');
        
      } else if (assetType === 'forex') {
        // Use ExchangeRate-API for forex (free, reliable)
        const base = symbol.substring(0, 3); // Extract base currency (e.g., "EUR" from "EURUSD")
        const quote = symbol.substring(3, 6); // Extract quote currency (e.g., "USD" from "EURUSD")
        
        const exchangeRateUrl = `https://api.exchangerate-api.com/v4/latest/${base}`;
        
        const response = await axios.get(exchangeRateUrl, {
          headers: {
            'Accept': 'application/json'
          },
          timeout: 5000
        });
        
        const result = response.data;
        if (result.rates && result.rates[quote]) {
          const rate = result.rates[quote];
          // For forex, we calculate a small change (0.01%) to simulate market movement
          // Real change would require historical data
          const change = rate * 0.0001;
          const changePercent = 0.01;
          
          return {
            symbol: tvSymbol,
            price: parseFloat(rate.toFixed(5)),
            change: parseFloat(change.toFixed(5)),
            changePercent: parseFloat(changePercent.toFixed(2)),
            volume: 0,
            marketCap: 0,
            timestamp: new Date(),
            source: 'exchangerate_api'
          };
        }
        throw new Error('Invalid ExchangeRate-API response');
      }
      
      throw new Error(`Unsupported asset type: ${assetType}`);
      
    } catch (error) {
      throw new Error(`Free API fetch failed: ${error.message}`);
    }
  }

  /**
   * Convert crypto symbol to CoinGecko coin ID
   */
  convertCryptoToCoinGecko(symbol) {
    const coinMap = {
      'BTCUSD': 'bitcoin',
      'ETHUSD': 'ethereum',
      'BNBUSD': 'binancecoin',
      'ADAUSD': 'cardano',
      'SOLUSD': 'solana',
      'DOTUSD': 'polkadot',
      'DOGEUSD': 'dogecoin',
      'AVAXUSD': 'avalanche-2',
      'LTCUSD': 'litecoin',
      'LINKUSD': 'chainlink'
    };
    return coinMap[symbol] || symbol.toLowerCase().replace('usd', '');
  }

  /**
   * Fetch price via TradingView WebSocket (FREE - no API key needed)
   * Uses TradingView's public UDF (Universal Data Feed) protocol
   */
  async fetchPriceViaWebSocket(tvSymbol, assetType) {
    try {
      // Use TradingView's public quote endpoint via axios (better error handling)
      // Endpoint: https://scanner.tradingview.com/quote
      const quoteUrl = `https://scanner.tradingview.com/quote`;
      
      const response = await axios.get(quoteUrl, {
        params: {
          symbols: tvSymbol
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.tradingview.com/'
        },
        timeout: 5000,
        validateStatus: (status) => status === 200
      });
      
      const result = response.data;
      
      // TradingView quote response format can vary - try multiple formats
      let quoteData = null;
      
      if (result.d && Array.isArray(result.d) && result.d.length > 0) {
        // Format 1: {d: [{v: {lp: price, ch: change, chp: changePercent}}]}
        const quote = result.d[0];
        if (quote.v) {
          quoteData = {
            price: parseFloat(quote.v.lp || quote.v.last_price || 0),
            change: parseFloat(quote.v.ch || quote.v.change || 0),
            changePercent: parseFloat(quote.v.chp || quote.v.change_percent || 0),
            volume: parseInt(quote.v.volume || 0),
            marketCap: parseFloat(quote.v.market_cap || 0)
          };
        } else if (Array.isArray(quote)) {
          // Format 2: {d: [[symbol, price, change, changePercent, volume]]}
          quoteData = {
            price: parseFloat(quote[1] || 0),
            change: parseFloat(quote[2] || 0),
            changePercent: parseFloat(quote[3] || 0),
            volume: parseInt(quote[4] || 0),
            marketCap: parseFloat(quote[5] || 0)
          };
        }
      } else if (result.s === 'ok' && result.d) {
        // Alternative format
        quoteData = {
          price: parseFloat(result.d.lp || result.d.last_price || 0),
          change: parseFloat(result.d.ch || result.d.change || 0),
          changePercent: parseFloat(result.d.chp || result.d.change_percent || 0),
          volume: parseInt(result.d.volume || 0),
          marketCap: parseFloat(result.d.market_cap || 0)
        };
      }
      
      if (quoteData && quoteData.price && quoteData.price > 0) {
        return {
          symbol: tvSymbol,
          price: quoteData.price,
          change: quoteData.change,
          changePercent: quoteData.changePercent,
          volume: quoteData.volume,
          marketCap: quoteData.marketCap,
          timestamp: new Date(),
          source: 'tradingview_websocket'
        };
      } else {
        throw new Error('Invalid price data format from TradingView');
      }
      
    } catch (error) {
      // If axios fails, it will throw - catch and rethrow with context
      throw new Error(`TradingView quote fetch failed: ${error.message}`);
    }
  }

  /**
   * Fetch historical data via TradingView WebSocket/UDF (FREE - no API key needed)
   * Uses TradingView's public UDF endpoint for historical candles
   */
  async fetchHistoricalViaWebSocket(tvSymbol, timeframe, barsCount) {
    try {
      // TradingView UDF history endpoint
      // Format: https://scanner.tradingview.com/history?symbol=SYMBOL&resolution=RESOLUTION&from=FROM&to=TO
      const resolution = this.convertTimeframeToResolution(timeframe);
      const to = Math.floor(Date.now() / 1000);
      const timeframeMs = this.getTimeframeMs(timeframe);
      const from = to - (barsCount * timeframeMs / 1000);
      
      const historyUrl = `https://scanner.tradingview.com/history`;
      
      const response = await axios.get(historyUrl, {
        params: {
          symbol: tvSymbol,
          resolution: resolution,
          from: from,
          to: to
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.tradingview.com/'
        },
        timeout: 10000,
        validateStatus: (status) => status === 200
      });
      
      const result = response.data;
      
      // Check if response is a string (some TradingView endpoints return text/html)
      if (typeof result === 'string') {
        // Try to parse as JSON if it's a JSON string
        try {
          const parsed = JSON.parse(result);
          return this.parseHistoryResponse(parsed, tvSymbol, timeframe);
        } catch (e) {
          throw new Error(`TradingView returned non-JSON response: ${result.substring(0, 100)}`);
        }
      }
      
      return this.parseHistoryResponse(result, tvSymbol, timeframe);
      
    } catch (error) {
      throw new Error(`TradingView history fetch failed: ${error.message}`);
    }
  }

  /**
   * Fetch historical data via Alpha Vantage API (Best for Forex)
   * Free tier: 5 calls/min, 500 calls/day
   * API: https://www.alphavantage.co/documentation/
   */
  async fetchHistoricalViaAlphaVantage(symbol, assetType, timeframe, barsCount) {
    try {
      if (!this.config.alphaVantageApiKey) {
        throw new Error('Alpha Vantage API key not configured');
      }

      if (assetType !== 'forex') {
        throw new Error('Alpha Vantage is primarily for forex data');
      }

      // Alpha Vantage forex format: FX_DAILY, FX_INTRADAY
      // For intraday, need: interval (1min, 5min, 15min, 30min, 60min)
      const timeframeMap = {
        '1m': '1min',
        '5m': '5min',
        '15m': '15min',
        '30m': '30min',
        '1H': '60min',
        '4H': '60min', // Alpha Vantage max is 60min, use daily for higher
        '1D': 'daily',
        '1W': 'weekly',
        '1M': 'monthly'
      };

      const interval = timeframeMap[timeframe] || 'daily';
      const functionName = interval === 'daily' || interval === 'weekly' || interval === 'monthly' 
        ? `FX_${interval.toUpperCase()}` 
        : 'FX_INTRADAY';

      const apiUrl = 'https://www.alphavantage.co/query';
      const params = {
        function: functionName,
        from_symbol: symbol.substring(0, 3), // EUR from EURUSD
        to_symbol: symbol.substring(3, 6),   // USD from EURUSD
        apikey: this.config.alphaVantageApiKey
      };

      if (functionName === 'FX_INTRADAY') {
        params.interval = interval;
        params.outputsize = barsCount > 100 ? 'full' : 'compact';
      }

      const response = await axios.get(apiUrl, {
        params,
        timeout: 10000,
        headers: {
          'User-Agent': 'TradingBot/1.0'
        }
      });

      const data = response.data;

      // Check for API error messages and info
      if (data['Error Message']) {
        throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
      }
      if (data['Note']) {
        throw new Error('Alpha Vantage API call limit exceeded (free tier: 5/min, 500/day)');
      }
      if (data['Information']) {
        // "Information" key indicates rate limit, subscription requirement, or other info
        const infoMsg = data['Information'];
        if (infoMsg.includes('API call frequency') || infoMsg.includes('Thank you for using')) {
          throw new Error('Alpha Vantage rate limit: 5 calls/min, 500/day (free tier). Please wait before retrying.');
        }
        throw new Error(`Alpha Vantage: ${infoMsg} (FX_INTRADAY may require premium subscription for short timeframes)`);
      }

      // Parse response (format varies by function)
      // For FX_INTRADAY: { "Meta Data": {...}, "Time Series FX (5min)": {...} }
      // For FX_DAILY: { "Meta Data": {...}, "Time Series FX (Daily)": {...} }
      const timeSeriesKey = Object.keys(data).find(key => 
        key.includes('Time Series') || key.includes('Technical Analysis')
      );
      
      if (!timeSeriesKey || !data[timeSeriesKey]) {
        // Provide more context about what was received
        const responseKeys = Object.keys(data).join(', ');
        const errorDetail = responseKeys ? ` (response keys: ${responseKeys.substring(0, 100)})` : ' (empty response)';
        throw new Error(`Invalid Alpha Vantage response format${errorDetail}. This may indicate an invalid API key or unsupported function: ${functionName}`);
      }

      const timeSeries = data[timeSeriesKey];
      const candles = [];
      const sortedKeys = Object.keys(timeSeries).sort((a, b) => new Date(a) - new Date(b)).slice(-barsCount);

      for (const timestamp of sortedKeys) {
        const candle = timeSeries[timestamp];
        candles.push({
          timestamp: new Date(timestamp),
          open: parseFloat(candle['1. open'] || candle['open']),
          high: parseFloat(candle['2. high'] || candle['high']),
          low: parseFloat(candle['3. low'] || candle['low']),
          close: parseFloat(candle['4. close'] || candle['close']),
          volume: 0 // Alpha Vantage forex doesn't include volume
        });
      }

      if (candles.length === 0) {
        throw new Error('Alpha Vantage returned no candles');
      }

      return {
        symbol,
        timeframe,
        candles,
        count: candles.length,
        source: 'alpha_vantage'
      };

    } catch (error) {
      throw new Error(`Alpha Vantage fetch failed: ${error.message}`);
    }
  }

  /**
   * Fetch historical data via Finnhub API (Multi-market: Stocks, Crypto, Forex)
   * Free tier: 60 calls/min
   * API: https://finnhub.io/docs/api
   */
  async fetchHistoricalViaFinnhub(symbol, assetType, timeframe, barsCount) {
    try {
      if (!this.config.finnhubApiKey) {
        throw new Error('Finnhub API key not configured');
      }

      // Convert symbol to Finnhub format
      let finnhubSymbol = symbol;
      if (assetType === 'forex') {
        // Finnhub forex format: OANDA:EUR_USD
        finnhubSymbol = `OANDA:${symbol.substring(0, 3)}_${symbol.substring(3, 6)}`;
      } else if (assetType === 'crypto') {
        // Finnhub crypto format: BINANCE:BTCUSDT
        // Convert BTCUSD -> BTCUSDT for Binance
        const baseSymbol = symbol.replace('USD', '');
        finnhubSymbol = `BINANCE:${baseSymbol}USDT`;
      }
      // Stocks use symbol as-is

      // Convert timeframe to Finnhub resolution
      const resolutionMap = {
        '1m': '1',
        '5m': '5',
        '15m': '15',
        '30m': '30',
        '1H': '60',
        '4H': '240',
        '1D': 'D',
        '1W': 'W',
        '1M': 'M'
      };

      const resolution = resolutionMap[timeframe] || 'D';
      const from = Math.floor(Date.now() / 1000) - (barsCount * this.getTimeframeMs(timeframe) / 1000);
      const to = Math.floor(Date.now() / 1000);

      const apiUrl = 'https://finnhub.io/api/v1/candle';
      const response = await axios.get(apiUrl, {
        params: {
          symbol: finnhubSymbol,
          resolution: resolution,
          from: from,
          to: to,
          token: this.config.finnhubApiKey
        },
        timeout: 10000,
        validateStatus: (status) => status < 500 // Accept 4xx for error handling
      });

      const data = response.data;

      // Handle HTTP errors
      if (response.status === 403) {
        throw new Error('Finnhub API key invalid or rate limit exceeded. Check your API key in .env');
      }
      if (response.status === 429) {
        throw new Error('Finnhub rate limit exceeded (60 calls/min free tier). Please wait.');
      }

      // Detect HTML responses (indicates premium tier required or invalid endpoint)
      if (typeof data === 'string' && data.includes('<!DOCTYPE html>')) {
        throw new Error(`Finnhub historical data requires premium subscription. Free tier only supports real-time quotes. Falling back to free APIs.`);
      }

      // Handle API response errors
      // Finnhub candle API returns {s: 'ok', t: [...], o: [...], h: [...], l: [...], c: [...], v: [...]}
      // Or {s: 'error', error: 'error message'} on failure
      if (!data || typeof data !== 'object') {
        throw new Error(`Finnhub returned invalid response format (symbol: ${finnhubSymbol}). Historical candles may require premium subscription.`);
      }

      // Check status field
      if (data.s && data.s !== 'ok') {
        // 's' can be 'ok', 'no_data', 'error', or other status codes
        const errorMsg = data.error || data.s || 'Unknown error';
        if (data.s === 'no_data') {
          throw new Error(`Finnhub: No data available for ${finnhubSymbol} at ${resolution} resolution (this symbol/resolution may not be supported)`);
        }
        throw new Error(`Finnhub error: ${errorMsg} (symbol: ${finnhubSymbol}, resolution: ${resolution}, status: ${data.s})`);
      }

      // If status is not 'ok', check if we have data anyway (some responses don't include 's')
      if (!data.s && (!data.t || !Array.isArray(data.t) || data.t.length === 0)) {
        throw new Error(`Finnhub: No data available for ${finnhubSymbol} (check if symbol format and resolution are valid)`);
      }

      if (!data.t || data.t.length === 0) {
        throw new Error('Finnhub returned no candles');
      }

      const candles = [];
      for (let i = 0; i < data.t.length; i++) {
        candles.push({
          timestamp: new Date(data.t[i] * 1000),
          open: parseFloat(data.o[i]),
          high: parseFloat(data.h[i]),
          low: parseFloat(data.l[i]),
          close: parseFloat(data.c[i]),
          volume: parseFloat(data.v[i] || 0)
        });
      }

      return {
        symbol,
        timeframe,
        candles,
        count: candles.length,
        source: 'finnhub'
      };

    } catch (error) {
      throw new Error(`Finnhub fetch failed: ${error.message}`);
    }
  }

  /**
   * Fetch historical data via free alternative APIs
   */
  async fetchHistoricalViaFreeAPI(symbol, assetType, tvSymbol, timeframe, barsCount) {
    try {
      if (assetType === 'stock') {
        // Use Yahoo Finance for historical data (free, reliable)
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
        const interval = this.convertTimeframeToYahooInterval(timeframe);
        const period1 = Math.floor(Date.now() / 1000) - (barsCount * this.getTimeframeMs(timeframe) / 1000);
        const period2 = Math.floor(Date.now() / 1000);
        
        const response = await axios.get(yahooUrl, {
          params: {
            interval: interval,
            period1: period1,
            period2: period2
          },
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json'
          },
          timeout: 10000
        });
        
        const result = response.data;
        if (result.chart && result.chart.result && result.chart.result[0]) {
          const chart = result.chart.result[0];
          const timestamps = chart.timestamp || [];
          const quotes = chart.indicators?.quote?.[0] || {};
          const opens = quotes.open || [];
          const highs = quotes.high || [];
          const lows = quotes.low || [];
          const closes = quotes.close || [];
          const volumes = quotes.volume || [];
          
          const candles = [];
          for (let i = 0; i < timestamps.length; i++) {
            candles.push({
              timestamp: new Date(timestamps[i] * 1000),
              open: parseFloat(opens[i] || 0),
              high: parseFloat(highs[i] || 0),
              low: parseFloat(lows[i] || 0),
              close: parseFloat(closes[i] || 0),
              volume: parseInt(volumes[i] || 0)
            });
          }
          
          return {
            symbol: tvSymbol,
            timeframe,
            candles,
            count: candles.length,
            source: 'yahoo_finance'
          };
        }
        throw new Error('Invalid Yahoo Finance response');
        
      } else if (assetType === 'crypto') {
        // Use Binance Public API for crypto historical OHLCV (free, no auth, reliable)
        // Convert BTCUSD -> BTCUSDT
        const base = symbol.replace('USD', '').toUpperCase();
        const binanceSymbol = `${base}USDT`;
        
        // Convert timeframe to Binance interval
        const intervalMap = {
          '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
          '1H': '1h', '2H': '2h', '4H': '4h', '6H': '6h', '8H': '8h', '12H': '12h',
          '1D': '1d', '3D': '3d', '1W': '1w', '1M': '1M'
        };
        const binanceInterval = intervalMap[timeframe] || '1h';
        
        // Binance klines endpoint
        const binanceUrl = `https://api.binance.com/api/v3/klines`;
        const endTime = Date.now();
        const timeframeMs = this.getTimeframeMs(timeframe);
        const startTime = endTime - (barsCount * timeframeMs);
        
        const response = await axios.get(binanceUrl, {
          params: {
            symbol: binanceSymbol,
            interval: binanceInterval,
            limit: barsCount,
            startTime: startTime,
            endTime: endTime
          },
          headers: {
            'Accept': 'application/json'
          },
          timeout: 10000
        });
        
        // Binance klines format: [Open time, Open, High, Low, Close, Volume, ...]
        const klines = response.data;
        if (Array.isArray(klines) && klines.length > 0) {
          const candles = klines.map(kline => ({
            timestamp: new Date(kline[0]),
            open: parseFloat(kline[1]),
            high: parseFloat(kline[2]),
            low: parseFloat(kline[3]),
            close: parseFloat(kline[4]),
            volume: parseFloat(kline[5])
          }));
          
          return {
            symbol: tvSymbol,
            timeframe,
            candles,
            count: candles.length,
            source: 'binance'
          };
        }
        throw new Error('Invalid Binance response');
        
      } else if (assetType === 'forex') {
        // Use Yahoo Finance for forex historical data
        // Yahoo Finance uses format: EURUSD=X (not FX:EURUSD)
        const yahooSymbol = `${symbol}=X`;
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`;
        const interval = this.convertTimeframeToYahooInterval(timeframe);
        const period1 = Math.floor(Date.now() / 1000) - (barsCount * this.getTimeframeMs(timeframe) / 1000);
        const period2 = Math.floor(Date.now() / 1000);
        
        const response = await axios.get(yahooUrl, {
          params: {
            interval: interval,
            period1: period1,
            period2: period2
          },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Referer': 'https://finance.yahoo.com/'
          },
          timeout: 10000
        });
        
        const result = response.data;
        if (result.chart && result.chart.result && result.chart.result[0]) {
          const chart = result.chart.result[0];
          const timestamps = chart.timestamp || [];
          const quotes = chart.indicators?.quote?.[0] || {};
          const opens = quotes.open || [];
          const highs = quotes.high || [];
          const lows = quotes.low || [];
          const closes = quotes.close || [];
          const volumes = quotes.volume || [];
          
          const candles = [];
          for (let i = 0; i < timestamps.length; i++) {
            // Skip candles with invalid data (zero or null values)
            if (opens[i] && highs[i] && lows[i] && closes[i]) {
              candles.push({
                timestamp: new Date(timestamps[i] * 1000),
                open: parseFloat(opens[i]),
                high: parseFloat(highs[i]),
                low: parseFloat(lows[i]),
                close: parseFloat(closes[i]),
                volume: parseInt(volumes[i] || 0)
              });
            }
          }
          
          // If we got candles, return them
          if (candles.length > 0) {
            return {
              symbol: tvSymbol,
              timeframe,
              candles,
              count: candles.length,
              source: 'yahoo_finance'
            };
          }
          
          // If no valid candles, throw error to trigger fallback
          throw new Error(`Yahoo Finance returned no valid candles for ${symbol} (got ${timestamps.length} timestamps but all invalid)`);
        }
        throw new Error('Invalid Yahoo Finance forex response - no chart data');
      }
      
      throw new Error(`Historical data not available via free API for ${assetType}`);
      
    } catch (error) {
      throw new Error(`Free API historical fetch failed: ${error.message}`);
    }
  }

  /**
   * Convert timeframe to Yahoo Finance interval
   */
  convertTimeframeToYahooInterval(timeframe) {
    const intervalMap = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1H': '1h',
      '4H': '4h',
      '1D': '1d',
      '1W': '1wk',
      '1M': '1mo'
    };
    
    return intervalMap[timeframe] || '1d';
  }

  /**
   * Parse TradingView history response
   */
  parseHistoryResponse(result, tvSymbol, timeframe) {
    if (result.s === 'ok' && result.t && result.t.length > 0) {
      // TradingView history format: {s: 'ok', t: [timestamps], o: [opens], h: [highs], l: [lows], c: [closes], v: [volumes]}
      const candles = [];
      
      for (let i = 0; i < result.t.length; i++) {
        candles.push({
          timestamp: new Date(result.t[i] * 1000),
          open: parseFloat(result.o[i]),
          high: parseFloat(result.h[i]),
          low: parseFloat(result.l[i]),
          close: parseFloat(result.c[i]),
          volume: parseInt(result.v[i] || 0)
        });
      }
      
      return {
        symbol: tvSymbol,
        timeframe,
        candles,
        count: candles.length,
        source: 'tradingview_websocket'
      };
    } else if (result.s === 'no_data') {
      throw new Error(`No historical data available for ${tvSymbol}`);
    } else {
      throw new Error(`TradingView returned error: ${result.s || 'unknown'}`);
    }
  }

  /**
   * Get service health
   */
  getHealth() {
    return {
      status: this.isInitialized ? 'healthy' : 'unhealthy',
      cache_size: this.cache.size,
      active_connections: this.activeConnections.size,
      config_loaded: Object.keys(this.config).length > 0,
      api_key_configured: !!this.config.apiKey
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      // Close any active WebSocket connections
      for (const [key, connection] of this.activeConnections.entries()) {
        if (connection.readyState === WebSocket.OPEN) {
          connection.close();
        }
      }

      this.activeConnections.clear();
      this.cache.clear();

      this.logger.info('✅ TradingView API service cleaned up');
    } catch (error) {
      this.logger.error('Error during cleanup', { error: error.message });
    }
  }
}

module.exports = TradingViewAPI;