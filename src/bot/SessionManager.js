/**
 * Session Manager
 * Manages user sessions and conversation state
 */

const Logger = require('../utils/Logger');

class SessionManager {
  constructor() {
    this.logger = Logger.getInstance();
    this.sessions = new Map();
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Create or update user session
   */
  createSession(userId, initialData = {}) {
    const session = {
      userId,
      data: { ...initialData },
      navigationStack: [], // Stack for back navigation
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true
    };

    this.sessions.set(userId, session);
    this.logger.info('Session created', { userId, dataKeys: Object.keys(initialData) });

    return session;
  }

  /**
   * Push navigation state to stack
   */
  pushNavigation(userId, menuType, menuData = {}) {
    const session = this.getSession(userId);
    if (!session) {
      this.createSession(userId);
    }
    const s = this.sessions.get(userId);
    if (!s.navigationStack) {
      s.navigationStack = [];
    }
    s.navigationStack.push({ menuType, menuData, timestamp: Date.now() });
    return s.navigationStack.length;
  }

  /**
   * Pop navigation state from stack (go back)
   */
  popNavigation(userId) {
    const session = this.getSession(userId);
    if (!session || !session.navigationStack || session.navigationStack.length === 0) {
      return null;
    }
    return session.navigationStack.pop();
  }

  /**
   * Get previous navigation state without removing it
   */
  peekNavigation(userId) {
    const session = this.getSession(userId);
    if (!session || !session.navigationStack || session.navigationStack.length === 0) {
      return null;
    }
    return session.navigationStack[session.navigationStack.length - 1];
  }

  /**
   * Clear navigation stack
   */
  clearNavigation(userId) {
    const session = this.getSession(userId);
    if (session) {
      session.navigationStack = [];
    }
  }

  /**
   * Get user session
   */
  getSession(userId) {
    const session = this.sessions.get(userId);

    if (session && this.isSessionExpired(session)) {
      this.destroySession(userId);
      return null;
    }

    if (session) {
      session.lastActivity = new Date();
    }

    return session;
  }

  /**
   * Update session data
   */
  updateSession(userId, updates) {
    const session = this.getSession(userId);

    if (!session) {
      return this.createSession(userId, updates);
    }

    // Deep merge updates
    session.data = this.deepMerge(session.data, updates);
    session.lastActivity = new Date();

    this.logger.debug('Session updated', { userId, updates });
    return session;
  }

  /**
   * Set session property
   */
  setSessionProperty(userId, key, value) {
    const session = this.getSession(userId);

    if (!session) {
      return this.createSession(userId, { [key]: value });
    }

    session.data[key] = value;
    session.lastActivity = new Date();

    return session;
  }

  /**
   * Get session property
   */
  getSessionProperty(userId, key, defaultValue = null) {
    const session = this.getSession(userId);
    return session?.data?.[key] ?? defaultValue;
  }

  /**
   * Remove session property
   */
  removeSessionProperty(userId, key) {
    const session = this.getSession(userId);

    if (session && session.data) {
      delete session.data[key];
    }

    return session;
  }

  /**
   * Clear session data
   */
  clearSessionData(userId) {
    const session = this.getSession(userId);

    if (session) {
      session.data = {};
      session.lastActivity = new Date();
    }

    return session;
  }

  /**
   * Destroy user session
   */
  destroySession(userId) {
    const session = this.sessions.get(userId);

    if (session) {
      this.sessions.delete(userId);
      this.logger.info('Session destroyed', { userId, duration: Date.now() - session.createdAt.getTime() });
    }

    return true;
  }

  /**
   * Check if session exists and is active
   */
  hasActiveSession(userId) {
    const session = this.sessions.get(userId);
    return session && !this.isSessionExpired(session) && session.isActive;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions() {
    const activeSessions = [];

    for (const [userId, session] of this.sessions.entries()) {
      if (!this.isSessionExpired(session) && session.isActive) {
        activeSessions.push({
          userId,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          dataKeys: Object.keys(session.data)
        });
      }
    }

    return activeSessions;
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    const now = Date.now();
    const stats = {
      total: this.sessions.size,
      active: 0,
      expired: 0,
      averageAge: 0,
      totalDataSize: 0
    };

    let totalAge = 0;

    for (const session of this.sessions.values()) {
      if (this.isSessionExpired(session)) {
        stats.expired++;
      } else if (session.isActive) {
        stats.active++;
        totalAge += now - session.createdAt.getTime();
        stats.totalDataSize += JSON.stringify(session.data).length;
      }
    }

    if (stats.active > 0) {
      stats.averageAge = Math.round(totalAge / stats.active / 1000); // in seconds
    }

    return stats;
  }

  /**
   * Check if session is expired
   */
  isSessionExpired(session) {
    const now = Date.now();
    const sessionAge = now - session.createdAt.getTime();
    const inactivityTime = now - session.lastActivity.getTime();

    return sessionAge > this.sessionTimeout || inactivityTime > this.sessionTimeout;
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const expiredUserIds = [];

    for (const [userId, session] of this.sessions.entries()) {
      if (this.isSessionExpired(session)) {
        expiredUserIds.push(userId);
      }
    }

    expiredUserIds.forEach(userId => {
      this.destroySession(userId);
    });

    if (expiredUserIds.length > 0) {
      this.logger.info('Cleaned up expired sessions', { count: expiredUserIds.length });
    }

    return expiredUserIds.length;
  }

  /**
   * Extend session timeout
   */
  extendSession(userId, additionalMinutes = 15) {
    const session = this.getSession(userId);

    if (session) {
      session.lastActivity = new Date(Date.now() + additionalMinutes * 60 * 1000);
      return true;
    }

    return false;
  }

  /**
   * Set session timeout
   */
  setSessionTimeout(minutes) {
    this.sessionTimeout = minutes * 60 * 1000;
    this.logger.info('Session timeout updated', { minutes });
  }

  /**
   * Get session timeout
   */
  getSessionTimeout() {
    return this.sessionTimeout / (60 * 1000); // return in minutes
  }

  /**
   * Pause session (mark as inactive)
   */
  pauseSession(userId) {
    const session = this.getSession(userId);

    if (session) {
      session.isActive = false;
      this.logger.info('Session paused', { userId });
      return true;
    }

    return false;
  }

  /**
   * Resume session (mark as active)
   */
  resumeSession(userId) {
    const session = this.getSession(userId);

    if (session) {
      session.isActive = true;
      session.lastActivity = new Date();
      this.logger.info('Session resumed', { userId });
      return true;
    }

    return false;
  }

  /**
   * Transfer session data to another user
   */
  transferSession(fromUserId, toUserId) {
    const fromSession = this.getSession(fromUserId);

    if (!fromSession) {
      return false;
    }

    // Create new session for target user
    const newSession = this.createSession(toUserId, fromSession.data);

    // Destroy old session
    this.destroySession(fromUserId);

    this.logger.info('Session transferred', { fromUserId, toUserId });
    return true;
  }

  /**
   * Clone session for another user
   */
  cloneSession(fromUserId, toUserId) {
    const fromSession = this.getSession(fromUserId);

    if (!fromSession) {
      return false;
    }

    // Deep clone the data
    const clonedData = JSON.parse(JSON.stringify(fromSession.data));
    this.createSession(toUserId, clonedData);

    this.logger.info('Session cloned', { fromUserId, toUserId });
    return true;
  }

  /**
   * Export session data
   */
  exportSession(userId) {
    const session = this.getSession(userId);

    if (!session) {
      return null;
    }

    return {
      userId: session.userId,
      data: session.data,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      isActive: session.isActive,
      age: Date.now() - session.createdAt.getTime(),
      inactivity: Date.now() - session.lastActivity.getTime()
    };
  }

  /**
   * Import session data
   */
  importSession(sessionData) {
    const session = {
      userId: sessionData.userId,
      data: sessionData.data || {},
      createdAt: new Date(sessionData.createdAt || Date.now()),
      lastActivity: new Date(sessionData.lastActivity || Date.now()),
      isActive: sessionData.isActive !== false
    };

    this.sessions.set(session.userId, session);
    this.logger.info('Session imported', { userId: session.userId });

    return session;
  }

  /**
   * Get sessions by data criteria
   */
  findSessionsByData(criteria) {
    const matchingSessions = [];

    for (const [userId, session] of this.sessions.entries()) {
      if (this.isSessionExpired(session)) continue;

      let matches = true;

      for (const [key, value] of Object.entries(criteria)) {
        if (!this.deepEqual(session.data[key], value)) {
          matches = false;
          break;
        }
      }

      if (matches) {
        matchingSessions.push({
          userId,
          data: session.data,
          lastActivity: session.lastActivity
        });
      }
    }

    return matchingSessions;
  }

  /**
   * Broadcast data to multiple sessions
   */
  broadcastToSessions(userIds, data) {
    const results = {
      successful: 0,
      failed: 0,
      notFound: 0
    };

    userIds.forEach(userId => {
      const session = this.getSession(userId);

      if (!session) {
        results.notFound++;
        return;
      }

      try {
        session.data = this.deepMerge(session.data, data);
        session.lastActivity = new Date();
        results.successful++;
      } catch (error) {
        results.failed++;
        this.logger.error('Broadcast to session failed', { userId, error: error.message });
      }
    });

    this.logger.info('Session broadcast completed', results);
    return results;
  }

  /**
   * Deep merge objects
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Deep equal comparison
   */
  deepEqual(a, b) {
    if (a === b) return true;

    if (a == null || b == null) return a === b;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this.deepEqual(a[i], b[i])) return false;
      }
      return true;
    }

    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this.deepEqual(a[key], b[key])) return false;
      }

      return true;
    }

    return false;
  }

  /**
   * Initialize session cleanup interval
   */
  startCleanupInterval(intervalMinutes = 5) {
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, intervalMinutes * 60 * 1000);

    this.logger.info('Session cleanup interval started', { intervalMinutes });
  }

  /**
   * Force cleanup of all sessions
   */
  forceCleanup() {
    const count = this.sessions.size;
    this.sessions.clear();
    this.logger.info('All sessions force cleaned', { count });
    return count;
  }

  /**
   * Get session summary
   */
  getSummary() {
    const stats = this.getSessionStats();

    return {
      ...stats,
      oldestSession: this.getOldestSessionAge(),
      newestSession: this.getNewestSessionAge()
    };
  }

  /**
   * Get oldest session age in minutes
   */
  getOldestSessionAge() {
    let oldest = 0;

    for (const session of this.sessions.values()) {
      if (!this.isSessionExpired(session) && session.isActive) {
        const age = Math.floor((Date.now() - session.createdAt.getTime()) / (60 * 1000));
        oldest = Math.max(oldest, age);
      }
    }

    return oldest;
  }

  /**
   * Get newest session age in minutes
   */
  getNewestSessionAge() {
    let newest = Infinity;

    for (const session of this.sessions.values()) {
      if (!this.isSessionExpired(session) && session.isActive) {
        const age = Math.floor((Date.now() - session.createdAt.getTime()) / (60 * 1000));
        newest = Math.min(newest, age);
      }
    }

    return newest === Infinity ? 0 : newest;
  }
}

module.exports = SessionManager;