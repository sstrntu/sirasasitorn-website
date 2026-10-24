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
- **Three.js + React Three Fiber + drei** - 3D rendering (scene built in code, no model files)
- **@react-three/rapier** - Physics (pokeable props)
- **@react-three/postprocessing** - Bloom / tone mapping / vignette (desktop tier)
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

### 1. 3D Jungle Camp Scene (Entry Point)
- **Entry**: `SceneManager.js` lazy-loads `jungle/JungleScene.js`
- Stylized (low-poly, cartoon) "mini world" diorama of a Krabi-style island camp, built entirely in code: one component per prop in `src/components/jungle/`
- **All layout, colors, camera shots and quality tiers live in `jungle/sceneConfig.js`**
- Rapier physics: draggable/flickable props (`PokeableProps.js`)
- Shared wind (`utils/wind.js`) drives foliage sway; its clock also animates the water
- `CameraRig.js`: intro orbit -> overview of the block (orbit/zoom around the laptop) -> curved flight into the MacBook screen; coming back from the desktop (`fromDesktop` route state) the scene opens on the screen instead and pulls back out along the same path
- The laptop screen shows the desktop wallpaper, so the final fade into `/pro` is seamless
- `timeOfDay.js`: backdrop, sun/moon, lights and fireflies follow the visitor's local time (`?time=HH:MM` to preview)
- `?debug` shows a time-of-day debug panel (`DebugPanel.js`)
- Camera orbits/zooms around the laptop (`LAPTOP_FOCUS` in `sceneConfig.js`)
- `utils/waves.js`: interactive wave simulation (stir/plop/tip/splash) read by the water shaders and floating props
- `Island.js`: the diorama block (terrain, beach, sea, stream, cut-away soil sides) and terrain helpers for placing plants (`ISLAND`, `STREAM` in `sceneConfig.js`)
- `Karsts.js`: limestone karst towers (scanned-style GLB rocks in `public/jungle/models/`, placed from `KARSTS` in `sceneConfig.js`) + raycast-fitted waterfalls; `Waterfall.js` is the animated ribbon
- Asset pipeline: Higgsfield image-to-3D for rocks, Higgsfield alpha textures for foliage/ground, `scripts/optimize-glb.py` (Blender CLI) to normalize, weld, decimate and compress GLBs (welding first keeps the decimated meshes watertight)
- `Trees.js` / `Foliage.js`: palms, rain trees, jungle, banana plants, shrubs, ferns, grass, flowers; `Kayak.js`, `Rocks.js` (boulders + foam rings), `Clouds.js`
- `Atmosphere.js`: time-of-day screen-space sky gradient (stars/moon at night), lights, HDRI reflections (`EnvironmentMap` pre-filters the small HDR as soon as it arrives, in its own Suspense boundary, while the models download)
- Loading: nothing is drawn until the scene has loaded and `utils/precompile.js` has compiled every shader in parallel (KHR_parallel_shader_compile) and uploaded the textures behind the loading screen; three r153 would otherwise compile them one by one on the first frame (a multi-second freeze on a first visit). Materials that only differ in uniforms should share a program: keep values like wind amplitude/frequency out of the shader source and `customProgramCacheKey`
- Models use the Draco decoder served from `public/jungle/draco/` (`ASSETS.draco`); every `useGLTF` call must pass it
- CC0 textures/HDRI from Poly Haven in `public/jungle/`
- Post-processing (`Effects.js`): N8AO, bloom, AgX tone mapping (`utils/toneMapping.js`; phones use the same curve via the renderer), grading; look knobs in `GRADE` (sceneConfig.js)

### 2. macOS Desktop Interface
- **Component**: `MacDesktop.js`
- Draggable, resizable windows
- Dock with app icons
- Multiple apps: Terminal, Messages, Maps, Notes, PDF Viewer
- Mobile-responsive with fullscreen mode for apps
- Zoom out on the wallpaper (scroll down / pinch in, `useZoomOutGesture.js`) or "Back to Campsite" to return to the 3D camp

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
│   ├── jungle/            # Home page 3D scene (see sceneConfig.js)
│   │   ├── JungleScene.js # Canvas, physics world, UI overlay
│   │   ├── sceneConfig.js # Layout, colors, camera, quality tiers
│   │   ├── timeOfDay.js   # Local-time-driven sky/lighting keyframes
│   │   ├── CameraRig.js, Atmosphere.js, Island.js, Karsts.js, Waterfall.js, DebugPanel.js,
│   │   │   CampProps.js, Kayak.js, Rocks.js, Clouds.js, Tent.js, CampTable.js, CampChair.js,
│   │   │   MacBook.js, Campfire.js, Trees.js, Foliage.js,
│   │   │   PokeableProps.js, Fireflies.js, Effects.js, SceneErrorBoundary.js
│   │   └── utils/         # geometry builders, wind shader patch
│   ├── MacDesktop.js
│   ├── useZoomOutGesture.js # Zoom out of the desktop -> back to the scene
│   ├── useArrivalFlag.js  # One-time route-state flags (fromDesktop / fromScene), cleared so a refresh doesn't replay transitions
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
├── jungle/              # CC0 textures, HDRI, laptop screen image (~3.5MB)
├── camping*.glb         # Legacy 3D models (unused, pending removal)
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

4. **Home Scene First Visit** (measured with a fresh Chrome profile, cold shader cache)
   - Shaders are compiled in parallel behind the loading screen, not on the first frame (`utils/precompile.js`)
   - Scene assets ~2.9 MB (WebP textures, Draco GLBs, 32 KB HDR), self-hosted Draco decoder, 17 KB favicon
   - Phone on 4G (4x CPU throttle): ~5.6 s to the scene; desktop broadband: ~0.7 s
   - Biggest remaining costs: the 1 MB scene script (over half is Rapier's embedded WebAssembly) and building the procedural geometry on mount

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

**Q: Why build the 3D scene in code instead of a .glb model?**
A: (2026-10) The old 45MB .glb could only be changed in Blender and had a hard-coded mesh ID for the laptop. A code-built scene is versionable, tweakable from `sceneConfig.js`, supports physics and interactivity per object, and loads ~3.5MB of textures instead of a large model.