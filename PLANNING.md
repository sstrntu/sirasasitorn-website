# Project Planning & Architecture

## Project Name
**Personal Portfolio Website** - Interactive 3D camping scene transitioning to macOS-style desktop interface

## Vision & Goals
Create an immersive, interactive personal portfolio that showcases skills and projects through:
1. 3D camping scene entry point (using Three.js)
2. macOS-inspired desktop interface with draggable windows
3. AI-powered chat assistant for visitor interaction
4. Interactive maps showing work/travel locations
5. Terminal-style resume viewer

## Tech Stack

### Frontend
- **React 18** - UI framework
- **React Router** - Navigation
- **Three.js + React Three Fiber** - 3D rendering
- **Leaflet + React Leaflet** - Interactive maps
- **CSS3** - Styling (no framework, custom CSS)

### Backend
- **Node.js + Express** - API server
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing
- **Express Rate Limit** - API rate limiting
- **OpenAI API** - AI chat functionality (via secure backend proxy)

### Future Enhancements
- **Python + FastAPI** - RAG training and real-time data streaming services
- **Supabase** - Database for dynamic content, analytics, visitor interactions
- **WebSockets** - Real-time features

### DevOps
- **Docker** - Containerization
- **Netlify/Vercel** - Frontend hosting (or full-stack Docker deployment)
- **GitHub Actions** - CI/CD pipeline

## Architecture

### Current Architecture
```
┌─────────────────┐
│   Browser       │
│  (React App)    │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐
│  Express API    │
│   (Backend)     │
└────────┬────────┘
         │
         ▼
  ┌──────────────┐
  │  OpenAI API  │
  └──────────────┘
```

### Future Architecture
```
┌─────────────────┐
│   Browser       │
│  (React App)    │
└────────┬────────┘
         │
         ├──HTTP──►┌──────────────────┐
         │         │  Express API     │──►  OpenAI API
         │         │  (Node.js)       │
         │         └──────────────────┘
         │
         ├─WebSocket─►┌──────────────┐
         │            │  FastAPI     │──►  Supabase
         │            │  (Python)    │──►  RAG Engine
         │            └──────────────┘
         │
         └──HTTP──►┌──────────────────┐
                   │    Supabase      │
                   │   (via backend)  │
                   └──────────────────┘
```

## Key Features

### 1. 3D Camping Scene (Entry Point)
- **Component**: `CampingScene3D.js`
- Loads 3D camping model from `/public/camping.glb`
- Animated camera transitions
- Click interaction to enter desktop mode
- Responsive for mobile and desktop

### 2. macOS Desktop Interface
- **Component**: `MacDesktop.js`
- Draggable, resizable windows
- Dock with app icons
- Multiple apps: Terminal, Messages, Maps, Notes, PDF Viewer
- Mobile-responsive with fullscreen mode for apps

### 3. Terminal Resume
- **Component**: `TerminalResume.js`
- Interactive terminal-style resume viewer
- Commands: `about`, `experience`, `education`, `skills`, `projects`, `contact`
- Data sourced from `/src/data/` files

### 4. AI Chat (Messages App)
- **Component**: `MessagesApp.js`
- AI-powered chat assistant
- **Security**: Backend proxy pattern to hide API keys
- Rate limiting and abuse prevention
- Client fingerprinting for security

### 5. Interactive Maps
- **Component**: `MapsApp.js`
- Shows work/travel locations
- Uses OpenStreetMap tiles
- Markers with project/location details

### 6. PDF Resume Viewer
- **Component**: `PDFViewer.js`
- Displays Resume.pdf
- Download functionality

## Security Architecture

### Frontend Security (`src/services/apiSecurity.js`)
- Client fingerprinting
- Rate limiting (frontend layer)
- Input validation and sanitization
- Suspicious activity tracking

### Backend Security (`backend/server.js`)
- API key protection (never exposed to frontend)
- Rate limiting (server layer)
- CORS restrictions
- Helmet security headers
- Request validation
- Content filtering
- Payload size limits

See `SECURITY.md` for detailed security implementation.

## Data Architecture

### Static Data (Current)
Located in `/src/data/`:
- `about.js` - Personal introduction
- `education.js` - Education history
- `experience.js` - Work experience
- `languages.js` - Programming languages
- `locations.js` - Work/travel locations for map
- `personal.js` - Personal details
- `projects.js` - Project showcase
- `skills.js` - Technical skills

### Future: Dynamic Data (Supabase)
Tables to implement:
- `visitors` - Track visitor analytics
- `chat_history` - Store chat interactions (with permission)
- `projects` - Dynamic project management
- `blog_posts` - Future blog feature
- `analytics` - Custom analytics data

