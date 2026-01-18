/**
 * Signal Validator
 * Validates trading signals before execution
 */

const Logger = require('../utils/Logger');

class SignalValidator {
  constructor(services) {
    this.services = services;
    this.logger = Logger.getInstance();
  }

  /**
   * Validate trading signal
   */
  async validateSignal(signal, context = {}) {
    try {
      const validation = {
        isValid: true,
        warnings: [],
        errors: [],
        score: 100,
        recommendations: []
      };

      // Basic signal structure validation
      const structureValidation = this.validateSignalStructure(signal);
      if (!structureValidation.valid) {
        validation.isValid = false;
        validation.errors.push(...structureValidation.errors);
        return validation;
      }

      // Confidence validation
      const confidenceValidation = this.validateConfidence(signal.confidence, context);
      if (!confidenceValidation.valid) {
        validation.warnings.push(...confidenceValidation.warnings);
        validation.score -= confidenceValidation.penalty;
      }

      // Market condition validation
      const marketValidation = await this.validateMarketConditions(signal, context);
      if (!marketValidation.valid) {
        validation.warnings.push(...marketValidation.warnings);
        validation.score -= marketValidation.penalty;
      }

      // Technical indicator validation
      const technicalValidation = this.validateTechnicalIndicators(signal.indicators);
      if (!technicalValidation.valid) {
        validation.warnings.push(...technicalValidation.warnings);
        validation.score -= technicalValidation.penalty;
      }

      // Risk management validation
      const riskValidation = await this.validateRiskManagement(signal, context);
      if (!riskValidation.valid) {
        validation.errors.push(...riskValidation.errors);
        validation.score -= riskValidation.penalty;
      }

      // Asset-specific validation
      const assetValidation = await this.validateAssetSpecific(signal, context);
      if (!assetValidation.valid) {
        validation.warnings.push(...assetValidation.warnings);
        validation.score -= assetValidation.penalty;
      }

      // Calculate final validity
      validation.isValid = validation.errors.length === 0 && validation.score >= 60;
      validation.score = Math.max(0, Math.min(100, validation.score));

      // Generate recommendations
      validation.recommendations = this.generateRecommendations(validation, signal);

      this.logger.info('Signal validation completed', {
        signal: signal.asset,
        isValid: validation.isValid,
        score: validation.score,
        errors: validation.errors.length,
        warnings: validation.warnings.length
      });

      return validation;

    } catch (error) {
      this.logger.error('Signal validation error', {
        signal: signal.asset,
        error: error.message
      });

      return {
        isValid: false,
        errors: ['Signal validation failed due to internal error'],
        warnings: [],
        score: 0,
        recommendations: ['Please try again or contact support']
      };
    }
  }

