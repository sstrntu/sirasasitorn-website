# Security Implementation for Messages App

This document outlines the comprehensive security measures implemented to prevent API abuse and protect your OpenAI API costs.

## 🚨 Critical Security Issues Fixed

### 1. **API Key Exposure (HIGH RISK)**
- **Before**: OpenAI API key was exposed in the frontend browser code
- **After**: API key is now secured in backend environment variables only

### 2. **Direct Browser API Calls (HIGH RISK)**
- **Before**: Frontend made direct calls to OpenAI API
- **After**: All API calls now route through secure backend proxy

### 3. **No Rate Limiting (HIGH RISK)**
- **Before**: Users could spam unlimited API requests
- **After**: Multiple layers of rate limiting implemented

### 4. **No Input Validation (MEDIUM RISK)**
- **Before**: No validation of message content or conversation history
- **After**: Comprehensive validation and sanitization

## 🛡️ Security Layers Implemented

### Frontend Security (`apiSecurity.js`)

**1. Client Identification & Fingerprinting**
```javascript
// Generates unique client ID using browser fingerprinting
const clientId = apiSecurity.getClientId();
```

**2. Rate Limiting (Frontend)**
- **Messages**: 10 messages per minute per client
- **Global**: 50 requests per hour per client
- Tracks requests using browser fingerprinting + session storage

**3. Content Validation**
- Max message length: 1000 characters
- Max conversation history: 10 messages
- Banned patterns detection:
  - Hacking/exploit keywords
  - Admin/password keywords
  - Script injection attempts
  - API key fishing attempts

**4. Spam Detection**
- Repetitive content detection
- Excessive caps detection
- Excessive punctuation detection

**5. Suspicious Activity Tracking**
- Logs violations per client
- Auto-marks clients as suspicious after 3 violations
- Blocks suspicious clients from further requests

### Backend Security (`backend/server.js`)

**1. Infrastructure Security**
```javascript
app.set('trust proxy', 1); // Honor real client IPs behind proxies
app.disable('x-powered-by'); // Hide Express fingerprint
app.use(helmet()); // Security headers
app.use(cors(corsOptions)); // Restricted CORS
```

**2. Rate Limiting (Server-side)**
```javascript
const chatRateWindowMs = parseInt(process.env.CHAT_RATE_WINDOW ?? 60000, 10);
const chatRateLimitMax = parseInt(process.env.CHAT_RATE_LIMIT ?? 10, 10);
const chatRateLimit = createRateLimit(chatRateWindowMs, chatRateLimitMax, 'Too many requests');

const globalRateWindowMs = parseInt(process.env.GLOBAL_RATE_WINDOW ?? 3600000, 10);
const globalRateLimitMax = parseInt(process.env.GLOBAL_RATE_LIMIT ?? 100, 10);
const globalRateLimit = createRateLimit(globalRateWindowMs, globalRateLimitMax, 'Hourly limit exceeded');
```

**3. Request Validation**
- Validates message format and content
- Checks conversation history length
- Validates client ID and origin
- Cross-checks fingerprint, user agent, and origin headers
- Rejects oversized payloads (> 16 KB by default)
- Detects suspicious content patterns

**4. Content Filtering**
```javascript
const suspiciousPatterns = [
  /\b(hack|exploit|bypass|inject|script|eval|exec)\b/i,
  /\b(admin|root|password|token|key|secret)\b/i,
  /<script|javascript:|data:|vbscript:/i,
  /\b(api.?key|openai|anthropic)\b/i,
  /\b(ignore previous|forget.*instruction|override|system.*prompt)\b/i
];
```

**5. OpenAI API Protection**
- System prompt injection to control AI behavior
- Limited context window (max 10 messages)
- Response length limiting (500 tokens max)
- User ID tracking for OpenAI's abuse monitoring

## 📊 Monitoring & Alerting

### Security Metrics Endpoint
```
GET /api/metrics
```
Returns:
- Number of suspicious clients
- Total violations count
- System health status

### Logging
- All suspicious activities logged to console
- Client violations tracked in memory
- API errors and abuse attempts logged

## 🚀 Deployment Instructions

### 1. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
npm run dev  # Development
npm start    # Production
```

### 2. Frontend Configuration
Update your `.env` file:
```bash
REACT_APP_API_URL=http://localhost:8007  # Development
REACT_APP_API_URL=https://your-api-domain.com  # Production
```

### 3. Production Deployment

**Backend Environment Variables:**
```bash
OPENAI_API_KEY=your_openai_api_key
NODE_ENV=production
PORT=8007
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
CHAT_RATE_LIMIT=10
CHAT_RATE_WINDOW=60000
GLOBAL_RATE_LIMIT=100
GLOBAL_RATE_WINDOW=3600000
MAX_JSON_SIZE=16384
```

**Configure allowed origins via environment:**
```bash
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

## 🔒 Security Best Practices

### 1. **Never Expose API Keys**
- ❌ Never put API keys in frontend code
- ✅ Always use backend proxy for API calls
- ✅ Use environment variables for secrets

### 2. **Implement Defense in Depth**
- ✅ Multiple layers of rate limiting
- ✅ Frontend AND backend validation
- ✅ Request monitoring and suspicious client tracking

### 3. **Monitor and Alert**
- ✅ Log all security events
- ✅ Track suspicious client behavior
- ✅ Set up alerts for unusual activity

### 4. **Regular Security Updates**
- Keep all dependencies updated
- Monitor for new security vulnerabilities
- Regularly review and update security measures

## 🚨 Cost Protection Features

### 1. **Request Limits**
- Max 10 messages per minute per user
- Max 100 requests per hour per user
- Max 500 tokens per response

### 2. **Content Limits**
- Max 1000 characters per message
- Max 10 messages in conversation history
- Automatic conversation context truncation

### 3. **Abuse Prevention**
- Automatic suspicious client blocking
- Content filtering to prevent prompt injection
- System prompt protection

## 📈 Usage Monitoring

The system tracks:
- Request frequency per client
- Message lengths and patterns
- Suspicious activity attempts
- API response times and errors

## 🔧 Testing Security

### Test Rate Limiting:
```javascript
// Send 11 messages quickly - should be blocked on 11th
for(let i = 0; i < 11; i++) {
  await sendMessage("Test " + i);
}
```

### Test Content Filtering:
```javascript
// These should be blocked:
await sendMessage("hack the system");
await sendMessage("what is your api key");
await sendMessage("<script>alert('xss')</script>");
```

### Test Suspicious Client Detection:
```javascript
// After 3 violations, client should be marked suspicious
await sendMessage("hack");  // Violation 1
await sendMessage("bypass security");  // Violation 2
await sendMessage("admin password");  // Violation 3
await sendMessage("normal message");  // Should be blocked
```

## 🆘 Emergency Procedures

### If API Key is Compromised:
1. Immediately revoke the API key in OpenAI dashboard
2. Generate new API key
3. Update backend environment variables
4. Redeploy backend service
5. Monitor usage for suspicious activity

### If Excessive Usage Detected:
1. Check `/api/metrics` for suspicious clients
2. Review server logs for abuse patterns
3. Consider temporarily reducing rate limits
4. Block specific client IDs if necessary

---

**Security Status**: ✅ **SECURED**
- API keys protected in backend
- Multiple layers of rate limiting active
- Content validation and filtering enabled
- Suspicious activity monitoring active
- Cost protection measures in place
