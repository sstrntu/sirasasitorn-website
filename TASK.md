# Task Tracking

## Current Tasks

### In Progress
_No tasks currently in progress_

### Planned
_No tasks currently planned_

## Completed Tasks

### 2026-10-23 - Home Scene: Faster First Visit (new devices)
- ✅ No more first-frame freeze: every shader is compiled up front, in parallel, while the loading screen is up (`utils/precompile.js`); the canvas starts drawing once they're ready. three r153 compiled them one by one on the first frame (53 programs, ~2.6–5 s on an M4 Pro with a cold shader cache, longer on phones)
- ✅ HDR environment pre-filtered as soon as its 32 KB file arrives (`EnvironmentMap` in Atmosphere.js) instead of on the first frame (its blur shader alone took ~300 ms to compile)
- ✅ Leaf materials that only differed in wind amplitude/frequency now share shader programs (uniforms instead of baked-in numbers): 53 → 44 programs on desktop, 31 on phones
- ✅ Smaller downloads (5.9 MB → 3.9 MB per first visit): favicon 1 MB → 17 KB, HDR 484 KB → 32 KB (128x64 is plenty for soft lighting), ground textures re-encoded (−428 KB, no visible change), karst normal/roughness maps 1024 → 512 (−219 KB), Draco decoder served from our own domain (`public/jungle/draco/`, no extra connection to gstatic)
- Measured on a fresh Chrome profile with a cold shader cache: desktop ready 5.9 s → 0.7 s (no long tasks over ~200 ms); phone on 4G with a 4x slower CPU 10.3 s → 5.6 s
- ✅ Desktop applied AgX tone mapping twice (materials into the composer's buffer, then the AgX effect again), so highlights looked flatter than on phones: the renderer skips tone mapping when the composer is on (fixed 2026-10-24 with the lighting pass)
- [ ] Further phone gains: load Rapier (~half of the 1 MB scene script) after the first frame, and build the procedural geometry before the models finish downloading (Priority: Low)

### 2026-10-23 - Zoom Out of the Desktop Back Into the World
- ✅ On /pro, scrolling down or pinching in on the wallpaper (trackpad, touch, Safari gestures; not inside windows) fades the windows, icons and dock away as you go (`useZoomOutGesture.js`); past halfway it carries on, stopping early springs back
- ✅ The home scene then opens on the laptop screen, its wallpaper framed exactly like the desktop's, under a full-page wallpaper overlay that fades once the scene has drawn; the camera holds, then pulls back out along the dive path to the camp view (`CAMERA.exit` in sceneConfig)
- ✅ "Back to Campsite" uses the same transition; reduced motion skips the pull-back; the overlay never sticks if WebGL fails
- ✅ Refreshing the page afterwards plays the normal intro again (browsers keep route state across a reload, so the arrival flags are cleared once read: `useArrivalFlag.js`; same for the desktop's fade-in after diving in)
- [ ] Try the pinch-out on a real iPhone and Android phone (Priority: Medium)

### 2026-10-23 - Home Scene: Softer Colors, No Flickering Edges
- ✅ Calmer, less saturated look: AgX tone mapping instead of ACES (`utils/toneMapping.js`, same curve on desktop and phones), neutral grade, gentler bloom; lawn, soil and leaf photo textures toned down; soft aqua/teal water; sage grass tufts and soft flower colors. All knobs in `GRADE` (sceneConfig.js)
- ✅ Rock, boulder and tent models were full of hairline cracks (decimated without welding UV seams), so grass and sky flickered through them: `scripts/optimize-glb.py` now welds before decimating; all five models re-exported watertight
- ✅ Water: removed the faceted "crystal" surface and the tight sun glints that flashed as the camera turned; softer shoreline foam and side meniscus
- ✅ Leaf cards: anti-aliased cut-outs (alpha-to-coverage) instead of hard alpha-test edges; leaf clumps keep their rounded lighting on both sides (were flipping dark/light as the view moved); matting specks removed from the frond/leaf textures
- ✅ Canvas is opaque (own WebGL context), and AgX survives R3F reconfigures (it resets to ACES otherwise)
- Measured with a sub-pixel camera nudge (animation frozen): pixels that jump sharply per step dropped ~3-5x (hero view 3,053 → 1,000; sea 3,673 → 1,181; overview 877 → 171)
- [ ] The laptop screen also goes through AgX, so at the end of the dive it looks slightly flatter than the real wallpaper before the 0.45 s fade; add an inverse curve on the screen if the handoff feels off (Priority: Low)

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

- [x] Smoother scene → desktop transition + playful props (2026-10-12)
  - Scroll/pinch within 2 m of the laptop dives the camera into the screen (scrubbable, reversible, settles if left half-way)
  - Route change runs as a transition (no blank fallback), desktop icons fade in over the matching wallpaper; wallpaper is WebP (3.2 MB → 28 KB)
  - Tap the lantern to switch it on/off; fireflies swarm it while it's carried. Tap the campfire to stoke it (flare, sparks, light surge)
- [ ] Test pinch-to-dive and lantern carrying on a real phone (Priority: Medium)

- [x] Pixar-style Sira character living on the island (2026-10-23)
  - Higgsfield CLI: Nano Banana Pro cartoon portrait from photos → Tripo H3.1 image-to-3D; skeleton + hand-made skin weights in Blender
  - `public/jungle/models/sira.glb` (235 KB, skinned, Draco + WebP); `Likeness.js` + `utils/siraPose.js` (joint angles about the body's own axes, walk cycle, planted feet), `utils/siraPath.js` (routes around camp props, trees and karsts), `utils/siraActivities.js`
  - Simulation: picks activities and walks/wades/swims/paddles between them: tends the fire (pokes add fuel; relights a dead fire with the flint), sits on the log, works at the laptop ("Open it" bubble → /pro), stretches at the view, shakes coconuts off palms (real coconuts drop), swims in the sea, takes the kayak out
  - Tap = wave (every 3rd tap points at the laptop), thrown props = flinch, visitor discoveries = cheer; his own palm shakes / relights don't count as the visitor's discoveries
  - Rides a smoothed water level with ripples behind him (no bobbing on his own wake); the paddle runs through both palms
  - Re-rigged with measured joints (`scripts/rig-sira.py`): the wrist had sat mid-palm; head rigid from below the jawline (the chin used to shear when his head turned)
  - Arms are anatomical (`siraPose.js`): upper-arm direction + rotation in the chest's frame, hinge-only elbows, forearm turn and wrist, so every blend is a pose a real arm can make; relaxed arms by his sides instead of the model's A-pose
  - Fixed head look turning the wrong way (away from the cursor/camera/laptop)
- [x] Sira's day follows the visitor's clock, he builds and puts out the fire, better proportions, touch-friendly props (2026-10-24)
  - `utils/siraDay.js`: asleep in the tent 23:00–6:30 (a night visit finds him in bed and the fire out), a nap in the camp chair after lunch, no swimming or kayaking after dark, sunset views
  - Builds the fire: armful of wood from the new woodpile by the stump, lays it, strikes the flint in bursts until it catches, blows on it (morning, evening, or after a visitor douses it). Bedtime: fills his bucket (`Bucket.js`) at the water's edge, pours it over the fire, puts it back, sleeps
  - Three taps wake him in the night: he gets up, lights the fire and sits on the log with the visitor (laptop hint), then goes back to bed; tapping a nap wakes him
  - Proportions: legs lengthened 1.45× and leg joints moved to the middle of the legs (`scripts/rig-sira.py`); kneels at the laptop and on one knee at the fire instead of a half squat; hands placed with a two-bone reach (`siraPose.js`); hips pinned at measured heights for kneeling, sitting and lying
  - Touch: a held prop floats 80 px above the fingertip (press-and-hold picks it up), with a ring around it and its shadow below; bigger hit areas for small props on touch screens; no iOS callout on long press
  - Kneels in front of the laptop (to its left) facing the screen, and gets up and steps aside when the camera flies into it; hidden whenever the camera passes right by him
  - The kayak is a sit-in kayak with a cockpit: he sits low with his legs under the deck (feet no longer show)
  - Wave: hand up beside his head with the upper arm forward and out, half the arm twist that wrung the sleeve into the shirt
- [x] Security review of /pro and the API, with fixes (2026-10-24)
  - Admin API requires the `admin` role in the Supabase account's app_metadata (a self-signed-up account isn't enough); RLS policies limited to it; no public insert into chat analytics; refused admins are signed out
  - Home address and phone removed from the Terminal résumé
  - Server packages: 30 vulnerabilities (3 critical) -> 0 (unused LangChain removed, Express 4.22, OpenAI 6); Docker on Node 22 (18 is end of life)
  - Rate limits and abuse tracking by the visitor's real IP (DigitalOcean/Cloudflare headers) instead of a client-chosen ID; tracking capped in size and time
  - CSP: no inline or eval'd scripts (`wasm-unsafe-eval` for the scene's WebAssembly), Google Analytics moved to `public/analytics.js` (and its first page view no longer counted twice), localhost sources only in development
  - Chat filter blocks injection attempts, not everyday words ("key skills"); standard JSON parsing; no public metrics endpoint; a stray rejected promise no longer stops the server
  - Removed the unused camping scene and models (~90 MB), `Dockerfile.simple`, three stale reports and the frontend's unused `openai` package
  - The 3D scene retries once in a lighter safe mode if it crashes, and the fallback names the error (also sent to Google Analytics as an exception)
  - Conversion events (apps, projects, contact links, chat, entering the desktop, Sira's laptop hint); per-page titles and descriptions, sitemap.xml, robots.txt, Person structured data
- [ ] Needs Sira: encrypt OPENAI_API_KEY and SUPABASE_SERVICE_ROLE_KEY in the DigitalOcean app spec and rotate both; drop the localhost entries and the stray `%` from ALLOWED_ORIGINS (Priority: High)
- [ ] Needs Sira: both Supabase projects are gone (the admin panel and CMS are offline; Notes/Maps use built-in content): recreate one (run `backend/scripts/supabase-setup.sql`, grant the admin role, turn off sign-ups, update the Dockerfile's hard-coded project) or remove the CMS (Priority: Medium)
- [ ] Needs Sira: `public/Resume.pdf` still shows the home street address and phone number (Priority: Medium)
- [ ] Ideas from the review: finish the AI chat or replace it with a contact form, case studies for the projects, a cookie consent choice for Google Analytics, a plain accessible résumé view (Priority: Low)
- [ ] Watch a full cycle on a real GPU (headless testing was ~5 fps) and on a phone; tune speeds/durations in `siraActivities.js` (Priority: Medium)
- [x] Home scene lit and textured like a pre-rendered diorama, after jesse-zhou.com's ramen shop (2026-10-24)
  - Baked sky occlusion on every device (`utils/groundOcclusion.js`): the static scene is rendered top-down once at load into height maps, and a horizon-style pass bakes how much sky each ground point sees (island-wide map + a finer one over the camp). All lit materials read it by world position, so trunks, rocks, the tent, props and Sira's feet darken where they meet the ground and grass under trees sits in shade. Phones get it too (they skip the screen-space AO)
  - Soft sun and moon shadows (`utils/softShadows.js`): sharp at contact, blurring with distance from the caster (PCSS); the sample pattern is tied to the shadow map, so edges don't crawl when the camera moves (measured with a sub-pixel camera nudge: only object edges change)
  - Light rebalanced (`timeOfDay.js`): strong warm sun against a cooler sky light; the green rainforest HDRI turned down (it tinted every shadow green); the low sun lights from at least ~13° so the golden hour glows; warm sunset sky light; brighter, broader campfire pool with a calm flicker (no per-frame jitter)
  - Desktop tone mapping fixed (was applied twice); a shared calm grade in the AgX curve (`GRADE.toneSaturation`, `GRADE.exposure` 1.1) keeps saturation and brightness close to the approved look on both phones and desktop
  - Painted lawn instead of the photo grass (three soft greens, `COLORS.lawn*`); grass and sand detail only fades in near the camera; leaf cards pulled toward their average color and darker inside each clump; scanned karsts and boulders read from a blurrier mip with shallower bumps (`utils/softenScan.js`)
- [x] The island keeps Bangkok time (UTC+7, where Sira lives) instead of the visitor's clock: lighting, sun and moon, the fire and Sira's routine; the `?debug` panel says "Bangkok time" (2026-10-24)
- [x] Blank white 3D view on a friend's Android phone (Chrome) fixed (2026-10-24): the scene had loaded (overlays, Sira's Zzz) but the browser took the WebGL context back and the canvas stayed blank (Android paints it white with a sad-face icon; reproduced with WEBGL_lose_context)
  - The scene now starts over in a fresh context: same settings once the page is visible again if the context was lost in the background, safe mode if it was lost on screen, the fallback (with the reason) if it keeps happening (`SceneManager.js`, `ContextLossWatcher` in JungleScene)
  - Each loss is reported to Google Analytics as an exception with the GPU, memory, drawing size and how long the scene ran
  - Phones reporting 4 GB or less (`navigator.deviceMemory`, Chrome) render at up to 1.5x instead of 2x with a 1024 shadow map; phones bake the ground occlusion with coarser sampling, safe mode skips the camp's finer map
- [ ] Ask the friend to try again after the deploy; check GA for "WebGL context lost" reports to see which GPUs hit it (Priority: High)
- [x] Sira's chair nap and tent sleep look natural (2026-10-24); his model's proportions are unchanged
  - The low Chair Zero-style chair was too small for his build: his feet dangled and he sat perched upright above it, the backrest stopping at his lower back. It's now a low, wide beach chair with a tall backrest leaning back ~30° (`CampChair.js`, `CHAIR_SEAT`)
  - Nap: slouched into it with the pelvis tipped back and the back gently rounded (not arched) along the backrest, head rolled to one side, legs stretched out with the heels resting on the ground (checked on the skinned mesh: lowest point 4 mm above the ground) and toes falling up and open, one hand on the belly and the other arm hanging off the side
  - Asleep in the tent he lies curled on his side, facing the middle of the tent (lying straight, his feet went through the back wall: he's 1.64 m, the floor ~1.5 m)
- [ ] Optional next step for the look: bake the camp in Blender per light source (sun/sky, moon, fire, lantern) and blend by time and fire strength, for colored bounce light like the ramen shop (Priority: Low)
- [ ] Check the soft shadow filter's cost on a mid-range phone (it uses 8 + 12 shadow-map samples there) (Priority: Medium)

- [x] Island mini-games + discoveries counter (2026-10-12)
  - Fire cycle: burns down to embers over ~2 min (tap to revive); carry the mug over it to douse it (steam, charred logs); relight a cold fire by scraping the flint across the fire stones
  - Mug refills when dropped in the sea; coconuts crack into two halves when thrown at a rock/fire stones or tapped 3 times; tapping a palm rustles it and drops a coconut (palms regrow theirs)
  - "n / 8 found" badge with a hint checklist and toasts (progress kept in localStorage); water bottle removed
  - Flames bend and tear as props move through them (tap = a quick swipe) instead of growing taller; dragged props track the pointer within a frame or two (throws capped at 9 m/s)
  - Sweeping the cursor/finger through the fire stirs it too (pressing on the fire holds the camera still); props held in or dropped on a lit fire glow, smoke, spark, catch their own flame and char (water cools them); flint doesn't burn
- [ ] Try the flint scrape and mug pour on a real phone; tune `STRIKE_SPEED` / the pour zone if they feel fiddly (Priority: Medium)

- [x] Mobile rendering + first-visit load time (2026-10-11)
  - Phones skip the post-processing composer (iOS NaN pixels → black bloom blobs), use native MSAA, DPR cap 2, larger shadow normal bias
  - GLBs Draco + WebP compressed (4.8 MB → 1.8 MB), HDRI 1K → 512 (1.96 MB → 0.5 MB), karst models no longer downloaded twice
  - Long-term cache headers for /static and /jungle; loader shown while the scene chunk downloads; /pro and admin routes lazy-loaded
- [ ] Add a Cloudflare cache rule for `sirasasitorn.com/jungle/*` (.glb/.hdr aren't edge-cached by default) (Priority: Medium)
- [ ] Remove the unused `public/jungle/rainforest_trail_1k.hdr` once the 512 version is approved (Priority: Low)

- [ ] Tent, chair, table, kayak and campfire are still simple code models; replace with Higgsfield image-to-3D models (~20 credits each) if they stand out (Priority: Medium)
- [ ] `docs/concepts/assets/*.glb` raw models are 20+ MB each; delete or move to Git LFS before committing (Priority: High)

- [x] Deleted unused `CampingScene3D.js` and old `public/camping*.glb` files (2026-10-24)
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