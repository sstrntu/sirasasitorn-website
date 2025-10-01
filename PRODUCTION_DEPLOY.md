# Production Deployment Guide for sirasasitorn.com

This guide covers deploying the full-stack application (frontend + backend + CMS) to production.

## Pre-Deployment Checklist

- [x] Database setup (Supabase configured)
- [x] API keys secured in environment variables
- [x] CORS configured for production domain
- [x] CSP configured for production domain
- [x] Docker configuration updated
- [ ] Server ready (VPS/Cloud VM)
- [ ] Domain DNS configured
- [ ] SSL certificate ready (Let's Encrypt)

## Architecture Overview

**Deployment Strategy:** Single Docker container serving both frontend and backend on port 3007

- **Frontend:** React SPA (built statically)
- **Backend:** Express.js API
- **Database:** Supabase (hosted)
- **Domain:** https://sirasasitorn.com
- **Features:**
  - Notes CMS
  - Maps CMS
  - Knowledge Base CMS
  - Admin Dashboard
  - RAG-powered AI Chat

## Step 1: Prepare Your Server

### Server Requirements
- Ubuntu 20.04+ or similar Linux distribution
- 2GB+ RAM
- Docker and Docker Compose installed
- Ports 80, 443, and 3007 open

### Install Docker (if not already installed)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose -y

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker-compose --version
```

## Step 2: Configure DNS

Point your domain to your server's IP address:

### DNS Records
```
A     sirasasitorn.com          -> YOUR_SERVER_IP
A     www.sirasasitorn.com      -> YOUR_SERVER_IP
```

Wait for DNS propagation (can take up to 48 hours, usually 5-15 minutes).

Verify:
```bash
dig sirasasitorn.com
```

## Step 3: Clone Repository on Server

```bash
# SSH into your server
ssh user@your-server-ip

# Clone repository
git clone https://github.com/yourusername/personal-website.git
cd personal-website

# Verify files
ls -la
```

## Step 4: Configure Environment Variables

### Create Production .env File

```bash
# Copy example
cp .env.example .env

# Edit with production values
nano .env
```

Add/update these values:

```bash
# Backend Environment Variables
SUPABASE_URL=https://epclbvqatdyhybukzsme.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# OpenAI
OPENAI_API_KEY=your_openai_api_key_here

# Frontend Environment Variables
REACT_APP_SUPABASE_URL=https://epclbvqatdyhybukzsme.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key_here

# Production API URL - EMPTY for same-origin
REACT_APP_API_URL=

# Production CORS origins
ALLOWED_ORIGINS=https://sirasasitorn.com,https://www.sirasasitorn.com
```

**IMPORTANT:** For production, `REACT_APP_API_URL` should be **empty** so the frontend uses same-origin requests.

## Step 5: Build and Deploy with Docker

```bash
# Build the Docker image
docker-compose build --no-cache

# Start the container
docker-compose up -d

# Check logs
docker-compose logs -f
```

You should see:
```
✅ Supabase client initialized successfully
✅ RAG service initialized
Secure API server running on port 3007
```

Verify the app is running:
```bash
curl http://localhost:3007/api/health
```

## Step 6: Set Up Nginx Reverse Proxy with SSL

### Install Nginx and Certbot

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

### Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/sirasasitorn.com
```

Add this configuration:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name sirasasitorn.com www.sirasasitorn.com;
    
    # Allow Let's Encrypt challenges
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redirect all other requests to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS Configuration
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name sirasasitorn.com www.sirasasitorn.com;

    # SSL certificates (will be added by Certbot)
    ssl_certificate /etc/letsencrypt/live/sirasasitorn.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sirasasitorn.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Proxy to Docker container
    location / {
        proxy_pass http://localhost:3007;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Cache bypass
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3007;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Enable the Site

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/sirasasitorn.com /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Obtain SSL Certificate

```bash
# Get certificate from Let's Encrypt
sudo certbot --nginx -d sirasasitorn.com -d www.sirasasitorn.com

# Follow the prompts:
# - Enter your email
# - Agree to terms
# - Choose redirect option (2)

# Test auto-renewal
sudo certbot renew --dry-run
```

## Step 7: Test Production Deployment

### Test Frontend
Open https://sirasasitorn.com in your browser

**Check:**
- [x] Homepage loads
- [x] 3D scene renders
- [x] Notes app loads data from database
- [x] Maps app loads locations from database
- [x] Navigation works

### Test Backend API

```bash
# Health check
curl https://sirasasitorn.com/api/health

# Get notes
curl https://sirasasitorn.com/api/notes

# Get locations
curl https://sirasasitorn.com/api/locations
```

### Test Admin Panel

1. Go to https://sirasasitorn.com/admin
2. Login with your Supabase credentials
3. Test Notes CMS - create/edit/delete
4. Test Maps CMS - create/edit/delete
5. Verify changes appear on main site

### Test CORS

```bash
curl -H "Origin: https://sirasasitorn.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://sirasasitorn.com/api/chat
```

Should return CORS headers allowing the origin.

## Step 8: Monitoring & Maintenance

### View Logs

```bash
# Docker logs
docker-compose logs -f

# Follow specific service
docker-compose logs -f app

# Last 100 lines
docker-compose logs --tail=100
```

### Check Container Status

```bash
docker-compose ps
```

### Restart Container

```bash
docker-compose restart
```

### Update Deployment

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check logs
docker-compose logs -f
```

## Step 9: Set Up Automatic Updates (Optional)

### Create Update Script

```bash
nano ~/update-website.sh
```

Add:
```bash
#!/bin/bash
cd /path/to/personal-website
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
echo "Deployment updated: $(date)" >> deployment.log
```

Make executable:
```bash
chmod +x ~/update-website.sh
```

### Set Up GitHub Webhook (Optional)

For automatic deployment on git push, set up a webhook listener or use a tool like Watchtower.

## Troubleshooting

### Issue: "Connection Refused" to API

**Cause:** Docker container not running or wrong port

**Fix:**
```bash
docker-compose ps
docker-compose logs app
docker-compose restart
```

### Issue: CORS Errors

**Cause:** Domain not in ALLOWED_ORIGINS

**Fix:**
```bash
# Update .env
nano .env
# Add: ALLOWED_ORIGINS=https://sirasasitorn.com,https://www.sirasasitorn.com

# Restart
docker-compose restart
```

### Issue: SSL Certificate Error

**Cause:** Certificate not properly installed

**Fix:**
```bash
# Re-run certbot
sudo certbot --nginx -d sirasasitorn.com -d www.sirasasitorn.com
sudo systemctl reload nginx
```

### Issue: Database Connection Failed

**Cause:** Supabase credentials incorrect

**Fix:**
```bash
# Verify credentials in .env
nano .env
# Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

# Restart container
docker-compose restart
```

### Issue: Admin Login Not Working

**Cause:** Supabase Auth not configured

**Fix:**
1. Go to Supabase Dashboard → Authentication
2. Enable Email provider
3. Add site URL: https://sirasasitorn.com
4. Create admin user in Supabase

## Performance Optimization

### Enable Gzip Compression in Nginx

Add to nginx config inside `server` block:
```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;
```

### Set Up CloudFlare (Optional)

1. Point DNS to CloudFlare
2. Enable proxy (orange cloud)
3. Set SSL/TLS to "Full (strict)"
4. Enable Auto Minify (JS, CSS, HTML)
5. Enable Brotli compression

## Security Checklist

- [x] HTTPS enabled with valid SSL certificate
- [x] CORS restricted to production domain
- [x] CSP headers configured
- [x] API keys in environment variables (not in code)
- [x] Rate limiting enabled
- [x] Helmet security headers enabled
- [x] Firewall configured (allow 80, 443, 22 only)
- [ ] Set up fail2ban for SSH protection
- [ ] Regular backups configured
- [ ] Monitor logs for suspicious activity

## Support

For issues or questions:
1. Check Docker logs: `docker-compose logs -f`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Verify environment variables are set correctly
4. Test API health endpoint: `curl http://localhost:3007/api/health`

## Cost Estimate

**Monthly costs:**
- Server (DigitalOcean/Linode/Vultr): $5-10/month (Basic Droplet)
- Domain (sirasasitorn.com): $10-15/year
- SSL Certificate: Free (Let's Encrypt)
- Supabase: Free tier (up to 500MB database)
- OpenAI API: Pay-as-you-go (typically $1-5/month for personal use)

**Total: ~$6-11/month**
