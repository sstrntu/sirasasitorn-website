# Deployment Guide

This guide explains how to deploy your personal website with different deployment strategies.

## Table of Contents
- [Environment Variables](#environment-variables)
- [Deployment Strategy 1: Full-Stack Docker](#deployment-strategy-1-full-stack-docker)
- [Deployment Strategy 2: Separate Frontend/Backend](#deployment-strategy-2-separate-frontendbackend)
- [Security Checklist](#security-checklist)
- [Troubleshooting](#troubleshooting)

---

## Environment Variables

### Required Environment Variables

#### Backend (REQUIRED)
```bash
# OpenAI API Key (REQUIRED)
OPENAI_API_KEY=sk-proj-xxxxx

# Server Configuration
PORT=8007                    # Default: 8007 (dev), 3007 (prod)
NODE_ENV=production          # Set to 'production' for production

# CORS Configuration (REQUIRED for production)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Rate Limiting (Optional - uses defaults if not set)
CHAT_RATE_LIMIT=10          # Max chat requests per window (default: 10)
CHAT_RATE_WINDOW=60000      # Window in ms (default: 60000 = 1 min)
GLOBAL_RATE_LIMIT=100       # Max global requests per window (default: 100)
GLOBAL_RATE_WINDOW=3600000  # Window in ms (default: 3600000 = 1 hour)

# Request Limits (Optional)
MAX_JSON_SIZE=16384         # Max JSON payload in bytes (default: 16384 = 16KB)
```

#### Frontend (Optional)
```bash
# Frontend Configuration
REACT_APP_API_URL=https://your-api-domain.com  # Backend URL
PUBLIC_URL=https://yourdomain.com              # Frontend URL
```

### Where to Set Environment Variables

**For local development:**
- Create `backend/.env` file with your `OPENAI_API_KEY`
- Backend will use localhost defaults

**For Docker deployment:**
- Set in `docker-compose.yml` or pass via `docker run -e`

**For cloud deployments:**
- Set in your platform's environment variables UI
- Netlify: Site settings → Build & deploy → Environment
- Vercel: Project settings → Environment Variables
- Railway/Render: Environment variables section

---

## Deployment Strategy 1: Full-Stack Docker

**Best for:** Single-server deployment, VPS, cloud VM, or local containerization

This strategy builds both frontend and backend into a single Docker container that serves both the React app and API.

### Configuration Files
- `Dockerfile` (multi-stage build)
- `docker-compose.yml`

### Steps

1. **Update docker-compose.yml** with your production settings:

```yaml
services:
  app:
    build:
      context: .
      args:
        REACT_APP_API_URL: ""  # Empty = same origin
    ports:
      - "3007:3007"
    environment:
      - PORT=3007
      - NODE_ENV=production
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

2. **Build and run:**

```bash
# Set your API key
export OPENAI_API_KEY=sk-proj-xxxxx

# Build and start
docker-compose up -d

# View logs
docker-compose logs -f
```

3. **Access your application:**
- Frontend: http://localhost:3007
- API: http://localhost:3007/api/chat

### Production Deployment

**For cloud VM (DigitalOcean, AWS EC2, etc.):**

```bash
# SSH into your server
ssh user@your-server-ip

# Clone your repo
git clone https://github.com/yourusername/personal-website.git
cd personal-website

# Create production .env file
nano backend/.env
# Add: OPENAI_API_KEY=sk-proj-xxxxx

# Update docker-compose.yml with your domain
nano docker-compose.yml
# Set ALLOWED_ORIGINS to your production domain

# Build and start
docker-compose up -d

# Set up nginx reverse proxy (optional, for HTTPS)
# See nginx configuration below
```

**Nginx Reverse Proxy Configuration (for HTTPS):**

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3007;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Deployment Strategy 2: Separate Frontend/Backend

**Best for:** Scalability, using static hosting platforms (Netlify/Vercel), separate scaling

### Option A: Netlify/Vercel Frontend + Backend on Railway/Render

#### Deploy Backend First

**Railway.app:**
1. Connect your GitHub repo
2. Select backend folder as root
3. Set environment variables:
   - `OPENAI_API_KEY=sk-proj-xxxxx`
   - `NODE_ENV=production`
   - `PORT=3007`
   - `ALLOWED_ORIGINS=https://your-netlify-site.netlify.app`
4. Deploy automatically from main branch

**Render.com:**
1. Create new Web Service
2. Connect GitHub repo
3. Set:
   - Build Command: `cd backend && npm install`
   - Start Command: `node backend/server.js`
   - Environment Variables (same as Railway above)
4. Deploy

**Note your backend URL:** `https://your-backend.railway.app` or `https://your-backend.onrender.com`

#### Deploy Frontend

**Netlify:**
1. Connect your GitHub repo
2. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `build`
3. Set environment variables:
   - `REACT_APP_API_URL=https://your-backend.railway.app`
   - `NODE_VERSION=18`
4. Deploy

**Vercel:**
1. Import your GitHub repo
2. Configure:
   - Framework Preset: Create React App
   - Build Command: `npm run build`
   - Output Directory: `build`
3. Set environment variables:
   - `REACT_APP_API_URL=https://your-backend.railway.app`
4. Deploy

#### Update Backend CORS

After deploying frontend, update backend `ALLOWED_ORIGINS`:
```bash
ALLOWED_ORIGINS=https://your-site.netlify.app,https://your-site.vercel.app
```

### Option B: Both on Same Platform (Railway/Render)

1. Deploy backend as Web Service (port 3007)
2. Deploy frontend as Static Site:
   - Build command: `npm run build`
   - Publish directory: `build`
   - Redirect rules: `/* /index.html 200`
3. Configure CORS to allow your frontend domain

---

## Security Checklist

Before deploying to production, verify:

- [ ] **OPENAI_API_KEY is set in backend environment variables** (NOT in frontend!)
- [ ] **`.env` files are in `.gitignore`** (verify: `git log --all -- ".env"` should be empty)
- [ ] **ALLOWED_ORIGINS is set** to your production domain(s)
- [ ] **NODE_ENV=production** is set for backend
- [ ] **HTTPS is enabled** (use Let's Encrypt for free SSL)
- [ ] **Rate limiting is configured** (defaults are good for most cases)
- [ ] **Dependencies are up to date**: Run `npm audit` and fix vulnerabilities
- [ ] **Test the /api/health endpoint** to verify backend is running
- [ ] **Test CORS** by accessing your frontend domain

### Verify Security

```bash
# Check that .env is not in git history
git log --all --full-history -- ".env" "backend/.env"
# Should return nothing

# Check for any exposed secrets in code
grep -r "sk-proj-" --include="*.js" --include="*.jsx" src/
# Should return nothing

# Test backend health
curl https://your-backend-url.com/api/health
# Should return: {"status":"ok","timestamp":"...","suspiciousClients":0}

# Test CORS (replace with your domains)
curl -H "Origin: https://yourdomain.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://your-backend-url.com/api/chat
# Should return CORS headers
```

---

## Monitoring & Maintenance

### Check Backend Health

```bash
# Health check
curl https://your-backend-url.com/api/health

# Security metrics
curl https://your-backend-url.com/api/metrics
```

### View Logs

**Docker deployment:**
```bash
docker-compose logs -f
```

**Railway/Render:**
- View logs in their dashboard

### Update Deployment

**Docker:**
```bash
git pull
docker-compose down
docker-compose build
docker-compose up -d
```

**Netlify/Vercel:**
- Automatically deploys on git push to main

**Railway/Render:**
- Automatically redeploys on git push

---

## Troubleshooting

### "Chat service is currently unavailable"
- **Cause**: OPENAI_API_KEY not set or invalid
- **Fix**: Set OPENAI_API_KEY in backend environment variables

### "Origin not allowed" error
- **Cause**: CORS blocking your frontend domain
- **Fix**: Add your frontend domain to ALLOWED_ORIGINS in backend

### Rate limit errors
- **Cause**: Too many requests from same client
- **Fix**: Wait for rate limit window to expire, or increase limits

### Backend not starting
- **Check logs**: `docker-compose logs` or platform logs
- **Common issues**:
  - Port already in use
  - Missing environment variables
  - Node version mismatch (need Node 16+)

### Frontend can't reach backend
- **Check**: REACT_APP_API_URL is set correctly
- **Test**: `curl https://your-backend-url.com/api/health`
- **Verify**: CORS is configured with frontend domain

### 3D scene not loading
- **Cause**: Large camping.glb file (45MB)
- **Fix**: Ensure static files are served correctly
- **Check**: Browser console for loading errors

---

## Performance Optimization

### Production Checklist
- [ ] Enable gzip compression (nginx/cloudflare)
- [ ] Set up CDN for static assets
- [ ] Enable browser caching headers
- [ ] Monitor API usage and costs (OpenAI dashboard)
- [ ] Set up error tracking (Sentry)
- [ ] Enable log aggregation (Papertrail, Logtail)

### Cost Management
- Monitor OpenAI API usage: https://platform.openai.com/usage
- Rate limits help prevent abuse and cost overruns
- Default settings: ~$0.002 per chat message (gpt-3.5-turbo)
- Max 10 messages/minute × 60 minutes × 24 hours × 30 days × $0.002 = ~$864/month theoretical max
- Actual usage typically much lower due to human interaction patterns

---

## Support

If you encounter issues:
1. Check logs for error messages
2. Verify environment variables are set correctly
3. Test backend health endpoint
4. Check CORS configuration
5. Review SECURITY.md for security best practices

For OpenAI API issues: https://platform.openai.com/docs
For Docker issues: https://docs.docker.com
