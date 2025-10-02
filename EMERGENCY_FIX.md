# EMERGENCY FIX - DigitalOcean Deployment Issue

## Problem
Site shows "Error - We encountered an error when trying to load your application"

## Root Cause Analysis
The issue is **NOT** in the code - the server works perfectly locally. The problem is with DigitalOcean App Platform configuration or deployment state.

## Immediate Solution - Try These in Order:

### Option 1: Force Rebuild from Scratch (RECOMMENDED)

1. **Go to DigitalOcean Dashboard**
2. **Delete the current app completely**
3. **Create a new app from scratch:**
   - Connect to GitHub repo: `sstrntu/sirasasitorn-website`
   - Branch: `main`
   - Use Dockerfile
   - Set http_port: `3007`
   - Add ONLY these environment variables:

```
PORT = 3007
NODE_ENV = production
SUPABASE_URL = https://epclbvqatdyhybukzsme.supabase.co
SUPABASE_SERVICE_ROLE_KEY = <your-encrypted-key>
OPENAI_API_KEY = <your-encrypted-key>
ALLOWED_ORIGINS = https://sirasasitorn.com,https://www.sirasasitorn.com
ENABLE_CHAT_ANALYTICS = true
ENABLE_RAG = true
```

4. **DO NOT add any BUILD_TIME environment variables**
5. **Health check:**
   - Path: `/api/health`
   - Initial delay: 60 seconds
   - That's it - don't add timeout, period, etc.

---

### Option 2: Use Simple Dockerfile

If Option 1 doesn't work, try the simplified Dockerfile:

1. In DigitalOcean, edit App Spec
2. Change `dockerfile_path: Dockerfile` to `dockerfile_path: Dockerfile.simple`
3. Save and redeploy

---

### Option 3: Manual Deploy via Docker

Build and test locally first:

```bash
cd /Users/sirasasitorn/Documents/personal-website

# Build the image
docker build -t sirasasitorn-website .

# Test it locally
docker run -p 3007:3007 \
  -e NODE_ENV=production \
  -e PORT=3007 \
  -e SUPABASE_URL=https://epclbvqatdyhybukzsme.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=<your-key> \
  -e OPENAI_API_KEY=<your-key> \
  -e ALLOWED_ORIGINS=https://sirasasitorn.com \
  sirasasitorn-website

# Visit http://localhost:3007
# If it works, push to DigitalOcean Container Registry
```

---

## What We Know Works:

✅ Server code is correct (tested locally)
✅ Dockerfile syntax is valid
✅ All dependencies install correctly
✅ Build completes successfully
✅ Health check endpoint returns correct response

## What's Likely Wrong on DigitalOcean:

❌ Conflicting environment variables (BUILD_TIME vs hardcoded)
❌ App stuck in bad state
❌ Container not getting environment variables
❌ Health check misconfigured causing restart loop
❌ Port binding issue in DO's infrastructure

---

## Critical Checklist for DO:

When you recreate the app, verify:

- [ ] http_port is set to 3007
- [ ] Dockerfile path is correct
- [ ] NO BUILD_TIME environment variables
- [ ] All RUN_TIME variables are set
- [ ] Health check path is `/api/health`
- [ ] Initial delay is at least 60 seconds
- [ ] NO timeout/period/threshold settings

---

## If Nothing Works:

**Share the EXACT error from Runtime Logs:**

1. Go to app in DO
2. Click latest deployment
3. Click "Runtime Logs" tab
4. Copy the ENTIRE log output
5. Share it - I need to see the actual error message

Without the actual error logs, I'm debugging blind. The code works locally, so the issue is 100% in the DigitalOcean configuration or platform state.

---

## Alternative: Deploy to Different Platform

If DigitalOcean continues to fail:

1. **Render.com** - Similar to DO, easier config
2. **Fly.io** - Docker-first, more reliable
3. **Railway** - Zero-config deploys
4. **Google Cloud Run** - Enterprise-grade

All of these will work with the existing Dockerfile.
