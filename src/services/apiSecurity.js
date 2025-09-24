/**
 * API Security Service
 * Handles rate limiting, request validation, and abuse prevention
 */

class ApiSecurityService {
  constructor() {
    // Rate limiting configuration
    this.rateLimits = {
      messages: {
        maxRequests: 10, // Max 10 messages per window
        windowMs: 60 * 1000, // 1 minute
        storage: new Map() // IP/session storage
      },
      global: {
        maxRequests: 50, // Max 50 requests per hour
        windowMs: 60 * 60 * 1000, // 1 hour
        storage: new Map()
      }
    };

    // Request validation rules
    this.validation = {
      maxMessageLength: 1000,
      maxHistoryLength: 10,
      bannedPatterns: [
        /\b(hack|exploit|bypass|inject|script)\b/i,
        /\b(admin|root|password|token)\b/i,
        /<script|javascript:|data:/i,
        /\b(api.?key|secret)\b/i
      ],
      minMessageLength: 1
    };

    // Session tracking
    this.sessions = new Map();
    this.suspiciousIPs = new Set();
  }

  /**
   * Generate a unique identifier for the client
   */
  getClientId() {
    // Use browser fingerprinting + session storage
    let clientId = sessionStorage.getItem('clientId');
    if (!clientId) {
      clientId = this.generateFingerprint();
      sessionStorage.setItem('clientId', clientId);
    }
    return clientId;
  }

  /**
   * Generate browser fingerprint for identification
   */
  generateFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Browser fingerprint', 2, 2);

    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL(),
      navigator.hardwareConcurrency || 'unknown'
    ].join('|');

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if request is within rate limits
   */
  checkRateLimit(clientId, type = 'messages') {
    const limit = this.rateLimits[type];
    const now = Date.now();

    // Clean old entries
    this.cleanupOldEntries(limit.storage, limit.windowMs);

    // Get client's request history
    if (!limit.storage.has(clientId)) {
      limit.storage.set(clientId, []);
    }

    const requests = limit.storage.get(clientId);
    const windowStart = now - limit.windowMs;

    // Count requests in current window
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);

    if (recentRequests.length >= limit.maxRequests) {
      // Log suspicious activity
      this.logSuspiciousActivity(clientId, 'rate_limit_exceeded', {
        type,
        requests: recentRequests.length,
        limit: limit.maxRequests
      });

      return {
        allowed: false,
        retryAfter: Math.ceil((requests[0] + limit.windowMs - now) / 1000),
        reason: `Rate limit exceeded. Max ${limit.maxRequests} ${type} per ${limit.windowMs/1000/60} minutes.`
      };
    }

    // Add current request
    requests.push(now);
    limit.storage.set(clientId, requests);

    return {
      allowed: true,
      remaining: limit.maxRequests - recentRequests.length - 1
    };
  }

  /**
   * Validate message content
   */
  validateMessage(message) {
    const errors = [];

    // Check length
    if (!message || message.length < this.validation.minMessageLength) {
      errors.push('Message is too short');
    }

    if (message.length > this.validation.maxMessageLength) {
      errors.push(`Message too long. Max ${this.validation.maxMessageLength} characters.`);
    }

    // Check for banned patterns
    for (const pattern of this.validation.bannedPatterns) {
      if (pattern.test(message)) {
        errors.push('Message contains prohibited content');
        this.logSuspiciousActivity(this.getClientId(), 'banned_content', {
          message: message.substring(0, 100) + '...',
          pattern: pattern.toString()
        });
        break;
      }
    }

    // Check for potential injection attempts
    if (this.containsSuspiciousContent(message)) {
      errors.push('Message contains suspicious content');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate conversation history
   */
  validateHistory(history) {
    if (!Array.isArray(history)) {
      return { valid: false, errors: ['Invalid history format'] };
    }

    if (history.length > this.validation.maxHistoryLength) {
      return {
        valid: false,
        errors: [`History too long. Max ${this.validation.maxHistoryLength} messages.`]
      };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Check for suspicious content
   */
  containsSuspiciousContent(message) {
    // Check for repetitive patterns (spam)
    const words = message.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = words.length > 0 ? uniqueWords.size / words.length : 1;

    if (repetitionRatio < 0.3 && words.length > 10) {
      return true; // Likely spam
    }

    // Check for excessive caps
    const capsRatio = (message.match(/[A-Z]/g) || []).length / message.length;
    if (capsRatio > 0.7 && message.length > 20) {
      return true;
    }

    // Check for excessive punctuation
    const punctRatio = (message.match(/[!?.,;:]/g) || []).length / message.length;
    if (punctRatio > 0.3) {
      return true;
    }

    return false;
  }

  /**
   * Log suspicious activity
   */
  logSuspiciousActivity(clientId, type, details = {}) {
    const activity = {
      clientId,
      type,
      timestamp: new Date().toISOString(),
      details,
      userAgent: navigator.userAgent
    };

    console.warn('Suspicious Activity Detected:', activity);

    // Store in memory (in production, send to backend)
    if (!this.sessions.has(clientId)) {
      this.sessions.set(clientId, { suspiciousActivities: [] });
    }

    const session = this.sessions.get(clientId);
    session.suspiciousActivities.push(activity);

    // Mark as suspicious if too many violations
    if (session.suspiciousActivities.length >= 3) {
      this.suspiciousIPs.add(clientId);
      console.warn(`Client ${clientId} marked as suspicious`);
    }
  }

  /**
   * Check if client is suspicious
   */
  isSuspiciousClient(clientId) {
    return this.suspiciousIPs.has(clientId);
  }

  /**
   * Clean up old rate limit entries
   */
  cleanupOldEntries(storage, windowMs) {
    const cutoff = Date.now() - windowMs;

    for (const [clientId, timestamps] of storage.entries()) {
      const validTimestamps = timestamps.filter(ts => ts > cutoff);
      if (validTimestamps.length === 0) {
        storage.delete(clientId);
      } else {
        storage.set(clientId, validTimestamps);
      }
    }
  }

  /**
   * Sanitize message content
   */
  sanitizeMessage(message) {
    return message
      .trim()
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .substring(0, this.validation.maxMessageLength);
  }

  /**
   * Get security metrics for monitoring
   */
  getSecurityMetrics() {
    return {
      totalSessions: this.sessions.size,
      suspiciousClients: this.suspiciousIPs.size,
      rateLimitStorage: {
        messages: this.rateLimits.messages.storage.size,
        global: this.rateLimits.global.storage.size
      },
      timestamp: new Date().toISOString()
    };
  }
}

export default new ApiSecurityService();
