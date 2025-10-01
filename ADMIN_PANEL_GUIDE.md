# 🔐 Admin Panel Guide

## Overview

Your personal website now includes a comprehensive admin panel for managing all content without touching code!

**Live URLs:**
- **Website**: http://localhost:3007
- **Admin Login**: http://localhost:3007/admin
- **Admin Dashboard**: http://localhost:3007/admin/dashboard

---

## 🎯 Features

### 1. **Notes Manager** 📝
- Create, edit, delete notes sections
- Markdown support for rich content
- Reorder sections with order_index
- Real-time preview

### 2. **Locations Manager** 📍
- Add/edit/delete map locations
- Manual coordinate input (latitude/longitude)
- Categorize locations
- Add descriptions for each pin

### 3. **Knowledge Base Manager** 🧠
- Manage RAG documents
- Auto-generate embeddings on save
- Control what AI knows about you
- Update AI responses instantly

### 4. **Analytics Dashboard** 📈
- View chat usage statistics
- Track unique users
- Monitor RAG effectiveness
- Response time metrics

---

## 🚀 Getting Started

### Step 1: Set Up Admin User

You need to create an admin user in Supabase:

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project (`personal-website`)
3. Click **Authentication** → **Users**
4. Click **Add User** → **Create new user**
5. Enter your admin email and password
6. Click **Create user**

### Step 2: Access Admin Panel

1. Open http://localhost:3007/admin
2. Login with your Supabase credentials
3. You'll be redirected to the dashboard

---

## 📋 Using the Admin Panel

### Notes Manager

**To Add a Note:**
1. Go to **Notes** tab
2. Fill in:
   - **Title**: Section name (e.g., "About me")
   - **Content**: Your content (supports Markdown)
   - **Order**: Display order (0 = first)
3. Click **Create**

**To Edit a Note:**
1. Find the note in the list
2. Click **✏️ Edit**
3. Modify fields
4. Click **Update**

**To Delete a Note:**
1. Click **🗑️ Delete**
2. Confirm deletion

---

### Locations Manager

**To Add a Location:**
1. Go to **Locations** tab
2. Fill in:
   - **Display Name**: "New York, USA"
   - **City**: "New York"
   - **Country**: "United States"
   - **Latitude**: 40.7128
   - **Longitude**: -74.0060
   - **Category** (optional): "Visited"
   - **Description** (optional): Notes about the place
3. Click **Create**

**Pro Tip:** Use https://www.latlong.net/ to find coordinates!

**To Edit/Delete:**
- Same as Notes Manager

---

### Knowledge Base Manager

This controls what the AI knows about you in the Messages app.

**To Add Knowledge:**
1. Go to **Knowledge Base** tab
2. Fill in:
   - **Title**: "Technical Skills"
   - **Category**: "Skills"
   - **Content**: Detailed information about your skills
3. Click **Create & Generate Embeddings**
4. Wait ~2-5 seconds (embeddings are being created)

**Important:**
- Content should be factual and specific
- More detailed = better AI responses
- Embeddings auto-update when you edit

**Example Knowledge Document:**

```
Title: Technical Skills
Category: Skills
Content: 
I'm proficient in:
- Data Engineering: Python, SQL, Apache Spark, Airflow
- Machine Learning: TensorFlow, PyTorch, Scikit-learn
- Cloud Platforms: AWS (S3, Lambda, Redshift), GCP
- Full-Stack: React, Node.js, PostgreSQL
```

---

### Analytics Dashboard

**Metrics Available:**
- **Total Chats**: Number of chat sessions
- **Unique Users**: Individual visitors who chatted
- **Avg Messages/Chat**: Conversation depth
- **RAG Usage**: % of responses using knowledge base

**Recent Sessions Table:**
- Date/Time of chat
- User ID (anonymized)
- Number of messages
- Whether RAG was used
- Response time

---

## 🔧 Admin API Endpoints

All admin endpoints require authentication via Bearer token.

### Authentication
```bash
# Login first to get token (done automatically in admin panel)
POST /api/admin/auth/login
```

### Notes
```bash
GET    /api/admin/notes           # List all notes
POST   /api/admin/notes           # Create note
PUT    /api/admin/notes/:id       # Update note
DELETE /api/admin/notes/:id       # Delete note
```

### Locations
```bash
GET    /api/admin/locations       # List all locations
POST   /api/admin/locations       # Create location
PUT    /api/admin/locations/:id   # Update location
DELETE /api/admin/locations/:id   # Delete location
```

### Knowledge Base
```bash
GET    /api/admin/knowledge       # List all documents
POST   /api/admin/knowledge       # Create document (+ embeddings)
PUT    /api/admin/knowledge/:id   # Update document (+ embeddings)
DELETE /api/admin/knowledge/:id   # Delete document
```

### Analytics
```bash
GET    /api/admin/analytics       # Get chat analytics
```

---

## 🎨 Customization

### Styling

The admin panel uses `AdminStyles.css`. You can customize:
- Colors: Change `#667eea` (primary color)
- Layout: Modify grid/flex properties
- Typography: Update font sizes and weights