## File Organization

```
src/
├── components/          # React components
│   ├── CampingScene3D.js
│   ├── MacDesktop.js
│   ├── MacDock.js
│   ├── DraggableWindow.js
│   ├── DraggableDesktopIcon.js
│   ├── MessagesApp.js
│   ├── TerminalResume.js
│   ├── MapsApp.js
│   ├── NotesApp.js
│   ├── PDFViewer.js
│   ├── SceneManager.js
│   └── *.css              # Component styles
├── data/                 # Static data files
├── services/            # Frontend services
│   ├── apiSecurity.js   # Security utilities
│   ├── secureOpenAI.js  # OpenAI API wrapper
│   └── geocoding.js     # Location services
├── App.js               # Main router
└── index.js             # Entry point

backend/
├── server.js            # Express server
├── package.json
└── .env.example

public/
├── camping.glb          # 3D model (45MB)
├── Resume.pdf
├── icons/               # App icons
└── index.html
```

## Responsive Design Strategy

### Desktop (>768px)
- Full 3D camping scene experience
- Draggable, resizable windows
- Multi-window multitasking
- Messages app auto-opens on desktop view

### Mobile (≤768px)
- 3D camping scene with touch controls
- Fullscreen app windows
- Simplified window management
- Keyboard-aware layouts
- Optimized viewport handling

## Performance Considerations

1. **3D Model Optimization**
   - `.glb` format for efficient loading
   - Lazy loading with Suspense
   - Loading indicators during model fetch

2. **Code Splitting**
   - React Router lazy loading (future)
   - Dynamic imports for heavy components

3. **Asset Optimization**
   - Compressed images
   - Optimized 3D models
   - Lazy loading for maps

## Development Roadmap

### Phase 1: Current (Completed)
- ✅ 3D camping scene
- ✅ macOS desktop interface
- ✅ All core apps (Terminal, Messages, Maps, Notes, PDF)
- ✅ Secure backend API proxy
- ✅ Mobile responsiveness
- ✅ Docker deployment

### Phase 2: Backend Enhancement (Future)
- [ ] Python FastAPI services
- [ ] RAG training for improved AI responses
- [ ] Real-time data streaming
- [ ] Supabase integration
- [ ] User analytics

### Phase 3: Advanced Features (Future)
- [ ] Blog functionality
- [ ] Project case studies with rich media
- [ ] Live coding demos
- [ ] WebRTC video introduction
- [ ] Advanced animations and transitions

## Deployment Strategy

### Current: Docker Deployment
- Multi-stage build (frontend → backend → production)
- Frontend builds to static files
- Backend serves API + static files
- Single container deployment

### Alternative: Separate Deployment
- Frontend: Netlify/Vercel
- Backend API: Railway/Render/DigitalOcean
- Future Python services: Separate container

## Environment Configuration

### Development
- Frontend dev server: `localhost:3000`
- Backend dev server: `localhost:8007`
- Separate processes for hot-reload

### Production
- Single server on port 3007
- Backend serves both API and static frontend
- Environment variables for configuration

## Constraints & Decisions

1. **No CSS Framework**: Custom CSS for full control and lightweight bundle
2. **Backend Proxy Pattern**: Security-first approach, never expose API keys
3. **No TypeScript (yet)**: JavaScript for faster initial development, TypeScript future enhancement
4. **Supabase Over Custom DB**: Use managed service for faster development and built-in features
5. **Docker Optional Locally**: Allow local development without Docker for faster iteration

## Testing Strategy

### Current
- Manual testing of all features
- Cross-browser testing (Chrome, Safari, Firefox)
- Mobile device testing (iOS and Android)

### Future
- Jest unit tests for critical functions
- React Testing Library for component tests
- End-to-end tests with Cypress/Playwright
- API integration tests

## Contributing Guidelines

When adding new features:
1. Follow existing code patterns
2. Update `TASK.md` with new tasks
3. Maintain security best practices
4. Test on mobile and desktop
5. Update this PLANNING.md if architecture changes

## Questions & Decisions Log

**Q: Why not use a UI library like Material-UI or Chakra?**
A: Custom CSS provides full creative control for the unique macOS-inspired design and keeps bundle size minimal.

**Q: Why separate backend instead of serverless functions?**
A: Need stateful rate limiting and more complex security logic. Can migrate to serverless later if needed.

**Q: Why .glb instead of other 3D formats?**
A: GLB is the binary version of GLTF, optimized for web with smaller file sizes and faster loading.