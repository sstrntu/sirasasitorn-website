# Deployment Guide

This guide covers deploying the personal website to DigitalOcean App Platform.

## Architecture

- **Frontend:** React.js with Three.js (built into static files)
- **Backend:** Node.js/Express API server
- **Database:** Supabase (PostgreSQL)
- **Deployment:** Docker container on DigitalOcean App Platform

## Environment Variables

### Frontend (Build-time, hardcoded in Dockerfile)
```
REACT_APP_API_URL=""  # Empty string for same-origin requests
REACT_APP_SUPABASE_URL=https://epclbvqatdyhybukzsme.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<your-anon-key>
```

### Backend (Runtime, configured in App Spec)
```
PORT=3007
NODE_ENV=production
SUPABASE_URL=https://epclbvqatdyhybukzsme.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret>
OPENAI_API_KEY=<secret>
ALLOWED_ORIGINS=https://sirasasitorn.com,https://www.sirasasitorn.com
ENABLE_CHAT_ANALYTICS=true
ENABLE_RAG=true
```

## DigitalOcean App Spec

The complete App Spec is in `DO_APP_SPEC_FINAL.md`. Key points:

1. Uses Docker build from `Dockerfile`
2. Frontend env vars are hardcoded in Dockerfile (see below)
3. Backend env vars are configured in App Spec
4. Health check on `/api/health`
5. Auto-deploys from `main` branch

## Dockerfile Structure

Multi-stage build:
1. **frontend-build:** Build React app with hardcoded env vars
2. **backend-build:** Install backend dependencies
3. **Production:** Combine frontend + backend, serve via Express

Frontend env vars are hardcoded in Dockerfile to avoid DigitalOcean build arg issues.

## Local Development

```bash
# Install dependencies
npm install
cd backend && npm install && cd ..

# Set up environment variables
cp .env.example .env
cp backend/.env.example backend/.env
# Edit .env files with your keys

# Run backend (port 8007)
cd backend && npm start

# Run frontend (port 3000)
npm start
```

Frontend will connect to `localhost:8007` when `REACT_APP_API_URL` is undefined.

## Production Deployment

### First-time Setup

1. Create app on DigitalOcean App Platform
2. Connect GitHub repository
3. Use App Spec from `DO_APP_SPEC_FINAL.md`
4. Configure environment variables
5. Deploy

### Updating

Push to `main` branch - auto-deploys via GitHub integration.

To manually trigger rebuild:
```bash
git commit -m "Trigger rebuild"
git push origin main
```

## Troubleshooting

### Site shows localhost:8007 errors

**Cause:** Browser cache loading old JavaScript  
**Fix:** Hard refresh (Cmd+Shift+R or Ctrl+Shift+R) or use incognito

### Build fails

Check build logs for:
- Missing dependencies
- Dockerfile syntax errors
- Environment variable issues

### Runtime errors

Check runtime logs for:
- Backend startup errors
- Database connection issues
- Missing environment variables

## Security Notes

- Supabase anon key is public (safe to commit)
- Service role key must be kept secret
- OpenAI key must be kept secret
- All API calls go through backend proxy
- Rate limiting enabled on all endpoints
- CSP headers configured for security

## Monitoring

Check health: `https://sirasasitorn.com/api/health`

Response should be:
```json
{
  "status": "healthy",
  "timestamp": "2024-10-01T12:00:00.000Z",
  "environment": "production",
  "services": {
    "database": "connected",
    "openai": "configured",
    "rag": "initialized"
  }
}
```
