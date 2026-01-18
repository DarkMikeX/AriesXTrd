/**
 * Chart Generator
 * Generates ASCII charts and simple visualizations
 */

const Logger = require('./Logger');

class ChartGenerator {
  constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * Generate ASCII price chart
   */
  generatePriceChart(prices, width = 60, height = 15) {
    if (!prices || prices.length === 0) {
      return 'No price data available';
    }

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    let chart = '';

    // Generate chart from top to bottom
    for (let row = height - 1; row >= 0; row--) {
      let line = '';

      for (let i = 0; i < prices.length; i++) {
        const normalizedPrice = (prices[i] - min) / range;
        const chartHeight = Math.floor(normalizedPrice * height);

        if (chartHeight >= row) {
          line += '█';
        } else {
          line += ' ';
        }
      }

      chart += line + '\n';
    }

    // Add X-axis
    chart += '└' + '─'.repeat(Math.min(width, prices.length) - 2) + '┘\n';

    // Add price labels
    const latestPrice = prices[prices.length - 1];
    chart += `Latest: $${latestPrice?.toFixed(2) || 'N/A'} | `;
    chart += `High: $${max.toFixed(2)} | `;
    chart += `Low: $${min.toFixed(2)}\n`;

    return chart;
  }

  /**
   * Generate indicator chart
   */
  generateIndicatorChart(indicatorName, values, prices = null, width = 60) {
    if (!values || values.length === 0) {
      return `No ${indicatorName} data available`;
    }

    let chart = `${indicatorName.toUpperCase()} Chart:\n`;

    if (prices && prices.length === values.length) {
      chart += 'Price: ' + this.generatePriceChart(prices, width, 8);
      chart += '\n';
    }

    chart += `${indicatorName}: ${this.generateSimpleChart(values, width, 6)}`;

    // Add latest value
    const latest = values[values.length - 1];
    chart += `\nLatest ${indicatorName}: ${latest?.toFixed(4) || 'N/A'}`;

    return chart;
  }

  /**
   * Generate simple ASCII chart
   */
  generateSimpleChart(values, width = 50, height = 10) {
    if (!values || values.length === 0) return 'No data';

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    let chart = '';

    for (let row = height - 1; row >= 0; row--) {
      let line = '';

      for (let i = 0; i < Math.min(width, values.length); i++) {
        const normalizedValue = (values[i] - min) / range;
        const chartHeight = Math.floor(normalizedValue * height);

        if (chartHeight >= row) {
          line += '█';
        } else {
          line += ' ';
        }
      }

      chart += line + '\n';
    }

    return chart;
  }

  /**
   * Generate performance chart
   */
  generatePerformanceChart(profitData, width = 50) {
    if (!profitData || profitData.length === 0) {
      return 'No performance data available';
    }

    let chart = 'Performance Chart (Profit/Loss):\n';
    chart += this.generateSimpleChart(profitData, width, 10);

    // Calculate stats
    const totalProfit = profitData.reduce((sum, p) => sum + p, 0);
    const winRate = profitData.filter(p => p > 0).length / profitData.length * 100;

    chart += `\nTotal P&L: $${totalProfit.toFixed(2)}\n`;
    chart += `Win Rate: ${winRate.toFixed(1)}%\n`;
    chart += `Trades: ${profitData.length}\n`;

    return chart;
  }

  /**
   * Generate histogram chart
   */
  generateHistogram(data, bins = 10, width = 50) {
    if (!data || data.length === 0) return 'No data for histogram';

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const binWidth = range / bins;

    const histogram = new Array(bins).fill(0);

    data.forEach(value => {
      const binIndex = Math.min(bins - 1, Math.floor((value - min) / binWidth));
      histogram[binIndex]++;
    });

    const maxCount = Math.max(...histogram);
    let chart = 'Histogram:\n';

    for (let i = bins - 1; i >= 0; i--) {
      const count = histogram[i];
      const barLength = Math.floor((count / maxCount) * width);
      const bar = '█'.repeat(barLength);
      const binStart = min + (i * binWidth);
      const binEnd = min + ((i + 1) * binWidth);

      chart += `${binStart.toFixed(2)}-${binEnd.toFixed(2)}: ${bar} (${count})\n`;
    }

    return chart;
  }