  /**
   * Validate signal structure
   */
  validateSignalStructure(signal) {
    const errors = [];

    if (!signal) {
      errors.push('Signal is null or undefined');
      return { valid: false, errors };
    }

    if (!signal.asset) errors.push('Asset symbol is required');
    if (!signal.direction || !['CALL', 'PUT'].includes(signal.direction)) {
      errors.push('Valid direction (CALL/PUT) is required');
    }
    if (typeof signal.confidence !== 'number' || signal.confidence < 0 || signal.confidence > 100) {
      errors.push('Confidence must be a number between 0 and 100');
    }
    if (!signal.amount || signal.amount <= 0) {
      errors.push('Valid trade amount is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate confidence level
   */
  validateConfidence(confidence, context) {
    const warnings = [];
    let penalty = 0;

    const minConfidence = context.minConfidence || 75;

    if (confidence < minConfidence) {
      warnings.push(`Confidence ${confidence}% is below minimum threshold ${minConfidence}%`);
      penalty = (minConfidence - confidence) * 0.5;
    }

    if (confidence < 50) {
      warnings.push('Very low confidence signal - high risk');
      penalty += 20;
    }

    return { valid: true, warnings, penalty };
  }

  /**
   * Validate market conditions
   */
  async validateMarketConditions(signal, context) {
    const warnings = [];
    let penalty = 0;

    try {
      // Check market hours
      const marketHoursValidation = this.validateMarketHours(signal.asset);
      if (!marketHoursValidation.valid) {
        warnings.push(marketHoursValidation.message);
        penalty += 15;
      }

      // Check volatility
      const volatilityValidation = await this.validateVolatility(signal);
      if (!volatilityValidation.valid) {
        warnings.push(volatilityValidation.message);
        penalty += volatilityValidation.penalty;
      }

      // Check liquidity
      const liquidityValidation = await this.validateLiquidity(signal);
      if (!liquidityValidation.valid) {
        warnings.push(liquidityValidation.message);
        penalty += liquidityValidation.penalty;
      }

    } catch (error) {
      warnings.push('Unable to validate market conditions');
      penalty += 10;
    }

    return {
      valid: penalty < 30,
      warnings,
      penalty
    };
  }

  /**
   * Validate technical indicators
   */
  validateTechnicalIndicators(indicators) {
    const warnings = [];
    let penalty = 0;

    if (!indicators) {
      warnings.push('No technical indicators provided');
      return { valid: false, warnings, penalty: 50 };
    }

    const requiredIndicators = ['rsi', 'macd', 'bollingerBands'];
    const presentIndicators = Object.keys(indicators);

    for (const required of requiredIndicators) {
      if (!presentIndicators.includes(required)) {
        warnings.push(`Missing required indicator: ${required}`);
        penalty += 10;
      }
    }

    // Validate indicator values
    if (indicators.rsi && (indicators.rsi.value < 0 || indicators.rsi.value > 100)) {
      warnings.push('Invalid RSI value');
      penalty += 5;
    }

    return {
      valid: penalty < 30,
      warnings,
      penalty
    };
  }

  /**
   * Validate risk management
   */
  async validateRiskManagement(signal, context) {
    const errors = [];
    let penalty = 0;

    try {
      const userId = context.userId;
      if (!userId) return { valid: true, errors: [], penalty: 0 };

      // Check daily limits
      const dailyLimits = await this.services.risk.checkDailyLimits(userId);
      if (!dailyLimits.canTrade) {
        errors.push(`Daily trade limit exceeded: ${dailyLimits.used}/${dailyLimits.limit}`);
      }

      // Check loss limits
      if (!dailyLimits.underLossLimit) {
        errors.push(`Daily loss limit exceeded: $${dailyLimits.currentLosses}/$${dailyLimits.limit}`);
      }

      // Check balance
      const hasBalance = await this.services.risk.checkBalance(userId, signal.amount);
      if (!hasBalance) {
        errors.push('Insufficient account balance');
      }

      // Check position size
      const positionValidation = await this.services.risk.validatePositionSize(signal.amount, context.settings);
      if (!positionValidation.valid) {
        errors.push(`Invalid position size: must be between $${positionValidation.min} and $${positionValidation.max}`);
      }

    } catch (error) {
      errors.push('Risk management validation failed');
      penalty += 20;
    }

    return {
      valid: errors.length === 0,
      errors,
      penalty
    };
  }

  /**
   * Validate asset-specific conditions
   */
  async validateAssetSpecific(signal, context) {
    const warnings = [];
    let penalty = 0;

    try {
      // Asset-specific validations
      if (signal.assetType === 'crypto') {
        // Crypto-specific checks
        const volatility = await this.checkCryptoVolatility(signal.asset);
        if (volatility > 0.1) {
          warnings.push('High cryptocurrency volatility detected');
          penalty += 10;
        }
      } else if (signal.assetType === 'forex') {
        // Forex-specific checks
        const spread = await this.checkForexSpread(signal.asset);
        if (spread > 0.0002) {
          warnings.push('Wide forex spread may affect profitability');
          penalty += 5;
        }
      }

    } catch (error) {
      warnings.push('Asset-specific validation failed');
      penalty += 5;
    }

    return {
      valid: penalty < 20,
      warnings,
      penalty
    };
  }

  /**
   * Generate recommendations based on validation
   */
  generateRecommendations(validation, signal) {
    const recommendations = [];

    if (validation.score < 60) {
      recommendations.push('Consider waiting for a stronger signal');
    }

    if (validation.warnings.some(w => w.includes('confidence'))) {
      recommendations.push('Signal confidence is low - consider reducing position size');
    }

    if (validation.warnings.some(w => w.includes('volatility'))) {
      recommendations.push('High market volatility - consider shorter expiry times');
    }

    if (validation.errors.some(e => e.includes('balance'))) {
      recommendations.push('Deposit additional funds to continue trading');
    }

    if (validation.errors.some(e => e.includes('limit'))) {
      recommendations.push('Daily limits reached - trading paused until tomorrow');
    }

    if (recommendations.length === 0) {
      recommendations.push('Signal validation passed - ready for execution');
    }

    return recommendations;
  }

  /**
   * Validate market hours
   */
  validateMarketHours(asset) {
    const now = new Date();
    const hour = now.getUTCHours();
    const day = now.getUTCDay();

    // Simplified market hours check
    if (day === 0 || day === 6) {
      return { valid: false, message: 'Market closed on weekends' };
    }

    // Forex is 24/5, stocks are typically 9:30-16:00 ET
    if (asset.includes('USD') || asset.length === 6) {
      // Forex pair
      return { valid: true };
    } else {
      // Assume stock market hours (9:30 AM - 4:00 PM ET = 13:30-20:00 UTC)
      const inMarketHours = hour >= 14 && hour <= 20;
      return {
        valid: inMarketHours,
        message: inMarketHours ? null : 'Outside regular market hours'
      };
    }
  }

  /**
   * Validate volatility
   */
  async validateVolatility(signal) {
    // Simplified volatility check
    const mockVolatility = Math.random() * 0.1; // 0-10%

    if (mockVolatility > 0.08) {
      return {
        valid: false,
        message: 'Extreme volatility detected',
        penalty: 15
      };
    } else if (mockVolatility > 0.05) {
      return {
        valid: true,
        message: 'High volatility - use caution',
        penalty: 5
      };
    }

    return { valid: true, penalty: 0 };
  }

  /**
   * Validate liquidity
   */
  async validateLiquidity(signal) {
    // Simplified liquidity check
    const mockLiquidity = Math.random();

    if (mockLiquidity < 0.3) {
      return {
        valid: false,
        message: 'Low liquidity may cause slippage',
        penalty: 10
      };
    }

    return { valid: true, penalty: 0 };
  }

  /**
   * Check crypto volatility
   */
  async checkCryptoVolatility(asset) {
    // Mock implementation
    return Math.random() * 0.15; // 0-15% volatility
  }

  /**
   * Check forex spread
   */
  async checkForexSpread(asset) {
    // Mock implementation
    return Math.random() * 0.0005; // 0-5 pip spread
  }

  /**
   * Get validation summary
   */
  getValidationSummary(validation) {
    return {
      score: validation.score,
      grade: this.getGradeFromScore(validation.score),
      issues: validation.errors.length + validation.warnings.length,
      criticalIssues: validation.errors.length,
      recommendations: validation.recommendations.length
    };
  }

  /**
   * Get grade from score
   */
  getGradeFromScore(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }
}

module.exports = SignalValidator;