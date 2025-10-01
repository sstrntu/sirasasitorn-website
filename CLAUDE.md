# Claude Instructions

## 🔄 Project Awareness & Context
- **Always read `PLANNING.md`** at the start of a new conversation to understand the project's architecture, goals, and constraints.
- **Check `TASK.md`** before starting a new task. If the task isn't listed, add it with a brief description and today's date.
- **Use consistent naming conventions, file structure, and architecture patterns** as described in `PLANNING.md`.

## Project Overview
Full-stack personal website/portfolio built with:
- **Frontend**: React.js with Three.js for 3D rendering
- **Backend**: Node.js/Express for secure API proxy
- **Future**: Python services for RAG training, real-time data streaming
- **Database**: Supabase (when data persistence is needed)
- **Deployment**: Docker containerization

## Project Structure
```
personal-website/
├── src/                    # React frontend
│   ├── components/         # React components
│   ├── data/              # Static data
│   └── services/          # API and security services
├── backend/               # Node.js Express backend
├── public/                # Static assets
├── PLANNING.md            # Architecture documentation
├── TASK.md                # Task tracking
└── CLAUDE.md              # This file
```

## Tech Stack Guidelines

### Frontend (React)
- Use functional components with hooks
- Keep components under 800 lines
- Use ES6+ features (arrow functions, async/await, destructuring)
- **Never expose API keys or secrets in frontend code**
- **Never connect directly to Supabase from frontend**

### Backend (Node.js/Express)
- All third-party API calls go through backend
- Implement security: rate limiting, CORS, Helmet, input validation
- Use environment variables for all secrets
- Implement proper error handling and logging
- Backend-as-proxy pattern for Supabase operations

### Future Python Services
- Use FastAPI for APIs
- Follow PEP 8 and use type hints
- Use Supabase client for database operations
- Deploy in Docker containers

### Database (Supabase)
- **Use Supabase for all data persistence needs**
- Implement Row-Level Security (RLS) policies
- Use Supabase auth when user authentication is needed
- **Database access patterns:**
  - ❌ Never connect to Supabase from **public** frontend features
  - ✅ OK for **authenticated admin panels** (using anon key + RLS policies)
  - ✅ Backend uses service role key for privileged operations

## Coding Conventions

- **Frontend**: camelCase for variables/functions, PascalCase for components
- **Backend**: camelCase for variables/functions, PascalCase for classes
- **File organization**: One component per file, separate data and services
- **Environment variables**: Use `.env` files, never commit secrets
- **Comments**: Comment non-obvious logic, use JSDoc for complex functions
- **Imports**: ES6 modules for frontend, CommonJS for Node.js backend

## Security Rules

1. **Never expose API keys in frontend code** (except REACT_APP_ env vars)
2. **Supabase connections:**
   - ❌ Never from public frontend features
   - ✅ OK for admin panels (with anon key + RLS + authentication)
   - ✅ Backend uses service role key for privileged operations
3. **Always validate and sanitize user input**
4. **Implement rate limiting on APIs**
5. **Use environment variables for all secrets**
6. **Backend-as-proxy pattern for third-party services (OpenAI, etc.)**

## Development Workflow

1. Check `PLANNING.md` and `TASK.md` before starting work
2. Write code following the tech stack guidelines
3. Test features locally before committing
4. Update `TASK.md` when tasks are completed
5. Never delete code unless explicitly asked or part of documented task

## Testing
- Write tests for critical business logic
- Frontend: Jest and React Testing Library
- Backend: Jest or Mocha
- Mock external dependencies in tests

## Large Files & Git
- Add large files (>50MB) to `.gitignore`
- Use Git LFS for large assets that need version control
- Store media assets in cloud storage when possible
- Document where large files are stored

## Docker Usage
- Use Docker for production deployment
- Local development can be done with or without Docker
- Multi-stage builds for optimized images

## AI Behavior Rules
- Never assume missing context - ask questions if uncertain
- Never hallucinate libraries or functions
- Always confirm file paths exist before referencing
- Never delete or overwrite code unless explicitly instructed
- Follow existing code patterns and architecture