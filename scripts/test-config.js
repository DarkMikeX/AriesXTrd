#!/usr/bin/env node

/**
 * Configuration Test Script
 * Tests your .env configuration and bot setup
 */

require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');

class ConfigTester {
  constructor() {
    this.results = {
      passed: [],
      warnings: [],
      failed: []
    };
  }

  /**
   * Run all configuration tests
   */
  async runTests() {
    console.log('🔍 Testing Trading Bot Configuration\n');
    console.log('=====================================\n');

    // Test .env file
    await this.testEnvFile();

    // Test required variables
    this.testRequiredVariables();

    // Test Telegram bot token
    await this.testTelegramToken();

    // Test TradingView connection
    await this.testTradingView();

    // Test database path
    this.testDatabasePath();

    // Test directories
    this.testDirectories();

    // Print results
    this.printResults();

    // Exit with appropriate code
    process.exit(this.results.failed.length > 0 ? 1 : 0);
  }

  /**
   * Test .env file existence and loading
   */
  async testEnvFile() {
    const envPath = path.join(process.cwd(), '.env');

    if (!fs.existsSync(envPath)) {
      this.results.failed.push('❌ .env file not found. Run: cp .env.example .env');
      return;
    }

    this.results.passed.push('✅ .env file found');

    try {
      // Test dotenv loading
      require('dotenv').config({ override: true });
      this.results.passed.push('✅ .env file loaded successfully');
    } catch (error) {
      this.results.failed.push(`❌ Failed to load .env file: ${error.message}`);
    }
  }

  /**
   * Test required environment variables
   */
  testRequiredVariables() {
    const required = [
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_ADMIN_ID',
      'DATABASE_PATH'
    ];

    const optional = [
      'IQ_OPTION_EMAIL',
      'IQ_OPTION_PASSWORD',
      'TRADINGVIEW_API_URL'
    ];

    // Test required variables
    for (const varName of required) {
      if (!process.env[varName] || process.env[varName].trim() === '') {
        this.results.failed.push(`❌ Required variable ${varName} is missing or empty`);
      } else {
        this.results.passed.push(`✅ ${varName} is set`);
      }
    }

    // Test optional variables
    for (const varName of optional) {
      if (!process.env[varName] || process.env[varName].trim() === '') {
        this.results.warnings.push(`⚠️  Optional variable ${varName} is not set`);
      } else {
        this.results.passed.push(`✅ ${varName} is set`);
      }
    }
  }

  /**
   * Test Telegram bot token validity
   */
  async testTelegramToken() {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      this.results.failed.push('❌ Telegram bot token not set');
      return;
    }

    // Basic format validation
    const tokenRegex = /^\d{9,10}:[A-Za-z0-9_-]{35}$/;
    if (!tokenRegex.test(token)) {
      this.results.failed.push('❌ Telegram bot token format is invalid');
      return;
    }

    this.results.passed.push('✅ Telegram bot token format is valid');

    // Test API connection (optional, might fail due to network)
    try {
      console.log('🔍 Testing Telegram API connection...');
      const isValid = await this.testTelegramAPI(token);

      if (isValid) {
        this.results.passed.push('✅ Telegram API connection successful');
      } else {
        this.results.warnings.push('⚠️  Telegram API test failed (may be network issue)');
      }
    } catch (error) {
      this.results.warnings.push(`⚠️  Telegram API test failed: ${error.message}`);
    }
  }

  /**
   * Test Telegram API connection
   */
  testTelegramAPI(token) {
    return new Promise((resolve) => {
      const url = `https://api.telegram.org/bot${token}/getMe`;

      const req = https.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve(response.ok === true);
          } catch (error) {
            resolve(false);
          }
        });
      });

      req.on('error', () => {
        resolve(false);
      });

      // Timeout after 10 seconds
      req.setTimeout(10000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  /**
   * Test TradingView connection
   */
  async testTradingView() {
    const apiUrl = process.env.TRADINGVIEW_API_URL || 'https://api.tradingview.com';

    try {
      console.log('🔍 Testing TradingView connection...');
      const isReachable = await this.testUrlReachability(apiUrl);

      if (isReachable) {
        this.results.passed.push('✅ TradingView API is reachable');
      } else {
        this.results.warnings.push('⚠️  TradingView API not reachable (may be temporary)');
      }
    } catch (error) {
      this.results.warnings.push(`⚠️  TradingView test failed: ${error.message}`);
    }
  }

  /**
   * Test URL reachability
   */
  testUrlReachability(url) {
    return new Promise((resolve) => {
      const req = https.get(url, { timeout: 5000 }, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  /**
   * Test database path
   */
  testDatabasePath() {
    const dbPath = process.env.DATABASE_PATH || './database/trading.db';
    const fullPath = path.resolve(dbPath);
    const dir = path.dirname(fullPath);

    try {
      // Check if directory is writable
      fs.accessSync(dir, fs.constants.W_OK);
      this.results.passed.push(`✅ Database directory is writable: ${dir}`);
    } catch (error) {
      this.results.failed.push(`❌ Database directory not writable: ${dir}`);
    }
  }

  /**
   * Test required directories
   */
  testDirectories() {
    const dirs = ['logs', 'database', 'config', 'charts'];

    for (const dir of dirs) {
      const fullPath = path.join(process.cwd(), dir);

      if (fs.existsSync(fullPath)) {
        this.results.passed.push(`✅ Directory exists: ${dir}/`);
      } else {
        this.results.warnings.push(`⚠️  Directory missing: ${dir}/ (will be created automatically)`);
      }
    }
  }

  /**
   * Print test results
   */
  printResults() {
    console.log('\n📊 TEST RESULTS');
    console.log('===============\n');

    if (this.results.passed.length > 0) {
      console.log('✅ PASSED:');
      this.results.passed.forEach(result => console.log(`   ${result}`));
      console.log();
    }

    if (this.results.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      this.results.warnings.forEach(result => console.log(`   ${result}`));
      console.log();
    }

    if (this.results.failed.length > 0) {
      console.log('❌ FAILED:');
      this.results.failed.forEach(result => console.log(`   ${result}`));
      console.log();
    }

    const totalTests = this.results.passed.length + this.results.warnings.length + this.results.failed.length;

    console.log('📈 SUMMARY:');
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${this.results.passed.length}`);
    console.log(`   Warnings: ${this.results.warnings.length}`);
    console.log(`   Failed: ${this.results.failed.length}`);

    if (this.results.failed.length === 0) {
      console.log('\n🎉 Configuration test passed! You can now start the bot.');
      console.log('   Run: npm start');
    } else {
      console.log('\n🔧 Please fix the failed tests before starting the bot.');
      console.log('   Check the ENV_SETUP.md file for help.');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new ConfigTester();
  tester.runTests().catch(console.error);
}

module.exports = ConfigTester;