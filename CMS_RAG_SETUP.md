# CMS + RAG Setup Guide

This guide will help you set up the Supabase backend for the CMS and RAG features.

## Prerequisites

- Supabase account (free tier works fine)
- OpenAI API key (already configured)
- Node.js and npm installed

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in:
   - **Name**: personal-website (or any name you prefer)
   - **Database Password**: Choose a strong password
   - **Region**: Choose closest to your users
4. Click "Create new project" and wait ~2 minutes for setup

## Step 2: Get Supabase Credentials

1. In your Supabase project dashboard, click **Settings** (gear icon) → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)
   - **service_role key** (starts with `eyJ...`)

## Step 3: Run Database Setup SQL

1. In Supabase dashboard, click **SQL Editor** (left sidebar)
2. Click **New query**
3. Copy the entire contents of `backend/scripts/supabase-setup.sql`
4. Paste it into the SQL editor
5. Click **Run** (or press Cmd/Ctrl + Enter)
6. You should see: "✅ Supabase setup complete! Tables and functions created successfully."

## Step 4: Configure Environment Variables

Update your `.env` file with the Supabase credentials:

```env
# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Frontend (add these)
REACT_APP_SUPABASE_URL=https://xxxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key

# Features (optional)
ENABLE_CHAT_ANALYTICS=true
ENABLE_RAG=true
```

## Step 5: Create Admin User

1. In Supabase dashboard, click **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Enter:
   - **Email**: your-email@example.com
   - **Password**: Choose a strong password
   - Check **Auto Confirm User**
4. Click **Create user**

## Step 6: Test Backend API

Start the backend server:

```bash
cd backend
npm start
```

Test the health endpoint:

```bash
curl http://localhost:8007/api/health
```

You should see:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "suspiciousClients": 0
}
```

## Step 7: Test Public API Routes

Test notes endpoint (should return empty array initially):
```bash
curl http://localhost:8007/api/notes
```

Test locations endpoint (should return empty array initially):
```bash
curl http://localhost:8007/api/locations
```

## Step 8: Populate Initial Data (Optional)

You can manually add data through Supabase dashboard or create a migration script.

### Option A: Manual Entry via Supabase Dashboard

1. Go to **Table Editor** in Supabase
2. Click on `notes_sections` table
3. Click **Insert row** and fill in:
   - section_key: `about`
   - title: `About me`
   - description: Your about text
   - skills_header: `I can do...`
   - skills_items: `["Skill 1", "Skill 2", "Skill 3"]`
   - order_index: `0`

Repeat for `cv` section.

### Option B: Use Migration Script (Coming Soon)

We'll create a migration script that reads from your existing data files and populates Supabase automatically.

## Step 9: Verify RAG Setup

The RAG service requires:
1. ✅ OpenAI API key (already configured)
2. ✅ Supabase with pgvector extension (done in Step 3)
3. ✅ Knowledge base table (done in Step 3)

Check RAG status in backend logs when starting:
```
✅ Supabase client initialized successfully
✅ RAG service initialized
```

## Step 10: Test Admin Routes

Get an access token by logging in:

```bash
# This will be done through the admin UI (coming next)
# For now, you can get a token from Supabase dashboard:
# Authentication → Users → Click your user → Copy "Access Token"
```

Test admin route with token:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  http://localhost:8007/api/admin/knowledge
```

## Troubleshooting

### "Supabase credentials not configured"
- Check that `.env` file exists in project root
- Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set correctly
- Restart backend server after changing .env

### "RAG service not enabled"
- Check that OPENAI_API_KEY is set in `.env`
- Check that ENABLE_RAG is not set to `false`
- Restart backend server

### "Failed to fetch from database"
- Verify you ran the SQL setup script in Supabase
- Check RLS policies are enabled (they should allow public read)
- Check Supabase project is active (not paused)

### "401 Unauthorized" on admin routes
- Verify you're using the correct access token
- Token expires after 1 hour - get a new one
- Make sure user email is confirmed in Supabase

## Next Steps

1. ✅ Backend CMS API is ready
2. ⏳ Create frontend admin panel
3. ⏳ Update NotesApp to fetch from API
4. ⏳ Update MapsApp to fetch from API
5. ⏳ Populate knowledge base for RAG

## Architecture Overview

```
Frontend Apps (React)
    ↓ HTTP requests
Backend API (Express)
    ↓ Authenticated requests
Supabase Database
    ├── notes_sections
    ├── map_locations
    ├── knowledge_base (with pgvector)
    └── chat_analytics

RAG Service (LangChain + OpenAI)
    ↓ Vector embeddings
    ↓ Semantic search
Knowledge Base → Enhanced AI Responses
```

## Security Notes

- ✅ **service_role key**: Only used in backend (never exposed to frontend)
- ✅ **anon key**: Safe to use in frontend (RLS policies protect data)
- ✅ **RLS enabled**: Public can read, only authenticated admins can write
- ✅ **Admin routes**: Protected with JWT token verification
- ✅ **Chat analytics**: Anonymous (no personal data collected)

## Useful Supabase Dashboard Links

- **SQL Editor**: For running queries and viewing data
- **Table Editor**: For manually editing data
- **Authentication**: For managing admin users
- **API Docs**: Auto-generated API documentation
- **Logs**: View real-time database logs and errors

## Support

If you encounter issues:
1. Check backend console logs for error messages
2. Check Supabase logs in dashboard (Logs → All logs)
3. Verify environment variables are correctly set
4. Try restarting the backend server

---

**Status**: ✅ Backend CMS + RAG API Complete
**Next**: Frontend admin panel and integration
