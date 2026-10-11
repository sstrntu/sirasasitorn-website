# Task Tracking

## Current Tasks

### In Progress
_No tasks currently in progress_

### Planned
_No tasks currently planned_

## Completed Tasks

### 2026-10-11 - Home Scene: Realistic Art Pass (target: docs/concepts/realistic-b.png)
- ✅ Concept renders generated with Higgsfield (`docs/concepts/realistic-a.png`, `realistic-b.png`); user chose realistic-b
- ✅ Karst towers and sea stacks are now realistic bare-rock models (Higgsfield image-to-3D / Tripo), optimized with `scripts/optimize-glb.py` (Blender) into `public/jungle/models/` (~3.9 MB total)
  - Waterfalls fitted to the rock faces by raycasting; vegetation scattered on ledges/tops by sampling the rock surface
  - Boulders (beach and camp) reuse the sea-stack scan
- ✅ Realistic foliage from Higgsfield alpha textures (`public/jungle/foliage/`): leaf-card clumps for canopies/bushes, frond cards for palms, ferns and banana plants (`utils/foliageCards.js`)
- ✅ Photo ground textures (`public/jungle/ground/`): grass + sand blended by shore/wetness, soil cross-section on the block's sides (pebbles removed)
- ✅ Natural colors on trunks and camp props, smooth clouds, softer waterfall foam, smaller flowers
- Home page assets now ~7.1 MB; source renders and raw models kept in `docs/concepts/`
- ✅ World spread out 1.6x around the camp (`WORLD_SCALE` in sceneConfig): bigger block, karsts/stream/beach/sea further away, more trees; camera and shadows adjusted
- ✅ Waterfall paths kept clear of trees, bushes and ledge greenery (`isInWaterfallPath`)
- ✅ Tent is now a realistic ultralight backpacking tent 3D model (Higgsfield image-to-3D, `public/jungle/models/tent.glb`, ~0.7 MB) with a floor, sleeping pad, mummy bag and pillow inside; Helinox-style table and chair; ocean depth shown on the block's cut-away sides
- ✅ Performance pass (2026-10-11): boulders use a 900-face model (`boulder.glb`) instead of the 12k-face scan; shadows redraw every other frame; adaptive resolution (drei PerformanceMonitor); mobile tier with 60% small-plant counts, no ambient occlusion, no campfire shadows, lower pixel density. Triangles per frame ~2.6M → ~0.3–0.56M, draw calls ~520 → ~180–290
- ✅ Mobile tested (iPhone 13 emulation, 4x CPU throttle): 60 fps, drag-to-orbit, pinch-zoom and tap-the-laptop → /pro all work; hints say "Tap"/"pinch" on touch screens
- ✅ Heat fix: frame governor (frameloop="demand"): max 60 fps while interacting/flying, 30 fps idle, paused in hidden tabs (was the display's full rate, 120 Hz on ProMotion); desktop DPR cap 1.5; beach coconuts no longer roll into the sea and keep physics awake (forced a redraw every frame)
- [ ] Test on a real iPhone (Safari) and a mid-range Android before launch (Priority: High)
- ✅ Leaf clumps rebuilt as a ball of outward-facing cards (no visible "X" from above)

### 2026-10-11 - Home Scene: Krabi "Mini World" Diorama
- ✅ The world is now a floating diorama block (`jungle/Island.js`): grassy top, sandy beach into a clear turquoise sea with caustics, cut-away sides showing soil layers and pebbles, translucent sea walls, soft shadow on the backdrop
- ✅ Krabi limestone karst towers (`jungle/Karsts.js`): craggy cliffs with orange/black streaks, jungle spilling from rounded tops, sea stacks in the water; waterfall down the main tower into a pool and a stream to the sea
- ✅ Krabi flora (`jungle/Trees.js`): coconut palms leaning over the beach, rain trees, dense jungle around the karsts, banana plants; tropical flowers
- ✅ Tent rebuilt as a solid A-frame (inner tent, rainfly, A-poles, door flap, guy lines)
- ✅ Studio backdrop gradient follows the time of day (stars and moon at night) instead of sky dome + fog; god rays removed
- ✅ Camera: opens on the whole block, holds, then flies in to the camp shot; scroll zooms toward the laptop (or back out to the whole block); portrait screens back off to fit; near plane adapts to zoom
- ✅ Removed `Ground.js`, `Mountain.js`, `Landscape.js`, `utils/heightFog.js`
- ✅ Longtail boat replaced by a sit-on-top kayak pulled up on the beach (`jungle/Kayak.js`, `KAYAK` in sceneConfig)
- ✅ Art pass to match the user's reference image (bright low-poly diorama):
  - Blue screen-space sky gradient with floating low-poly clouds (`jungle/Clouds.js`); night keeps stars/moon with a muted grade
  - Brighter, more saturated palette; chunky round-crowned trees on brown trunks; ferns instead of dense grass
  - Taupe karsts with moss clumps and little trees; second waterfall on the back tower; foam where falls land
  - Beach and offshore boulders, rocks around the sea stacks, white foam rings in the water (`jungle/Rocks.js`)
  - Faceted crystal-like water; orange-brown soil layers with cube pebbles
- ✅ Furniture redesigned (same positions): folding table with black scissor legs and light wood top; navy folding quad camp chair with armrests and cup holder (`jungle/CampChair.js`)
- ✅ Removed the unused walnut table textures (`public/jungle/wood_table_001_*`)
- ✅ Softer, rounder shapes to match the reference: smooth-bulged crowns/bushes/rocks (`createLumpGeometry`), plain taupe karsts (no streak stripes) densely topped with trees and round moss clumps, warmer and softer daylight
- ✅ "Click to open" label hidden until the camera is within ~3 m of the laptop, then fades in
- ✅ Camp chair moved further from the table, facing out
- ✅ Foam around rocks is now a faint, soft, broken band (only rocks standing in real water), dimmer at night
- ✅ Laptop lid opens slowly in step with the intro fly-in (`openDelay`/`openDuration` on `MacBook`)
- ✅ "Jelly" sea (`utils/waves.js`): height-field wave simulation over the block; ripples spread, slow in the shallows and bounce off the shore and block sides
  - Drag across the water to stir waves, click it to plop a ripple; spinning/tilting the island tips the water (`utils/slosh.js`) into sloshing waves
  - Cut-away water sides follow the waves with a bright meniscus; coconuts and the bottle splash in and float/drift, the mug sinks; the waterfall keeps the pool rippling
- ✅ Waterfall motion: curtain sways, fast falling streaks and sparkles, ragged edges; droplets, foam and ripple rings where it lands

### 2026-10-11 - Jungle Scene: Back to Stylized (Cartoon) Art, Uncharted-style Composition
- ✅ Replaced all photoscanned models with code-built low-poly versions (flat-shaded rocks, blob-crown trees, palms, bushes, log bench, stump + axe, crate, lantern, fire stones/logs)
- ✅ Ground is painted (no textures): soft grass patches + worn dirt patch around camp; light grass tufts and flowers
- ✅ Much sparser vegetation: a few framing trees and palms, light forest belt, mountain view kept open
- ✅ Mountain restyled: faceted low-poly geometry, flat rock strata, hard-edged green, banded toon lighting (shape and waterfall kept)
- ✅ Removed scanned-asset pipeline (`scripts/jungle-assets.mjs`, `assets.js`, `Impostors.js`), its dev dependencies and all models/extra textures (home assets now ~2.2 MB)

### 2026-10-11 - Jungle Scene: Open Meadow + Hero Mountain (Uncharted 4-inspired art direction)
- ✅ Flat grassy forest meadow (CC0 grass ground, anti-tiling shader, dense grass tufts) instead of dense jungle
- ✅ Hero mountain (`jungle/Mountain.js`): generated terraced massif, triplanar CC0 rock, jungle on ledges, aerial haze, waterfall ribbon down its face
- ✅ Land falls away beyond the meadow toward the mountain (overlook), painted ridges moved behind it
- ✅ Treeline frames the meadow: a few scanned edge trees + impostor forest/bush belt, view to the mountain kept open
- ✅ Soft drifting clouds in the sky; brighter, more saturated palette and grade
- ✅ Removed falling leaves (compute), overhanging canopy trees, lianas, palms
- ✅ Removed unused assets (leaf-litter textures, rock face, shrub, mountainside); home page assets ~15 MB

### 2026-10-11 - Jungle Scene: Realistic Art Pass (Photoscanned Assets, Cinematic Lighting)
- ✅ Asset pipeline `scripts/jungle-assets.mjs`: downloads CC0 Poly Haven scans, simplifies (meshoptimizer, incl. twig pruning), WebP textures, meshopt compression -> `public/jungle/models/*.glb`
- ✅ Runtime asset registry + instancing helpers (`jungle/assets.js`): variant sets, instanced parts, wind on scanned foliage
- ✅ Camp: scanned oil lantern (grabbable), mossy-rock fire ring, scanned firewood, fallen-log seat, stump with axe, crate, boulders; tent gets a nylon weave material
- ✅ Jungle: scanned canopy trees with buttress roots and lianas; scanned fern/calathea/anthurium/pachira understory; grass pushed out of the foreground
- ✅ Distant forest: tree impostors rendered from the scanned tree at load time (`jungle/Impostors.js`) for the jungle wall and valley canopy
- ✅ Lighting/atmosphere: N8AO ambient occlusion, god rays from sun/moon, height fog (`utils/heightFog.js`), filmic grading + grain
- ✅ Waterfall cliff dressed with scanned rock faces
- ✅ Single quality tier (phones get the same scene; only pixel density capped)
- ✅ Home page assets ~16 MB total (budget 15–25 MB)

### 2026-10-10 - Jungle Scene: Debug Mode, Laptop-Centered Camera, Waterfall
- ✅ `?debug` debug panel: time-of-day slider, presets, fast-forward day cycle, back to device time, FPS readout (`jungle/DebugPanel.js`)
- ✅ Default view and orbit/zoom pivot centered on the laptop (`LAPTOP_FOCUS` in sceneConfig); scroll zoom heads into the laptop
- ✅ Waterfall pouring off a mossy cliff across the valley, with animated water shader, foam and mist, lit by time of day (`jungle/Waterfall.js`)
- ✅ "Click to open" label now a fixed screen size (no longer balloons when zoomed in)

### 2026-10-10 - Jungle Scene: Time of Day, Landscape Vista, Matte Table
- ✅ Scene follows the visitor's local clock (`jungle/timeOfDay.js`): night (moon, stars, fireflies), dawn, golden hour, day, dusk, blended smoothly and refreshed every minute
- ✅ `?time=HH:MM` URL override for previewing any time of day
- ✅ Camera pulled back and leveled; valley vista with jungle canopy and three hazy mountain ridge layers (`jungle/Landscape.js`)
- ✅ Trees/bushes kept out of the vista; terrain falls away into the valley
- ✅ Camp table changed to matte wood (no roughness map, reduced reflections)

### 2026-10-10 - Home Page Rebuild: Code-Built Jungle Camp Scene
- ✅ Replaced the `.glb`-based home scene with a dusk jungle camp built entirely in code (`src/components/jungle/`)
- ✅ Procedural dome backpacking tent (wind-rippled fabric, poles, guy lines), folding camp table, MacBook with opening lid
- ✅ Jungle: palms, buttressed canopy trees, lianas, ferns, broad-leaf plants, grass, bushes, distant fog-softened tree line
- ✅ Campfire with shader flames, embers, smoke and flickering shadow-casting light; fireflies; dusk sky dome + fog
- ✅ Physics (Rapier): falling leaves that settle on tent/table/ground; draggable/flickable mug, bottle, lantern, coconuts
- ✅ Shared wind system drives foliage shaders and leaf physics together
- ✅ Camera choreography: intro glide over the canopy, limited orbit, curved flight into the laptop screen -> seamless fade to `/pro`
- ✅ Small CC0 Poly Haven textures + HDRI in `public/jungle/` (~3.5MB); desktop/mobile quality tiers; bloom/tone mapping on desktop
- ✅ Loader, hint UI, "Enter desktop" button + Enter key, reduced-motion support, WebGL fallback/error boundary
- ✅ Code-split the scene (main bundle 1.35MB -> 154KB gzip)

### 2025-11-10 - Resume Update (Latest)
- ✅ Updated Resume.pdf with latest 2025 version (76KB, Nov 9)
- ✅ Replaced previous version (74KB, Nov 4)

### 2025-11-04 - Resume Update, Meta Tags & Analytics
- ✅ Updated Resume.pdf with 2025 version (74KB)
- ✅ Backed up old resume as Resume-old-backup.pdf
- ✅ Updated .gitignore to exclude resume backups

### 2025-11-04 - Social Media Meta Tags & Analytics
- ✅ Updated meta description with personal welcome message
- ✅ Added Open Graph meta tags (Facebook, LinkedIn)
- ✅ Added Twitter Card meta tags with image dimensions
- ✅ Updated OG image to use background1.png (Mac Desktop background)
- ✅ Updated image dimensions to 1920x1080 for proper preview
- ✅ Simplified title to "Sira Sasitorn"
- ✅ Added Google Analytics tracking (G-B8WVWBM978)
- ✅ Created analytics utility service (src/services/analytics.js)
- ✅ Implemented AnalyticsTracker component for route change tracking
- ✅ Tracks all page navigation: /, /pro, /admin, /admin/dashboard
- ✅ Fixed CSP headers to allow Google Analytics (script-src and connect-src)

### 2024-10-01 - Production Deployment & Code Cleanup
- ✅ Fixed DigitalOcean App Platform deployment issues
- ✅ Resolved API URL configuration (empty string for same-origin requests)
- ✅ Fixed JavaScript handling of empty REACT_APP_API_URL
- ✅ Code cleanup: Removed 2,188 lines of duplicate/obsolete files
- ✅ Consolidated deployment documentation into DEPLOYMENT.md
- ✅ Removed debug console.log statements
- ✅ Simplified docker-compose.yml and Dockerfile
- ✅ Temporarily disabled AI chat with hardcoded under-development message
- ✅ Created compliance report (COMPLIANCE_REPORT.md)

### 2025-01-30 - Code Cleanup & Documentation
- ✅ Reviewed entire codebase structure
- ✅ Removed duplicate files (Resume.pdf from root, website-build.zip)
- ✅ Removed empty src/assets directory
- ✅ Removed unused fallbackToDirectAPI method from secureOpenAI.js
- ✅ Updated CLAUDE.md to reflect full-stack architecture
- ✅ Created PLANNING.md with comprehensive project documentation
- ✅ Created TASK.md for task tracking

### Previous Completions
- ✅ 3D camping scene with Three.js/React Three Fiber
- ✅ macOS-style desktop interface
- ✅ Terminal resume viewer with interactive commands
- ✅ AI-powered Messages app with OpenAI integration
- ✅ Interactive Maps app with Leaflet
- ✅ PDF resume viewer
- ✅ Notes app
- ✅ Draggable windows system
- ✅ Secure backend API proxy for OpenAI
- ✅ Rate limiting and security measures
- ✅ Mobile-responsive design with fullscreen modes
- ✅ Docker deployment configuration
- ✅ Security documentation (SECURITY.md)

## Future Enhancements

### Backend Enhancement
- [ ] Python FastAPI services for RAG training
- [ ] Real-time data streaming with WebSockets
- [ ] Supabase database integration
- [ ] Visitor analytics tracking
- [ ] Chat history storage (with user permission)

### Features
- [ ] Blog functionality
- [ ] Project case studies with rich media
- [ ] Advanced animations and transitions
- [ ] Live coding demos
- [ ] WebRTC video introduction

### Technical Improvements
- [ ] TypeScript migration
- [ ] Unit tests with Jest
- [ ] End-to-end tests with Cypress/Playwright
- [ ] Performance optimization
- [ ] SEO optimization
- [ ] Accessibility improvements (WCAG compliance)

### DevOps
- [ ] CI/CD pipeline with GitHub Actions
- [ ] Automated testing in pipeline
- [ ] Production monitoring and logging
- [ ] Error tracking (Sentry or similar)

## Discovered During Work

- [x] Mobile rendering + first-visit load time (2026-10-11)
  - Phones skip the post-processing composer (iOS NaN pixels → black bloom blobs), use native MSAA, DPR cap 2, larger shadow normal bias
  - GLBs Draco + WebP compressed (4.8 MB → 1.8 MB), HDRI 1K → 512 (1.96 MB → 0.5 MB), karst models no longer downloaded twice
  - Long-term cache headers for /static and /jungle; loader shown while the scene chunk downloads; /pro and admin routes lazy-loaded
- [ ] Add a Cloudflare cache rule for `sirasasitorn.com/jungle/*` (.glb/.hdr aren't edge-cached by default) (Priority: Medium)
- [ ] Remove the unused `public/jungle/rainforest_trail_1k.hdr` once the 512 version is approved (Priority: Low)

- [ ] Tent, chair, table, kayak and campfire are still simple code models; replace with Higgsfield image-to-3D models (~20 credits each) if they stand out (Priority: Medium)
- [ ] `docs/concepts/assets/*.glb` raw models are 20+ MB each; delete or move to Git LFS before committing (Priority: High)

- [ ] Delete unused `CampingScene3D.js` and old `public/camping*.glb` files (~180MB) once the new scene is approved (Priority: Medium)
- [ ] Replace the generic HDRI/textures with KTX2-compressed versions if load time matters on mobile (Priority: Low)
- [ ] Optional ambience: jungle/fire audio with a mute toggle (Priority: Low)
- [ ] Tent and MacBook are still code-built (no CC0 scans exist); consider modelling them in Blender (Priority: Medium)
- [ ] Test frame rate on real mid-range phones; add an adaptive-quality fallback if needed (Priority: Medium)

## Notes

### How to Use This File
1. When starting a new task, move it from "Planned" to "In Progress"
2. When completing a task, move it to "Completed Tasks" with the date
3. Add new tasks to "Planned" or "Future Enhancements"
4. Use "Discovered During Work" for tasks found while implementing other features

### Task Format
```
- [ ] Task description (Priority: High/Medium/Low)
  - Additional context or requirements
  - Estimated time: X hours/days
```