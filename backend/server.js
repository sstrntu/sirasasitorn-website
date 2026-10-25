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
const { getWeather } = require('./services/weather');

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const DEFAULT_PORT = isProduction ? 3007 : 8007;
const PORT = parseInt(process.env.PORT, 10) || DEFAULT_PORT;

app.set('trust proxy', 1);
app.disable('x-powered-by');

// Sources only allowed while developing locally
const devOnly = (...sources) => (isProduction ? [] : sources);

// Security headers. Scripts may only come from this site and Google Analytics: no inline
// or eval'd code (the 3D scene's physics and model decoder need WebAssembly, which
// 'wasm-unsafe-eval' allows on its own)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        ...devOnly("http://localhost:3007"),
        "https://cdn-icons-png.flaticon.com",
        "https://raw.githubusercontent.com",
        "https://upload.wikimedia.org",
        "https://icons.iconarchive.com",
        "https://tile.openstreetmap.org",
        "https://*.tile.openstreetmap.org",
        "https://*.google-analytics.com",
        "https://*.googletagmanager.com"
      ], // Dock icons, OSM tiles, Google Analytics beacons
      scriptSrc: [
        "'self'",
        "'wasm-unsafe-eval'",
        "https://*.googletagmanager.com"
      ],
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
        ...devOnly("http://localhost:8007", "http://localhost:3007"),
        "https://sirasasitorn.com",
        "https://www.sirasasitorn.com",
        "https://tile.openstreetmap.org",
        "https://*.tile.openstreetmap.org",
        "https://*.supabase.co",
        "wss://*.supabase.co",
        "https://*.google-analytics.com",
        "https://*.analytics.google.com",
        "https://*.googletagmanager.com"
      ], // Map tiles, Supabase (admin), Google Analytics
      workerSrc: ["'self'", "blob:"], // Allow web workers with blob URLs
      childSrc: ["'self'", "blob:"], // Allow child contexts with blob URLs
    },
  },
}));

// Limit JSON payload size (bytes)
const MAX_JSON_SIZE = parseInt(process.env.MAX_JSON_SIZE || "16384", 10);

app.use(express.json({ limit: MAX_JSON_SIZE }));

// CORS configuration - restrict to approved domains
// The built site (3007) and the React dev server (3000)
const DEFAULT_DEV_ORIGINS = ['http://localhost:3007', 'http://127.0.0.1:3007', 'http://localhost:3000', 'http://127.0.0.1:3000'];
const parseAllowedOrigins = (value) => value.split(',').map(origin => origin.trim()).filter(Boolean);
const fallbackProdOrigins = parseAllowedOrigins(process.env.PUBLIC_URL || '');
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? parseAllowedOrigins(process.env.ALLOWED_ORIGINS)
  : (isProduction ? fallbackProdOrigins : DEFAULT_DEV_ORIGINS);
const hasAllowlist = allowedOrigins.length > 0;

if (!hasAllowlist && isProduction) {
  console.warn('ALLOWED_ORIGINS not configured; temporarily allowing all origins. Set ALLOWED_ORIGINS to restrict access.');
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

/** First four groups (the /64 network) of an IPv6 address: one visitor usually has a whole /64. */
const ipv6Network = (ip) => {
  const [head, tail = ''] = ip.split('::');
  const front = head ? head.split(':') : [];
  const back = tail ? tail.split(':') : [];
  const groups = ip.includes('::') ? [...front, ...Array(Math.max(0, 8 - front.length - back.length)).fill('0'), ...back] : front;
  return `${groups.slice(0, 4).join(':')}::/64`;
};

/**
 * The visitor's IP. The app sits behind DigitalOcean's edge (Cloudflare), which sets these
 * headers itself, overwriting anything a client sends, so they can't be faked to dodge limits.
 */
const clientIp = (req) => {
  const ip = String(req.headers['do-connecting-ip'] || req.headers['cf-connecting-ip'] || req.ip || '').trim();
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return mapped[1];
  return ip.includes(':') ? ipv6Network(ip) : ip;
};

const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    // By the visitor's IP alone: a client-chosen ID in the key would let anyone reset
    // their limit by sending a new ID with every request
    keyGenerator: clientIp
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
    trackViolation(req, 'client_id_mismatch');
    return res.status(403).json({ error: "Client verification failed" });
  }

  if (!security || security.fingerprint !== clientId) {
    trackViolation(req, 'fingerprint_mismatch');
    return res.status(403).json({ error: "Security verification failed" });
  }

  if (security.userAgent && req.headers['user-agent'] && security.userAgent !== req.headers['user-agent']) {
    trackViolation(req, 'user_agent_mismatch');
    return res.status(403).json({ error: "Security verification failed" });
  }

  if (security.referrer && req.headers['x-origin'] && security.referrer !== req.headers['x-origin']) {
    trackViolation(req, 'origin_mismatch');
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
      trackViolation(req, 'origin_not_allowed');
      return res.status(403).json({ error: 'Invalid origin' });
    }
  }

  next();
};