### Adding New Sections

To add a new content type:

1. **Create Manager Component:**
   ```jsx
   // src/components/admin/NewManager.js
   function NewManager() {
     // Similar structure to NotesManager
   }
   ```

2. **Add Backend Routes:**
   ```javascript
   // backend/server.js
   app.get('/api/admin/new', verifySupabaseAuth, ...);
   app.post('/api/admin/new', verifySupabaseAuth, ...);
   ```

3. **Add Tab to Dashboard:**
   ```jsx
   // AdminDashboard.js
   <button onClick={() => setActiveTab('new')}>
     New Section
   </button>
   ```

---

## 🔒 Security

### Current Security Features:
✅ Supabase Auth for login  
✅ JWT token verification  
✅ Backend-only service role key  
✅ Row-Level Security (RLS) on database  
✅ CORS restrictions  
✅ Rate limiting  

### Best Practices:
- **Never share admin credentials**
- **Use strong passwords** (12+ characters)
- **Don't expose service role key** in frontend
- **Review analytics regularly** for unusual activity

---

## 🐛 Troubleshooting

### "Unauthorized" Error
**Problem**: Can't access admin routes  
**Solution**:
1. Verify you're logged in
2. Check Supabase user exists
3. Clear browser cache and re-login

### "CMS service not available"
**Problem**: Supabase not connected  
**Solution**:
1. Check `.env` has correct Supabase credentials
2. Restart Docker: `docker-compose restart app`
3. Verify in logs: `docker-compose logs app`

### Changes Don't Appear
**Problem**: Saved data doesn't show on website  
**Solution**:
1. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+F5)
2. Check network tab for API errors
3. Verify data saved in Supabase dashboard

### Slow Embedding Generation
**Problem**: Knowledge base saves take 5+ seconds  
**Solution**:
- Normal for OpenAI API calls
- Increase timeout if needed
- Consider batching multiple documents

---

## 📊 Database Schema

### notes_sections
```sql
id: uuid (primary key)
title: text
content: text
order_index: integer
created_at: timestamp
updated_at: timestamp
```

### map_locations
```sql
id: uuid (primary key)
name: text
city: text
country: text
latitude: float
longitude: float
description: text
category: text
is_active: boolean
created_at: timestamp
updated_at: timestamp
```

### knowledge_base
```sql
id: uuid (primary key)
title: text
content: text
category: text
embedding: vector(1536)  # OpenAI ada-002
metadata: jsonb
is_active: boolean
created_at: timestamp
updated_at: timestamp
```

### chat_analytics
```sql
id: uuid (primary key)
client_id: text
messages: jsonb
rag_used: boolean
response_time: integer
tokens_used: integer
created_at: timestamp
```

---

## 🚀 Next Steps

### Recommended Enhancements:

1. **File Upload**
   - Add image upload for notes
   - Store in Supabase Storage
   - Display in NotesApp

2. **Bulk Operations**
   - Import CSV for locations
   - Export analytics to CSV
   - Batch delete functionality

3. **Advanced Analytics**
   - Most asked questions
   - User engagement graphs
   - A/B testing different responses

4. **Multi-User Support**
   - Role-based access (admin, editor, viewer)
   - Activity logs per user
   - Team collaboration features

5. **Content Scheduling**
   - Schedule note publishing
   - Auto-hide expired content
   - Draft system

---

## 📖 Quick Reference

| Feature | URL | Purpose |
|---------|-----|---------|
| Website | `/` | Public 3D camping scene |
| MacOS Desktop | `/pro` | Interactive desktop experience |
| Admin Login | `/admin` | Login page |
| Admin Dashboard | `/admin/dashboard` | Content management |
| Public API | `/api/*` | Frontend data fetching |
| Admin API | `/api/admin/*` | Protected admin operations |

---

## 🎉 Success Checklist

Your admin panel is ready when you can:

- [x] Login at `/admin`
- [x] Create a new note and see it on website
- [x] Add a location and see pin on map
- [x] Update knowledge base and get better AI responses
- [x] View analytics showing chat usage
- [x] Edit and delete content without errors

---

## 💡 Pro Tips

1. **Organize Knowledge Base by Category**
   - Skills
   - Experience
   - Projects
   - Education

2. **Use Order Index Strategically**
   - 0, 10, 20, 30... (leaves room for insertions)

3. **Write for RAG**
   - Be specific with facts
   - Include context
   - Use clear language

4. **Monitor Analytics**
   - Check weekly for trends
   - Identify common questions
   - Improve knowledge base based on queries

---

## 🆘 Need Help?

Check these resources:
- **Supabase Docs**: https://supabase.com/docs
- **React Router**: https://reactrouter.com
- **OpenAI API**: https://platform.openai.com/docs

Or review:
- `backend/server.js` - All API routes
- `src/components/admin/` - Frontend components
- `FRONTEND_INTEGRATION_COMPLETE.md` - Setup guide

---

**Admin Panel Status**: ✅ **LIVE and READY!**

Happy content managing! 🚀
