/**
 * Formatter Utility
 * Format numbers, dates, currencies, and other data for display
 */

const moment = require('moment-timezone');

class Formatter {
  constructor() {
    this.defaultTimezone = process.env.TIMEZONE || 'America/New_York';
    this.defaultCurrency = process.env.CURRENCY || 'USD';
    this.locale = 'en-US';
  }

  /**
   * Format currency amounts
   */
  formatCurrency(amount, currency = null, options = {}) {
    const curr = currency || this.defaultCurrency;
    const value = parseFloat(amount) || 0;

    const formatterOptions = {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: options.minimumFractionDigits || 2,
      maximumFractionDigits: options.maximumFractionDigits || 2,
      ...options
    };

    try {
      return new Intl.NumberFormat(this.locale, formatterOptions).format(value);
    } catch (error) {
      // Fallback for unsupported currencies
      return `${curr === 'USD' ? '$' : curr + ' '}${value.toFixed(2)}`;
    }
  }

  /**
   * Format percentage values
   */
  formatPercentage(value, decimals = 2) {
    const num = parseFloat(value) || 0;
    return `${num.toFixed(decimals)}%`;
  }

  /**
   * Format large numbers with K, M, B suffixes
   */
  formatCompactNumber(num, decimals = 1) {
    const number = parseFloat(num) || 0;

    if (number >= 1e9) {
      return (number / 1e9).toFixed(decimals) + 'B';
    } else if (number >= 1e6) {
      return (number / 1e6).toFixed(decimals) + 'M';
    } else if (number >= 1e3) {
      return (number / 1e3).toFixed(decimals) + 'K';
    }

    return number.toFixed(decimals);
  }

  /**
   * Format dates and times
   */
  formatDate(date, format = 'MMM DD, YYYY', timezone = null) {
    const tz = timezone || this.defaultTimezone;

    if (!date) return 'N/A';

    try {
      return moment(date).tz(tz).format(format);
    } catch (error) {
      return moment(date).format(format);
    }
  }

  /**
   * Format relative time (e.g., "2 hours ago")
   */
  formatRelativeTime(date, timezone = null) {
    const tz = timezone || this.defaultTimezone;

    if (!date) return 'N/A';

    try {
      return moment(date).tz(tz).fromNow();
    } catch (error) {
      return moment(date).fromNow();
    }
  }

  /**
   * Format time duration
   */
  formatDuration(minutes) {
    const mins = parseInt(minutes) || 0;

    if (mins < 60) {
      return `${mins} minute${mins !== 1 ? 's' : ''}`;
    } else if (mins < 1440) { // Less than 24 hours
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    } else {
      const days = Math.floor(mins / 1440);
      const remainingHours = Math.floor((mins % 1440) / 60);
      return `${days}d ${remainingHours}h`;
    }
  }

  /**
   * Format trade result with color/symbol
   */
  formatTradeResult(result, profit = null) {
    if (!result) return 'PENDING';

    const resultText = result.toUpperCase();

    if (resultText === 'WIN') {
      return `✅ WIN${profit ? ` (+${this.formatCurrency(profit)})` : ''}`;
    } else if (resultText === 'LOSS') {
      return `❌ LOSS${profit ? ` (${this.formatCurrency(profit)})` : ''}`;
    } else if (resultText === 'DRAW') {
      return '⚪ DRAW';
    } else {
      return resultText;
    }
  }

  /**
   * Format signal strength
   */
  formatSignalStrength(strength) {
    const strengths = {
      'WEAK': '⚪ Weak',
      'MODERATE': '🟡 Moderate',
      'STRONG': '🟠 Strong',
      'VERY_STRONG': '🟢 Very Strong'
    };

    return strengths[strength] || strength;
  }

  /**
   * Format confidence score
   */
  formatConfidence(confidence) {
    const conf = parseFloat(confidence) || 0;

    if (conf >= 90) return `🟢 ${conf}% (Excellent)`;
    if (conf >= 80) return `🟡 ${conf}% (Very Good)`;
    if (conf >= 70) return `🟠 ${conf}% (Good)`;
    if (conf >= 60) return `🔴 ${conf}% (Fair)`;
    return `⚪ ${conf}% (Poor)`;
  }

  /**
   * Format asset symbol with emoji
   */
  formatAssetSymbol(symbol, type = 'stock') {
    const emojis = {
      stock: '📱',
      forex: '💱',
      crypto: '🪙',
      commodity: '⛏️',
      index: '📊'
    };

    const emoji = emojis[type] || '📈';
    return `${emoji} ${symbol}`;
  }

  /**
   * Format price change
   */
  formatPriceChange(currentPrice, previousPrice) {
    const current = parseFloat(currentPrice) || 0;
    const previous = parseFloat(previousPrice) || 0;

    if (previous === 0) return '0.00 (0.00%)';

    const change = current - previous;
    const percentChange = ((change / previous) * 100);

    const sign = change >= 0 ? '+' : '';
    const arrow = change >= 0 ? '📈' : '📉';

    return `${arrow} ${sign}${change.toFixed(2)} (${sign}${percentChange.toFixed(2)}%)`;
  }