  /**
   * Generate comparison chart
   */
  generateComparisonChart(dataSets, labels, width = 50) {
    if (!dataSets || dataSets.length === 0) return 'No data for comparison';

    const maxValue = Math.max(...dataSets.flat());
    let chart = 'Comparison Chart:\n';

    dataSets.forEach((data, index) => {
      const label = labels[index] || `Dataset ${index + 1}`;
      const avgValue = data.reduce((sum, val) => sum + val, 0) / data.length;
      const barLength = Math.floor((avgValue / maxValue) * width);
      const bar = '█'.repeat(barLength);

      chart += `${label.padEnd(15)}: ${bar} (${avgValue.toFixed(2)})\n`;
    });

    return chart;
  }

  /**
   * Generate text table
   */
  generateTable(headers, rows, maxWidth = 80) {
    if (!headers || !rows || rows.length === 0) return 'No data for table';

    // Calculate column widths
    const colWidths = headers.map((header, i) => {
      const colValues = [header, ...rows.map(row => String(row[i] || ''))];
      return Math.max(...colValues.map(val => val.length));
    });

    let table = '';

    // Header row
    table += headers.map((header, i) => header.padEnd(colWidths[i])).join(' | ') + '\n';
    table += colWidths.map(width => '─'.repeat(width)).join('─┼─') + '\n';

    // Data rows
    rows.forEach(row => {
      table += row.map((cell, i) => String(cell || '').padEnd(colWidths[i])).join(' | ') + '\n';
    });

    return table;
  }

  /**
   * Generate progress bar
   */
  generateProgressBar(current, total, width = 20, label = '') {
    const percentage = Math.min(100, Math.max(0, (current / total) * 100));
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percentText = `${percentage.toFixed(1)}%`;

    return `${label}${bar} ${percentText} (${current}/${total})`;
  }

  /**
   * Generate sparkline chart
   */
  generateSparkline(data, width = 20) {
    if (!data || data.length === 0) return '';

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    let sparkline = '';

    for (let i = 0; i < Math.min(width, data.length); i++) {
      const normalizedValue = (data[i] - min) / range;
      const charIndex = Math.floor(normalizedValue * 7); // 8 different characters

      const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
      sparkline += chars[charIndex];
    }

    return sparkline;
  }

  /**
   * Generate gauge chart
   */
  generateGauge(value, maxValue, label = '', width = 20) {
    const percentage = Math.min(100, Math.max(0, (value / maxValue) * 100));
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;

    const gauge = '█'.repeat(filled) + '░'.repeat(empty);

    return `${label}[${gauge}] ${percentage.toFixed(1)}% (${value}/${maxValue})`;
  }

  /**
   * Generate multi-line chart
   */
  generateMultiLineChart(dataSets, labels, width = 50, height = 10) {
    if (!dataSets || dataSets.length === 0) return 'No data for multi-line chart';

    const chars = ['█', '▒', '░', '▓', '■', '□', '▪', '▫'];
    let chart = 'Multi-Line Chart:\n';

    // Normalize all datasets
    const allValues = dataSets.flat();
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min || 1;

    for (let row = height - 1; row >= 0; row--) {
      let line = '';

      for (let col = 0; col < Math.min(width, dataSets[0]?.length || 0); col++) {
        let pixel = ' ';

        // Check each dataset
        for (let datasetIndex = 0; datasetIndex < dataSets.length; datasetIndex++) {
          const value = dataSets[datasetIndex][col];
          if (value !== undefined) {
            const normalizedValue = (value - min) / range;
            const chartHeight = Math.floor(normalizedValue * height);

            if (chartHeight >= row) {
              pixel = chars[datasetIndex % chars.length];
              break; // Use the first dataset that matches
            }
          }
        }

        line += pixel;
      }

      chart += line + '\n';
    }

    // Add legend
    chart += '\nLegend:\n';
    labels.forEach((label, index) => {
      chart += `${chars[index % chars.length]} ${label}\n`;
    });

    return chart;
  }
}

module.exports = ChartGenerator;