// Helper function to detect suspicious content: markup/script injection and the usual
// prompt-injection phrasing. Everyday words ("What are your key skills?") are fine.
function containsSuspiciousContent(content) {
  const suspiciousPatterns = [
    /<\s*script|javascript:|vbscript:|data:text\/html/i,
    /\b(ignore|disregard|forget)\b.{0,40}\b(previous|prior|above|all|your)\b.{0,40}\b(instructions?|prompts?|rules?)\b/i,
    /\b(system|developer)\s+(prompt|message|instructions?)\b/i,
    /\b(reveal|show|print|leak|dump)\b.{0,40}\b(api.?keys?|secrets?|passwords?|credentials?|env(ironment)? variables?)\b/i
  ];

  return suspiciousPatterns.some(pattern => pattern.test(content));
}

// Visitors failing the request checks, by IP (in memory): three strikes blocks them for a
// day. Capped, so a flood of new addresses can't grow it without limit.
const VIOLATION_LIMIT = 3;
const VIOLATION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TRACKED_CLIENTS = 10000;
const clientViolations = new Map(); // ip -> { count, since }, least recently seen first

const violationsOf = (ip) => {
  const entry = clientViolations.get(ip);
  return entry && Date.now() - entry.since <= VIOLATION_TTL_MS ? entry : null;
};

// Middleware to turn away blocked visitors
const checkSuspiciousClient = (req, res, next) => {
  if ((violationsOf(clientIp(req))?.count || 0) >= VIOLATION_LIMIT) {
    return res.status(403).json({
      error: 'Access restricted due to suspicious activity'
    });
  }

  next();
};

// Track violations
const trackViolation = (req, type) => {
  const ip = clientIp(req);
  const entry = violationsOf(ip) || { count: 0, since: Date.now() };
  entry.count += 1;
  clientViolations.delete(ip);
  clientViolations.set(ip, entry);
  if (clientViolations.size > MAX_TRACKED_CLIENTS) {
    clientViolations.delete(clientViolations.keys().next().value);
  }

  if (entry.count === VIOLATION_LIMIT) {
    console.warn(`Client ${ip} blocked after ${entry.count} violations (last: ${type})`);
  }
};

// Auth middleware for admin routes: a valid Supabase session isn't enough (anyone could
// sign themselves up), the account must also carry the admin role in its app_metadata,
// which only the service role or the Supabase dashboard can set
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

    if (user.app_metadata?.role !== 'admin') {
      console.warn(`Admin API refused for non-admin account ${user.id}`);
      return res.status(403).json({ error: 'Forbidden' });
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

// Current weather in Krabi for the island and the desktop's menu bar (public, cached)
app.get('/api/weather', getWeather);

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

// Chat endpoint (Temporary hardcoded response - AI system under development)
app.post('/api/chat', checkSuspiciousClient, validateRequest, async (req, res) => {
  const { messages, clientId } = req.body;
  
  // Hardcoded response while AI system is being developed
  const responseContent = "🤖 Thanks for reaching out!\n\nI'm currently working on an advanced AI messaging system with personalized information and my personal AI agents. This will include:\n\n• Retrieval-Augmented Generation (RAG) for accurate responses\n• Strict content guardrails for safety\n• Context-aware conversations about my work and projects\n\nPlease check back soon to chat with my AI assistant! In the meantime, feel free to explore the Notes and Maps sections to learn more about me.\n\n— Sira";
  
  // Log request (for monitoring)
  console.log(`Chat request from ${clientId}: Returned under-development message`);

  res.json({
    message: responseContent,
    tokensUsed: 0
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Fallback for unmatched API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const buildDir = path.join(__dirname, '..', 'build');

if (fs.existsSync(buildDir)) {
  // CRA fingerprints everything under /static (content hash in the file name),
  // so browsers and Cloudflare can keep those forever
  app.use('/static', express.static(path.join(buildDir, 'static'), {
    immutable: true,
    maxAge: '1y',
  }));
  // Scene models and textures keep stable names: cache for a week, then revalidate
  app.use('/jungle', express.static(path.join(buildDir, 'jungle'), {
    maxAge: '7d',
  }));
  // Ch̀wy (ช่วย) prototype: a separate single-page app built with Expo, copied into
  // public/chwy. Its /_expo files have content hashes, so they can be cached forever.
  const chwyDir = path.join(buildDir, 'chwy');
  app.use('/chwy/_expo', express.static(path.join(chwyDir, '_expo'), {
    immutable: true,
    maxAge: '1y',
  }));
  app.use('/chwy', express.static(chwyDir));
  // Deep links like /chwy/give/cart load the prototype's own index.html
  app.get(['/chwy', '/chwy/*'], (req, res) => {
    res.sendFile(path.join(chwyDir, 'index.html'));
  });

  // Everything else (index.html, manifest, icons) is revalidated on every visit
  // so a new deploy shows up immediately
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
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON format' });
  }

  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' });
  }

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

// Logged rather than exiting: a single failed request shouldn't take the whole site down
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
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
