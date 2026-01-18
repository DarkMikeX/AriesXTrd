/**
 * Browser Manager
 * Manages browser instances for IQ Option automation
 */

const puppeteer = require('puppeteer');
const Logger = require('../utils/Logger');

class BrowserManager {
  constructor() {
    this.logger = Logger.getInstance();
    this.browsers = new Map();
    this.pages = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize browser manager
   */
  async initialize() {
    try {
      this.isInitialized = true;
      this.logger.info('✅ Browser manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize browser manager', { error: error.message });
      throw error;
    }
  }

  /**
   * Create new browser instance
   */
  async createBrowser(userId, options = {}) {
    try {
      const browserOptions = {
        headless: options.headless !== false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ],
        ...options
      };

      const browser = await puppeteer.launch(browserOptions);
      this.browsers.set(userId, browser);

      this.logger.info('Browser created', { userId, headless: browserOptions.headless });
      return browser;

    } catch (error) {
      this.logger.error('Failed to create browser', { userId, error: error.message });
      throw new Error(`Failed to create browser: ${error.message}`);
    }
  }

  /**
   * Get or create browser for user
   */
  async getBrowser(userId) {
    let browser = this.browsers.get(userId);

    if (!browser || browser.isConnected() === false) {
      browser = await this.createBrowser(userId);
    }

    return browser;
  }

  /**
   * Create new page in browser
   */
  async createPage(userId, options = {}) {
    try {
      const browser = await this.getBrowser(userId);
      const page = await browser.newPage();

      // Set default viewport
      await page.setViewport({
        width: options.width || 1280,
        height: options.height || 800
      });

      // Set user agent to avoid detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      // Store page reference
      if (!this.pages.has(userId)) {
        this.pages.set(userId, []);
      }
      this.pages.get(userId).push(page);

      this.logger.info('Page created', { userId, pageCount: this.pages.get(userId).length });
      return page;

    } catch (error) {
      this.logger.error('Failed to create page', { userId, error: error.message });
      throw new Error(`Failed to create page: ${error.message}`);
    }
  }

  /**
   * Get active page for user
   */
  getActivePage(userId) {
    const userPages = this.pages.get(userId);
    return userPages && userPages.length > 0 ? userPages[userPages.length - 1] : null;
  }

  /**
   * Close page
   */
  async closePage(userId, pageIndex = -1) {
    try {
      const userPages = this.pages.get(userId);
      if (!userPages || userPages.length === 0) return;

      const index = pageIndex === -1 ? userPages.length - 1 : pageIndex;
      const page = userPages[index];

      if (page && !page.isClosed()) {
        await page.close();
        userPages.splice(index, 1);

        this.logger.info('Page closed', { userId, remainingPages: userPages.length });
      }

    } catch (error) {
      this.logger.error('Failed to close page', { userId, error: error.message });
    }
  }

  /**
   * Close browser and cleanup
   */
  async closeBrowser(userId) {
    try {
      // Close all pages first
      const userPages = this.pages.get(userId) || [];
      for (const page of userPages) {
        if (!page.isClosed()) {
          await page.close();
        }
      }
      this.pages.delete(userId);

      // Close browser
      const browser = this.browsers.get(userId);
      if (browser && browser.isConnected()) {
        await browser.close();
      }
      this.browsers.delete(userId);

      this.logger.info('Browser closed and cleaned up', { userId });

    } catch (error) {
      this.logger.error('Failed to close browser', { userId, error: error.message });
    }
  }

