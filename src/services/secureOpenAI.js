/**
 * Secure OpenAI Service
 * Routes requests through backend to hide API keys and add security layers
 */

import apiSecurity from './apiSecurity';

class SecureOpenAIService {
  constructor() {
    // Backend endpoint (you'll need to set this up)
    this.backendUrl = process.env.REACT_APP_API_URL || 'http://localhost:8007';
    this.apiEndpoint = `${this.backendUrl}/api/chat`;

    // System prompt for the assistant
    this.systemPrompt = `You are Sira's personal assistant. You are helpful, professional, and knowledgeable about Sira's background, skills, and projects. Keep responses concise and relevant. If asked about sensitive information like API keys, passwords, or private details, politely decline and redirect to appropriate public information.`;

    if (process.env.NODE_ENV !== 'production') {
      console.log('Secure OpenAI Service initialized with backend:', this.backendUrl);
    }
  }

  isConfigured() {
    // Always return true since we're using backend
    return true;
  }

  async sendMessage(messages) {
    const clientId = apiSecurity.getClientId();

    try {
      // 1. Check if client is suspicious
      if (apiSecurity.isSuspiciousClient(clientId)) {
        throw new Error('Access restricted due to suspicious activity. Please try again later.');
      }

      // 2. Rate limiting check
      const rateLimitCheck = apiSecurity.checkRateLimit(clientId, 'messages');
      if (!rateLimitCheck.allowed) {
        throw new Error(rateLimitCheck.reason);
      }

      // 3. Validate message history
      const historyValidation = apiSecurity.validateHistory(messages);
      if (!historyValidation.valid) {
        throw new Error(historyValidation.errors.join('. '));
      }

      // 4. Validate and sanitize the latest user message
      const latestMessage = messages[messages.length - 1];
      if (latestMessage && latestMessage.role === 'user') {
        const messageValidation = apiSecurity.validateMessage(latestMessage.content);
        if (!messageValidation.valid) {
          throw new Error(messageValidation.errors.join('. '));
        }

        // Sanitize the message
        latestMessage.content = apiSecurity.sanitizeMessage(latestMessage.content);
      }

      // 5. Add system prompt if not present
      const messagesWithSystem = this.addSystemPrompt(messages);

      // 6. Global rate limit check
      const globalRateLimit = apiSecurity.checkRateLimit(clientId, 'global');
      if (!globalRateLimit.allowed) {
        throw new Error('Too many requests. Please try again later.');
      }

      // 7. Make request to secure backend
      const response = await this.makeSecureRequest(messagesWithSystem, clientId);

      return response;

    } catch (error) {
      console.error('Secure OpenAI Error:', error);

      // Log potential abuse attempts
      if (error.message.includes('suspicious') || error.message.includes('prohibited')) {
        apiSecurity.logSuspiciousActivity(clientId, 'api_abuse_attempt', {
          error: error.message,
          messagesCount: messages.length
        });
      }

      throw error;
    }
  }

  async makeSecureRequest(messages, clientId) {
    const requestData = {
      messages: messages,
      clientId: clientId,
      timestamp: Date.now(),
      // Add additional security headers
      security: {
        fingerprint: clientId,
        userAgent: navigator.userAgent,
        referrer: window.location.origin
      }
    };

    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': clientId,
        'X-Timestamp': Date.now().toString(),
        'X-Origin': window.location.origin,
        // Add CSRF protection
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));

      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait before sending another message.');
      }

      if (response.status === 403) {
        throw new Error('Access denied. Please check your request and try again.');
      }

      if (response.status === 400) {
        throw new Error(errorData.error || 'Invalid request. Please check your message and try again.');
      }

      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    return data.message || data.content || 'No response received';
  }

  addSystemPrompt(messages) {
    // Check if system prompt already exists
    if (messages.length > 0 && messages[0].role === 'system') {
      return messages;
    }

    // Add system prompt at the beginning
    return [
      {
        role: 'system',
        content: this.systemPrompt
      },
      ...messages
    ];
  }

  formatMessagesForAPI(chatHistory) {
    return chatHistory.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));
  }

  // Fallback for when backend is not available
  async fallbackToDirectAPI(messages) {
    // This should only be used in development
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('Backend service is required in production');
    }

    console.warn('Using fallback direct API - this should only happen in development');

    // Use the old direct API method (with limited functionality)
    // This still has security risks but is better than nothing
    const apiKey = process.env.REACT_APP_OPENAI_API;
    if (!apiKey) {
      throw new Error('API configuration required');
    }

    // Very basic request to avoid exposing too much
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: messages.slice(-5), // Limit history
        max_tokens: 500, // Limit response length
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get AI response');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

export default new SecureOpenAIService();
