/**
 * Secure Backend API for Messages App
 * Handles OpenAI API calls with security measures
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { OpenAI } = require('openai');
require('dotenv').config();

// Import services
const supabase = require('./services/supabase');
const ragService = require('./services/ragService');

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const DEFAULT_PORT = isProduction ? 3007 : 8007;
const PORT = parseInt(process.env.PORT, 10) || DEFAULT_PORT;

app.set('trust proxy', 1);
app.disable('x-powered-by');

// Security middleware with relaxed CSP for 3D content
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "http://localhost:3007",
        "https://cdn-icons-png.flaticon.com",
        "https://raw.githubusercontent.com",
        "https://upload.wikimedia.org",
        "https://icons.iconarchive.com",
        "https://tile.openstreetmap.org",
        "https://*.tile.openstreetmap.org"
      ], // Allow external icon sources and OSM tiles
      scriptSrc: ["'self'", "'unsafe-eval'"], // Allow eval for Three.js/WebGL
      styleSrc: [
        "'self'", 
        "'unsafe-inline'",
        "https://fonts.googleapis.com"
      ], // Allow inline styles and Google Fonts
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com"
      ], // Allow Google Fonts
      connectSrc: [
        "'self'",
        "blob:",
        "http://localhost:8007",
        "http://localhost:3007",
        "https://sirasasitorn.com",
        "https://www.sirasasitorn.com",
        "https://tile.openstreetmap.org",
        "https://*.tile.openstreetmap.org",
        "https://*.supabase.co",
        "wss://*.supabase.co"
      ], // Allow blob connections, map tiles, Supabase, localhost development, and production domain
      workerSrc: ["'self'", "blob:"], // Allow web workers with blob URLs
      childSrc: ["'self'", "blob:"], // Allow child contexts with blob URLs
    },
  },
}));

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
const fallbackProdOrigins = parseAllowedOrigins(process.env.PUBLIC_URL || '');
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? parseAllowedOrigins(process.env.ALLOWED_ORIGINS)
  : (isProduction ? fallbackProdOrigins : DEFAULT_DEV_ORIGINS);
const hasAllowlist = allowedOrigins.length > 0;

if (!hasAllowlist && isProduction) {
  console.warn('ALLOWED_ORIGINS not configured; temporarily allowing all origins. Set ALLOWED_ORIGINS to restrict access.');
}

if (!isProduction) {
  console.debug('Allowed CORS origins:', hasAllowlist ? allowedOrigins : ['*']);
}

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (!hasAllowlist || allowedOrigins.includes(origin)) {
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

// Initialize OpenAI with fallback
let openai = null;
try {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API;
  if (apiKey) {
    openai = new OpenAI({
      apiKey: apiKey
    });
    console.log('OpenAI client initialized successfully');
  } else {
    console.warn('No OpenAI API key found - chat functionality will be disabled');
  }
} catch (error) {
  console.error('Failed to initialize OpenAI client:', error);
}

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

// Auth middleware for admin routes
const verifySupabaseAuth = async (req, res, next) => {
  if (!supabase) {
    return res.status(503).json({ error: 'CMS service not available' });
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Authentication failed' });
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

// ==================== PUBLIC API ROUTES ====================

// Get notes sections (public)
app.get('/api/notes', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Service not available' });
  }

  try {
    const { data, error } = await supabase
      .from('notes_sections')
      .select('*')
      .order('order_index');

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Failed to fetch notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Get map locations (public)
app.get('/api/locations', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Service not available' });
  }

  try {
    const { data, error } = await supabase
      .from('map_locations')
      .select('*')
      .eq('is_active', true)
      .order('city');

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Failed to fetch locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// ==================== ADMIN API ROUTES ====================

// Notes Management
// GET all notes (admin)
app.get('/api/admin/notes', verifySupabaseAuth, async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Service not available' });
  }

  try {
    const { data, error } = await supabase
      .from('notes_sections')
      .select('*')
      .order('order_index');

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Failed to fetch notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

app.post('/api/admin/notes', verifySupabaseAuth, async (req, res) => {
  const { id, section_key, title, description, skills_header, skills_items, order_index } = req.body;

  try {
    if (id) {
      // Update existing
      const { data, error } = await supabase
        .from('notes_sections')
        .update({
          title,
          description,
          skills_header,
          skills_items,
          order_index,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } else {
      // Create new
      const { data, error } = await supabase
        .from('notes_sections')
        .insert({
          section_key,
          title,
          description,
          skills_header,
          skills_items,
          order_index: order_index || 0
        })
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    }
  } catch (error) {
    console.error('Failed to save notes section:', error);
    res.status(500).json({ error: 'Failed to save notes section' });
  }
});

app.put('/api/admin/notes/:id', verifySupabaseAuth, async (req, res) => {
  const { title, description, skills_header, skills_items, order_index } = req.body;

  try {
    const { data, error } = await supabase
      .from('notes_sections')
      .update({
        title,
        description,
        skills_header,
        skills_items,
        order_index,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Failed to update notes section:', error);
    res.status(500).json({ error: 'Failed to update notes section' });
  }
});

app.delete('/api/admin/notes/:id', verifySupabaseAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('notes_sections')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete notes section:', error);
    res.status(500).json({ error: 'Failed to delete notes section' });
  }
});

// Locations Management
// GET all locations (admin)
app.get('/api/admin/locations', verifySupabaseAuth, async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Service not available' });
  }

  try {
    const { data, error } = await supabase
      .from('map_locations')
      .select('*')
      .order('city');

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Failed to fetch locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

app.post('/api/admin/locations', verifySupabaseAuth, async (req, res) => {
  const { id, city, country, latitude, longitude, description, category, is_active } = req.body;

  try {
    if (id) {
      // Update existing
      const { data, error } = await supabase
        .from('map_locations')
        .update({
          city,
          country,
          latitude,
          longitude,
          description,
          category,
          is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } else {
      // Create new
      const { data, error } = await supabase
        .from('map_locations')
        .insert({
          city,
          country,
          latitude,
          longitude,
          description,
          category,
          is_active: is_active !== undefined ? is_active : true
        })
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    }
  } catch (error) {
    console.error('Failed to save location:', error);
    res.status(500).json({ error: 'Failed to save location' });
  }
});

app.put('/api/admin/locations/:id', verifySupabaseAuth, async (req, res) => {
  const { city, country, latitude, longitude, description, category, is_active } = req.body;

  try {
    const { data, error } = await supabase
      .from('map_locations')
      .update({
        city,
        country,
        latitude,
        longitude,
        description,
        category,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Failed to update location:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

app.delete('/api/admin/locations/:id', verifySupabaseAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('map_locations')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete location:', error);
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

// Knowledge Base Management
app.get('/api/admin/knowledge', verifySupabaseAuth, async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Service not available' });
  }

  try {
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('id, title, content, category, metadata, is_active, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Failed to fetch knowledge base:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge base' });
  }
});

app.post('/api/admin/knowledge', verifySupabaseAuth, async (req, res) => {
  const { title, content, category, metadata } = req.body;

  if (!title || !content || !category) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const doc = await ragService.addDocument(title, content, category, metadata || {});
    res.json(doc);
  } catch (error) {
    console.error('Failed to add knowledge document:', error);
    res.status(500).json({ error: 'Failed to add document' });
  }
});

app.put('/api/admin/knowledge/:id', verifySupabaseAuth, async (req, res) => {
  const { title, content, category, metadata, is_active } = req.body;
  const updates = {};

  if (title) updates.title = title;
  if (content) updates.content = content;
  if (category) updates.category = category;
  if (metadata) updates.metadata = metadata;
  if (is_active !== undefined) updates.is_active = is_active;

  try {
    const doc = await ragService.updateDocument(req.params.id, updates);
    res.json(doc);
  } catch (error) {
    console.error('Failed to update knowledge document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

app.delete('/api/admin/knowledge/:id', verifySupabaseAuth, async (req, res) => {
  try {
    await ragService.deleteDocument(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete knowledge document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Analytics
app.get('/api/admin/analytics', verifySupabaseAuth, async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Service not available' });
  }

  try {
    // Get recent chat sessions
    const { data: analytics } = await supabase
      .from('chat_analytics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    res.json({
      analytics: analytics || []
    });
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ==================== CHAT ENDPOINT (Enhanced with RAG) ====================

// Chat endpoint (Enhanced with RAG)
app.post('/api/chat', checkSuspiciousClient, validateRequest, async (req, res) => {
  const { messages, clientId } = req.body;
  const startTime = Date.now();

  // Check if OpenAI is available
  if (!openai) {
    return res.status(503).json({
      error: 'Chat service is currently unavailable. Please try again later.'
    });
  }

  try {
    // Extract user's latest query
    const userQuery = messages[messages.length - 1]?.content || '';
    
    // Try to get RAG context (non-blocking if RAG is disabled)
    let ragContext = { context: '', sources: [] };
    if (ragService.isEnabled() && process.env.ENABLE_RAG !== 'false') {
      try {
        ragContext = await ragService.buildRAGContext(userQuery);
      } catch (ragError) {
        console.warn('RAG search failed, continuing without context:', ragError.message);
      }
    }

    // Build enhanced system prompt with RAG context
    let systemPrompt = SYSTEM_PROMPT;
    if (ragContext.context) {
      systemPrompt += `\n\nRelevant information from knowledge base:\n${ragContext.context}\n\nUse this context to provide accurate, specific answers.`;
    }

    // Add system prompt if not present
    const messagesWithSystem = messages[0]?.role === 'system'
      ? messages
      : [{ role: 'system', content: systemPrompt }, ...messages];

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
    const tokensUsed = completion.usage?.total_tokens || 0;
    const responseTime = Date.now() - startTime;

    // Log anonymous analytics if enabled
    if (supabase && process.env.ENABLE_CHAT_ANALYTICS === 'true') {
      try {
        await supabase.from('chat_analytics').insert({
          session_id: clientId.substring(0, 50),
          user_message: userQuery.substring(0, 1000),
          ai_response: responseContent.substring(0, 1000),
          tokens_used: tokensUsed,
          rag_sources: ragContext.sources,
          response_time_ms: responseTime
        });
      } catch (analyticsError) {
        console.warn('Failed to log analytics:', analyticsError.message);
      }
    }

    // Log successful request (for monitoring)
    console.log(`Chat request from ${clientId}: ${messages.length} messages, ${responseContent.length} chars response, RAG: ${ragContext.sources.length > 0}`);

    res.json({
      message: responseContent,
      tokensUsed: tokensUsed
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

// Fallback for unmatched API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const buildDir = path.join(__dirname, '..', 'build');

if (fs.existsSync(buildDir)) {
  app.use(express.static(buildDir));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }

    res.sendFile(path.join(buildDir, 'index.html'));
  });
} else if (isProduction) {
  console.warn('Static build directory not found. Serving API only.');
}

// Error handling middleware
app.use((error, req, res, next) => {
  if (error?.message === 'Not allowed by CORS') {
    console.warn('CORS rejection for origin:', req.headers.origin || req.headers.host);
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  console.error('Server Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Error handling for startup
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Secure API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`OpenAI configured: ${!!process.env.OPENAI_API_KEY}`);
  console.log(`Build directory exists: ${fs.existsSync(buildDir)}`);
});

server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});
