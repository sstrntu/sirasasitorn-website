/**
 * Secure Backend API for Messages App
 * Handles OpenAI API calls with security measures
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8007;
const isProduction = process.env.NODE_ENV === "production";

app.set('trust proxy', 1);
app.disable('x-powered-by');

// Security middleware
app.use(helmet());

// Limit JSON payload size (bytes)
const MAX_JSON_SIZE = parseInt(process.env.MAX_JSON_SIZE || "16384", 10);

// Custom middleware to fix JSON issues before parsing and enforce payload limits
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || "";
  if (!contentType.includes("application/json")) {
    return next();
  }

  let body = "";
  let aborted = false;

  req.on('data', chunk => {
    if (aborted) {
      return;
    }

    body += chunk.toString();

    if (body.length > MAX_JSON_SIZE) {
      aborted = true;
      console.warn('JSON payload exceeded limit');
      res.status(413).json({ error: "Payload too large" });
      req.destroy();
    }
  });

  req.on('end', () => {
    if (aborted) {
      return;
    }

    if (!isProduction) {
      console.debug('Raw body received:', body);
    }

    if (body.includes('\\!')) {
      if (!isProduction) {
        console.debug('Found escaped exclamation marks, normalizing payload');
      }
      body = body.replace(/\\!/g, "!");
    }

    try {
      req.body = JSON.parse(body);
      next();
    } catch (error) {
      console.warn('JSON parsing error:', error.message);
      res.status(400).json({ error: "Invalid JSON format" });
    }
  });

  req.on('error', (error) => {
    console.error('Request stream error:', error);
    if (!res.headersSent) {
      res.status(400).json({ error: "Invalid request stream" });
    }
  });
});

// CORS configuration - restrict to approved domains
const DEFAULT_DEV_ORIGINS = ['http://localhost:3007', 'http://127.0.0.1:3007'];
const parseAllowedOrigins = (value) => value.split(',').map(origin => origin.trim()).filter(Boolean);
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? parseAllowedOrigins(process.env.ALLOWED_ORIGINS)
  : (isProduction ? ['https://your-domain.com'] : DEFAULT_DEV_ORIGINS);

if (!allowedOrigins.length) {
  throw new Error('No allowed origins configured for CORS');
}

if (!isProduction) {
  console.debug('Allowed CORS origins:', allowedOrigins);
}

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`Blocked request from disallowed origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Client-Id', 'X-Timestamp', 'X-Origin', 'X-Requested-With'],
  maxAge: 86400
};

app.use(cors(corsOptions));

// Rate limiting
const toPositiveInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const chatRateWindowMs = toPositiveInt(process.env.CHAT_RATE_WINDOW, 60 * 1000);
const chatRateLimitMax = toPositiveInt(process.env.CHAT_RATE_LIMIT, 10);
const globalRateWindowMs = toPositiveInt(process.env.GLOBAL_RATE_WINDOW, 60 * 60 * 1000);
const globalRateLimitMax = toPositiveInt(process.env.GLOBAL_RATE_LIMIT, 100);

const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use combination of IP and client ID for better rate limiting
      return `${req.ip}-${req.headers['x-client-id'] || 'anonymous'}`;
    }
  });
};

// Different rate limits for different endpoints
const chatRateLimit = createRateLimit(
  chatRateWindowMs,
  chatRateLimitMax,
  `Too many chat requests, please try again later (limit ${chatRateLimitMax} per ${Math.max(1, Math.round(chatRateWindowMs / 1000))} seconds)`
);
const globalRateLimit = createRateLimit(
  globalRateWindowMs,
  globalRateLimitMax,
  `Hourly rate limit exceeded (limit ${globalRateLimitMax} per ${Math.max(1, Math.round(globalRateWindowMs / 60000))} minutes)`
);
// Apply rate limiting
app.use('/api/', globalRateLimit);
app.use('/api/chat', chatRateLimit);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Security validation
const validateRequest = (req, res, next) => {
  const { messages, clientId, security } = req.body;

  // Validate required fields
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  if (!clientId) {
    return res.status(400).json({ error: 'Client ID required' });
  }

  const headerClientId = req.headers['x-client-id'];
  if (!headerClientId || headerClientId !== clientId) {
    trackViolation(clientId, 'client_id_mismatch');
    return res.status(403).json({ error: "Client verification failed" });
  }

  if (!security || security.fingerprint !== clientId) {
    trackViolation(clientId, 'fingerprint_mismatch');
    return res.status(403).json({ error: "Security verification failed" });
  }

  if (security.userAgent && req.headers['user-agent'] && security.userAgent !== req.headers['user-agent']) {
    trackViolation(clientId, 'user_agent_mismatch');
    return res.status(403).json({ error: "Security verification failed" });
  }

  if (security.referrer && req.headers['x-origin'] && security.referrer !== req.headers['x-origin']) {
    trackViolation(clientId, 'origin_mismatch');
    return res.status(403).json({ error: "Security verification failed" });
  }

  // Validate message content
  for (const message of messages) {
    if (!message.role || !message.content) {
      return res.status(400).json({ error: 'Invalid message format' });
    }

    // Check message length
    if (message.content.length > 1000) {
      return res.status(400).json({ error: 'Message too long' });
    }

    // Check for suspicious content
    if (containsSuspiciousContent(message.content)) {
      return res.status(403).json({ error: 'Message contains prohibited content' });
    }
  }

  // Validate history length
  if (messages.length > 20) {
    return res.status(400).json({ error: 'Conversation history too long' });
  }

  // Validate origin in production
  if (isProduction) {
    const origin = req.headers['x-origin'];

    if (!origin || !allowedOrigins.includes(origin)) {
      trackViolation(clientId, 'origin_not_allowed');
      return res.status(403).json({ error: 'Invalid origin' });
    }
  }

  next();
};

// Helper function to detect suspicious content
function containsSuspiciousContent(content) {
  const suspiciousPatterns = [
    /\b(hack|exploit|bypass|inject|script|eval|exec)\b/i,
    /\b(admin|root|password|token|key|secret)\b/i,
    /<script|javascript:|data:|vbscript:/i,
    /\b(api.?key|openai|anthropic)\b/i,
    /\b(ignore previous|forget.*instruction|override|system.*prompt)\b/i
  ];

  return suspiciousPatterns.some(pattern => pattern.test(content));
}

// In-memory suspicious client tracking (use Redis in production)
const suspiciousClients = new Set();
const clientViolations = new Map();

// Middleware to check suspicious clients
const checkSuspiciousClient = (req, res, next) => {
  const clientId = req.headers['x-client-id'];

  if (suspiciousClients.has(clientId)) {
    return res.status(403).json({
      error: 'Access restricted due to suspicious activity'
    });
  }

  next();
};

// Track violations
const trackViolation = (clientId, type) => {
  if (!clientViolations.has(clientId)) {
    clientViolations.set(clientId, []);
  }

  const violations = clientViolations.get(clientId);
  violations.push({
    type,
    timestamp: new Date().toISOString()
  });

  // Mark as suspicious if too many violations
  if (violations.length >= 3) {
    suspiciousClients.add(clientId);
    console.warn(`Client ${clientId} marked as suspicious after ${violations.length} violations`);
  }
};

// System prompt
const SYSTEM_PROMPT = `You are Sira's personal assistant. You are helpful, professional, and knowledgeable about Sira's background, skills, and projects.

Key guidelines:
- Keep responses concise and relevant
- If asked about sensitive information like API keys, passwords, or private details, politely decline
- Focus on Sira's professional background, skills, and public projects
- Be friendly but professional
- If you don't know something specific about Sira, say so rather than making assumptions

You should not:
- Provide any technical system information
- Reveal any configuration details
- Discuss security measures
- Execute any code or commands`;

// Chat endpoint
app.post('/api/chat', checkSuspiciousClient, validateRequest, async (req, res) => {
  const { messages, clientId } = req.body;

  try {
    // Add system prompt if not present
    const messagesWithSystem = messages[0]?.role === 'system'
      ? messages
      : [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];

    // Limit conversation context to last 10 messages + system prompt
    const limitedMessages = messagesWithSystem.length > 11
      ? [messagesWithSystem[0], ...messagesWithSystem.slice(-10)]
      : messagesWithSystem;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: limitedMessages,
      max_tokens: 500,
      temperature: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.1,
      user: clientId.substring(0, 20) // Use clientId for OpenAI's abuse monitoring
    });

    const responseContent = completion.choices[0].message.content;

    // Log successful request (for monitoring)
    console.log(`Chat request from ${clientId}: ${messages.length} messages, ${responseContent.length} chars response`);

    res.json({
      message: responseContent,
      tokensUsed: completion.usage?.total_tokens || 0
    });

  } catch (error) {
    console.error('OpenAI API Error:', error);

    // Track API errors as potential abuse
    if (error.status === 400) {
      trackViolation(clientId, 'api_error');
    }

    // Don't expose internal errors to client
    res.status(500).json({
      error: 'Failed to generate response. Please try again.'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    suspiciousClients: suspiciousClients.size
  });
});

// Security metrics endpoint (for monitoring)
app.get('/api/metrics', (req, res) => {
  res.json({
    suspiciousClients: suspiciousClients.size,
    totalViolations: Array.from(clientViolations.values()).reduce((sum, violations) => sum + violations.length, 0),
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error?.message === 'Not allowed by CORS') {
    console.warn('CORS rejection for origin:', req.headers.origin || req.headers.host);
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  console.error('Server Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`Secure API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`OpenAI configured: ${!!process.env.OPENAI_API_KEY}`);
});