  /**
   * Format indicator value
   */
  formatIndicatorValue(indicator, value) {
    const num = parseFloat(value) || 0;

    switch (indicator.toLowerCase()) {
      case 'rsi':
        return `${num.toFixed(1)} (${this.getRSISignal(num)})`;
      case 'macd':
        return num >= 0 ? `📈 ${num.toFixed(4)}` : `📉 ${num.toFixed(4)}`;
      case 'bollinger':
        return num.toFixed(2);
      case 'stochastic':
        return `${num.toFixed(1)}% (${this.getStochasticSignal(num)})`;
      case 'volume':
        return this.formatCompactNumber(num);
      default:
        return num.toFixed(4);
    }
  }

  /**
   * Get RSI signal description
   */
  getRSISignal(rsi) {
    if (rsi >= 70) return 'Overbought 🔴';
    if (rsi <= 30) return 'Oversold 🟢';
    return 'Neutral 🟡';
  }

  /**
   * Get Stochastic signal description
   */
  getStochasticSignal(stoch) {
    if (stoch >= 80) return 'Overbought 🔴';
    if (stoch <= 20) return 'Oversold 🟢';
    return 'Neutral 🟡';
  }

  /**
   * Format trade summary
   */
  formatTradeSummary(stats) {
    const {
      total_trades = 0,
      wins = 0,
      losses = 0,
      win_rate = 0,
      total_profit = 0,
      average_trade = 0
    } = stats;

    return {
      total: `${total_trades} trades`,
      results: `${wins}W / ${losses}L`,
      winRate: `${win_rate}% win rate`,
      profit: `${this.formatCurrency(total_profit)} total P&L`,
      average: `${this.formatCurrency(average_trade)} avg per trade`
    };
  }

  /**
   * Format performance grade
   */
  formatPerformanceGrade(grade) {
    const grades = {
      'A+': '🏆 Excellent (A+)',
      'A': '🥇 Very Good (A)',
      'B+': '🥈 Good (B+)',
      'B': '🥉 Fair (B)',
      'C+': '⚪ Average (C+)',
      'C': '⚪ Below Average (C)',
      'D': '⚠️ Poor (D)',
      'F': '❌ Very Poor (F)'
    };

    return grades[grade] || grade;
  }

  /**
   * Format countdown timer
   */
  formatCountdown(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    return `${secs}s`;
  }

  /**
   * Format file size
   */
  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';

    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Format JSON for display (prettified)
   */
  formatJSON(data, indent = 2) {
    try {
      return JSON.stringify(data, null, indent);
    } catch (error) {
      return 'Invalid JSON data';
    }
  }

  /**
   * Format list items
   */
  formatList(items, maxItems = 10, itemFormatter = null) {
    if (!Array.isArray(items)) return 'No items';

    const displayItems = items.slice(0, maxItems);
    const formatted = displayItems.map((item, index) => {
      const prefix = `${index + 1}. `;
      const content = itemFormatter ? itemFormatter(item) : item;
      return `${prefix}${content}`;
    });

    if (items.length > maxItems) {
      formatted.push(`... and ${items.length - maxItems} more items`);
    }

    return formatted.join('\n');
  }

  /**
   * Format table (simple text table)
   */
  formatTable(data, headers = null) {
    if (!Array.isArray(data) || data.length === 0) return 'No data';

    const cols = headers || Object.keys(data[0]);
    const colWidths = cols.map(col => {
      const maxContent = Math.max(
        col.length,
        ...data.map(row => String(row[col] || '').length)
      );
      return Math.min(maxContent, 20); // Max column width
    });

    // Header row
    let table = cols.map((col, i) => col.padEnd(colWidths[i])).join(' | ') + '\n';
    table += cols.map((_, i) => '-'.repeat(colWidths[i])).join('-+-') + '\n';

    // Data rows
    data.forEach(row => {
      table += cols.map((col, i) => {
        const value = String(row[col] || '');
        return value.padEnd(colWidths[i]);
      }).join(' | ') + '\n';
    });

    return table;
  }

  /**
   * Sanitize text for Telegram
   */
  sanitizeForTelegram(text) {
    if (typeof text !== 'string') return text;

    return text
      .replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&') // Escape Markdown characters
      .replace(/\n/g, '\n') // Preserve newlines
      .substring(0, 4096); // Telegram message limit
  }

  /**
   * Truncate text with ellipsis
   */
  truncate(text, maxLength = 100, suffix = '...') {
    if (typeof text !== 'string') return text;
    if (text.length <= maxLength) return text;

    return text.substring(0, maxLength - suffix.length) + suffix;
  }

  /**
   * Format error message for user
   */
  formatErrorMessage(error, userFriendly = true) {
    if (userFriendly) {
      return 'An error occurred. Please try again later.';
    }

    return `Error: ${error.message || 'Unknown error'}`;
  }

  /**
   * Set default timezone
   */
  setTimezone(timezone) {
    this.defaultTimezone = timezone;
  }

  /**
   * Set default currency
   */
  setCurrency(currency) {
    this.defaultCurrency = currency;
  }

  /**
   * Set locale
   */
  setLocale(locale) {
    this.locale = locale;
  }
}

module.exports = Formatter;