  /**
   * Take screenshot
   */
  async takeScreenshot(userId, options = {}) {
    try {
      const page = this.getActivePage(userId);
      if (!page) {
        throw new Error('No active page found');
      }

      const screenshot = await page.screenshot({
        fullPage: options.fullPage || false,
        type: options.type || 'png',
        quality: options.quality || 80
      });

      this.logger.info('Screenshot taken', { userId, size: screenshot.length });
      return screenshot;

    } catch (error) {
      this.logger.error('Failed to take screenshot', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Navigate to URL
   */
  async navigate(userId, url, options = {}) {
    try {
      const page = this.getActivePage(userId);
      if (!page) {
        throw new Error('No active page found');
      }

      const response = await page.goto(url, {
        waitUntil: options.waitUntil || 'networkidle2',
        timeout: options.timeout || 30000
      });

      this.logger.info('Navigation completed', { userId, url, status: response.status() });
      return response;

    } catch (error) {
      this.logger.error('Navigation failed', { userId, url, error: error.message });
      throw error;
    }
  }

  /**
   * Execute JavaScript in page
   */
  async executeScript(userId, script, ...args) {
    try {
      const page = this.getActivePage(userId);
      if (!page) {
        throw new Error('No active page found');
      }

      const result = await page.evaluate(script, ...args);

      this.logger.debug('Script executed', { userId, hasResult: result !== undefined });
      return result;

    } catch (error) {
      this.logger.error('Script execution failed', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Wait for element
   */
  async waitForElement(userId, selector, options = {}) {
    try {
      const page = this.getActivePage(userId);
      if (!page) {
        throw new Error('No active page found');
      }

      await page.waitForSelector(selector, {
        timeout: options.timeout || 10000,
        visible: options.visible !== false
      });

      this.logger.debug('Element found', { userId, selector });
      return true;

    } catch (error) {
      this.logger.error('Element wait failed', { userId, selector, error: error.message });
      return false;
    }
  }

  /**
   * Click element
   */
  async clickElement(userId, selector, options = {}) {
    try {
      const page = this.getActivePage(userId);
      if (!page) {
        throw new Error('No active page found');
      }

      await page.click(selector, options);

      this.logger.debug('Element clicked', { userId, selector });
      return true;

    } catch (error) {
      this.logger.error('Element click failed', { userId, selector, error: error.message });
      return false;
    }
  }

  /**
   * Type text into element
   */
  async typeText(userId, selector, text, options = {}) {
    try {
      const page = this.getActivePage(userId);
      if (!page) {
        throw new Error('No active page found');
      }

      await page.type(selector, text, options);

      this.logger.debug('Text typed', { userId, selector, textLength: text.length });
      return true;

    } catch (error) {
      this.logger.error('Text typing failed', { userId, selector, error: error.message });
      return false;
    }
  }

  /**
   * Get page content
   */
  async getPageContent(userId) {
    try {
      const page = this.getActivePage(userId);
      if (!page) {
        throw new Error('No active page found');
      }

      const content = await page.content();
      return content;

    } catch (error) {
      this.logger.error('Failed to get page content', { userId, error: error.message });
      return null;
    }
  }

  /**
   * Get browser statistics
   */
  getBrowserStats() {
    const stats = {
      totalBrowsers: this.browsers.size,
      totalPages: 0,
      browsers: []
    };

    for (const [userId, browser] of this.browsers.entries()) {
      const userPages = this.pages.get(userId) || [];
      stats.totalPages += userPages.length;

      stats.browsers.push({
        userId,
        isConnected: browser.isConnected(),
        pageCount: userPages.length,
        targetCount: browser.targets().length
      });
    }

    return stats;
  }

  /**
   * Cleanup idle browsers
   */
  async cleanupIdleBrowsers(maxAge = 30 * 60 * 1000) { // 30 minutes
    const now = Date.now();
    const toCleanup = [];

    for (const [userId, browser] of this.browsers.entries()) {
      // Check if browser has been idle (no recent activity)
      // This is a simplified check - in production you'd track last activity
      const userPages = this.pages.get(userId) || [];
      if (userPages.length === 0) {
        toCleanup.push(userId);
      }
    }

    for (const userId of toCleanup) {
      await this.closeBrowser(userId);
    }

    if (toCleanup.length > 0) {
      this.logger.info('Idle browsers cleaned up', { count: toCleanup.length });
    }

    return toCleanup.length;
  }

  /**
   * Force cleanup all browsers
   */
  async forceCleanup() {
    const userIds = Array.from(this.browsers.keys());
    let cleaned = 0;

    for (const userId of userIds) {
      try {
        await this.closeBrowser(userId);
        cleaned++;
      } catch (error) {
        this.logger.error('Failed to cleanup browser', { userId, error: error.message });
      }
    }

    this.logger.info('Force cleanup completed', { totalBrowsers: userIds.length, cleaned });
    return cleaned;
  }

  /**
   * Check if browser is healthy
   */
  async checkBrowserHealth(userId) {
    try {
      const browser = this.browsers.get(userId);
      if (!browser) return { healthy: false, reason: 'Browser not found' };

      if (!browser.isConnected()) {
        return { healthy: false, reason: 'Browser not connected' };
      }

      const pages = this.pages.get(userId) || [];
      const activePages = pages.filter(page => !page.isClosed());

      return {
        healthy: true,
        pageCount: activePages.length,
        targetCount: browser.targets().length
      };

    } catch (error) {
      return { healthy: false, reason: error.message };
    }
  }

  /**
   * Get page metrics
   */
  async getPageMetrics(userId) {
    try {
      const page = this.getActivePage(userId);
      if (!page) return null;

      const metrics = await page.metrics();
      return {
        timestamp: new Date(),
        jsHeapUsedSize: metrics.JSHeapUsedSize,
        jsHeapTotalSize: metrics.JSHeapTotalSize,
        nodes: metrics.Nodes,
        jsEventListeners: metrics.JSEventListeners
      };

    } catch (error) {
      this.logger.error('Failed to get page metrics', { userId, error: error.message });
      return null;
    }
  }
}

module.exports = BrowserManager;