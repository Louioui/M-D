# M&D Multi-Service

Cinematic, accessible, bilingual (English / Español) single-page site for M&D Multi-Service in Boyle Heights, built with React 19, strict TypeScript, Vite, Tailwind CSS 4, Three.js / React Three Fiber, GSAP ScrollTrigger + Flip, and two module Web Workers.

## Run

```sh
npm install
npm run dev
```

## Verify and build

```sh
npm test
npm run build
npm run preview
```

## Architecture

```
src/
  main.tsx, App.tsx            Root error boundary, language provider, scroll/dock/parallax loop
  copy.ts, i18n.tsx            All visitor copy in English + Spanish (typed parity, persisted choice, <html lang>)
  shop.ts                      Verified business data, LA-time hours, SMS/email/vCard handoff
  enginePath.ts, motion.ts     Camera spline + inspection anchors; shared per-frame motion input
  components/
    Navbar, Hero, ServicesSection, EngineShowcase, ProofLocation, BookingTerminal
    ThreeCanvas                WebGL2 gate, tiered DPR, demand rendering, context-loss recovery
    BadgeStage/BadgeModel      Critical-path badge; only the gear turns (worker-solved speed)
    EngineStage/EngineModel    Suspends until assets + worker analysis land; 4-light studio rig, governor
  lib/
    deviceTier.ts              Phone/tablet/desktop classification, model + atlas + DPR tiers, FOV bands
    cameraSolver.ts            Pure camera math: playhead damping, bounds fit, quaternion slerp, gear velocity
    motionClient.ts            Ping-pong Float32Array transfers to scrollWorker (main-thread fallback)
    assetLoader.ts             Streamed GLB fetch with byte progress, Draco WASM worker pool, detail worker
    meshDetail.ts              Tangents, welded dihedral curvature/cavity, tileable procedural atlas
    engineMaterials.ts         onBeforeCompile 5-zone physical shader + CAD / spec inspection modes
  workers/
    scrollWorker.ts            Camera spline, bounds fit, slerp and gear speed off the main thread
    engineDetailWorker.ts      Curvature/cavity, tangents and the detail atlas off the main thread
```

## Experience

- **Hero (0–15%)**: the supplied forged badge, dead centre, tilts with the pointer or (opt-in) gyroscope. Headline "HARD WORK. / HONEST REPAIRS." flanking the badge (ES: "TRABAJO DURO. / TRATO HONESTO."), with "Boyle Heights’ Hardest-Working Auto Shop" as the kicker line, English/Español toggle and a live America/Los_Angeles open/closed indicator. Background (garage, carbon grid, spotlight, watermark) moves at 0.25×, the foreground HUD at 1.35×, transforms only.
- **Navbar dock (15%)**: GSAP Flip moves the same live canvas into the sticky navigation. Only the independent rear gear rotates; scroll velocity (solved in `scrollWorker`) spins it like a timing-chain sprocket in either direction, then it settles back to a 1 rpm idle. Lettering, plate and wrenches stay upright.
- **Services**: click-to-select pills; the chosen service carries into the booking terminal.
- **Engine tour (400vh pinned)**: four stops framed around the customer's situation, under the heading *What do you need right now?* — *Check-engine light on?* (diagnose before replacing parts) / *Need your car for work?* (text us, ask what to expect) / *Worried about the bill?* (questions welcome, plain-words answers) / *Done with dealerships?* (family shop, all makes, 4.6★ from 90+ Google reviews). Each stop's button opens the booking terminal with the matching service selected. A projected crimson reticle and SVG leader line lock onto each engine zone with a short M&D readout. Copy on these stops invites questions rather than promising turnaround times or pricing steps the shop hasn't committed to. `[ STUDIO PBR | CAD WIREFRAME | SPEC LIGHTING ]` switches the shader live; *Tap to inspect 3D* enables drag-to-orbit (zoom disabled, so page scroll is never trapped). Desktop landscape: engine centred, cards alternate sides. Aspect ≤ 1.2: engine in the top 58%, cards in the bottom 42%.
- **Proof & location**: 4.6★ / 90+ Google reviews (owner-supplied figures) linking to Google, a route card, hours and the map. No review quotes are invented.
- **Pixel David** (`components/PixelDrive.tsx`, sprites and scenery tiles in `pixelSprites.ts`): in the booking section a chibi pixel-art David — drawn in code from his photo's look, no photo shipped — cruises a silver Mercedes-Benz-style roadster in an endless GIF-style loop. The car idles in place with spinning wheels and engine rumble while an LA skyline with palm trees, streetlights and lane paint scroll past at parallax speeds (each layer moves exactly one tile per loop, so it never jumps). Every 7 s he pops up and says “I love working with Mercedes-Benz!” (ES: “¡Me encanta trabajar con Mercedes-Benz!”). Pure CSS transform/opacity animation, no JavaScript loop; reduced motion freezes it with the bubble showing. The car carries no Mercedes logo.
- **Booking terminal**: slides up over the section above. Name, vehicle, service pill and issue feed live SMS (`sms:+13233544795?body=…`), email (`mailto:md_multiservice@yahoo.com`) and a `.vcf` contact card. Native validation blocks empty handoffs. Nothing is stored or sent by the site.

## 3D pipeline and performance

- **Tiering** (`deviceTier.ts`): width < 1024, coarse pointer, `deviceMemory ≤ 4` or Save-Data → `engine-mobile.glb` + 512px atlas, no shadows/clearcoat; otherwise `engine-studio.glb` + 2048px atlas. DPR caps: phone `[1, 1.25]`, tablet `[1, 1.5]`, desktop `[1, 2]`. Decided once, before any fetch.
- **Loading**: the badge streams first; the engine streams while the hero is on screen. Draco decodes in a WASM worker pool (`setWorkerLimit(min(cores, 4))`, `/draco/draco_wasm_wrapper.js` + `draco_decoder.wasm`). Copies of the decoded buffers go to `engineDetailWorker`; results return as Transferables. The engine canvas mounts only after that, behind an industrial progress gauge. Measured in the production build on this Mac: desktop tier 1.4–1.6 s total (download ≈0.1 s, Draco ≈0.25–0.3 s, worker ≈1.0–1.1 s for 325,619 vertices + 2048px atlas); phone tier ≈0.5 s.
- **Worker analysis**: welded dihedral-angle curvature (`aCurvature`) and cavity (`aCavity`), per-vertex tangents (Lengyel UV-gradient accumulation — the method behind `computeTangents`, not the MikkTSpace library), and a tileable RGBA atlas: sand-cast porosity (R), brushed/lathe streaks (G, sampled in polar coordinates on the flexplate), polymer stipple (B).
- **Shader** (`engineMaterials.ts`): the single-atlas material becomes a `MeshPhysicalMaterial` with smooth zone weights from albedo luminance/saturation, measured object-space bounds and worker curvature — A sand-cast aluminium (0.88 / 0.42, heat tint on the exhaust flank and head seam), B machined flexplate (0.96 / 0.22, clearcoat 0.35, radial anisotropy, cavity-darkened tooth roots), C polymer (0.04 / 0.68 + stipple), D fasteners (curvature > 0.65, 0.95 / 0.18, oiled AO ring), E chrome (1.0 / 0.08). 28% of the authored roughness variation is retained so baked wear still reads. `?zones` shows the segmentation map.
- **Lighting**: 4500K key spot with soft contact shadows, 7000K navy fill on the intake side, 5600K rim, crimson under-bay bounce at 15% of the key, plus a raking light in spec mode.
- **Governor**: 30 consecutive rendered frames over 22 ms step down to 1024px shadows and 0.75× DPR, then no shadows/micro-detail at DPR 1. Idle gaps in demand rendering never count as slow frames.
- **Resilience**: WebGL2 check; `webglcontextlost` is cancelled and a restored context remounts the Canvas on a fresh renderer (no restore in 6 s → static fallback); error boundaries around each scene and the whole app (which keeps phone/email visible).
- **Motion hygiene**: passive listeners; layout read on resize/chapter change only; per-frame work writes transforms/attributes. `100dvh` sticky stage with `svh` fallback, `ScrollTrigger.config({ ignoreMobileResize: true })`, safe-area insets on the header, hero and booking dock, 48px touch targets. Reduced motion snaps the camera between stops, freezes parallax and the gear, and disables idle oscillation.
- **First paint** ships runtime + React + GSAP (~140 KB gzip); three.js and R3F load with the lazy WebGL stages.

## Business configuration

`src/shop.ts` holds contact details and Los Angeles timezone logic. Hours confirmed by the owner in the build conversation: Mon–Fri 8:30 AM–6 PM, Sat 8 AM–4 PM, Sun closed. Holiday exceptions are not configured.

The directions link and embedded Google map point to 419 N Boyle Ave, Los Angeles, CA 90033. Phone: +1 (323) 354-4795. Email: md_multiservice@yahoo.com.

The 4.6★ rating and 90+ review count are owner-supplied (October 2026) and link to the live Google listing; update `SHOP.rating` / `SHOP.reviewCount` if they change. No testimonial text is published. Instagram: [@m_and_d__multi_service2021](https://www.instagram.com/m_and_d__multi_service2021/) (owner-confirmed), linked from the location section, the footer and the vCard. The atmospheric garage background is generated artwork, not a photograph of the actual premises. The engine is an illustrative supplied mesh, not a guarantee of any vehicle's construction or compatibility.

## Assets

Original files remain untouched one level above this project. Geometry inspection corrected the brief's filenames:

| Original | Actual content | Web asset | Original bytes | Optimized bytes |
|---|---|---|---:|---:|
| `M&D3dmodel.glb` | shallow badge | `public/models/logo.glb` | 47,994,708 | 1,455,916 |
| `EngineM&D.glb` | engine | `public/models/engine.glb` | 211,497,724 | 2,119,972 |

`npm run optimize` uses glTF Transform, meshoptimizer simplification (8% badge / 2.5% engine with 0.02 error limit), 2048px WebP textures, and Draco compression. Originals are not included in deployment. `design/asset-report.json` records measured sizes. Decoders ship locally under `public/draco/` with the Three.js distribution's license in `public/draco/LICENSE`.

`design/concept.png` is the generated visual reference. The supplied original M&D badge replaces the conceptual logo. Typography, red/black palette, industrial composition, outlined engine watermark and HUDs follow that direction. The booking form is presented in the requested slide-over vault rather than inline beside the location. The service list gives visitors a direct way to understand and request work.


## Articulated gear logo

The live badge uses `public/models/logo-articulated.glb` (approximately 1.57 MB), with sibling nodes `StationaryBadge` and `GearAssembly`. The fused original rear ring was removed around the foreground silhouette (wrench heads traced tightly — the open-end jaw outline, the box-end ring as an ellipse and its neck — with mesh borders locked during simplification, so no old gear teeth or stretched slivers remain where the wrenches cross the ring) and rebuilt as an independent, beveled twelve-tooth steel ring with machined races and twelve rivets. The original lettering, plate, wrenches and their texture coordinates are retained. The rebuilt gear has a subtly brushed steel finish rather than the original baked ring texture.

Run `npm run articulate-logo` to regenerate it from `../M&D3dmodel.glb`, or pass an alternate source: `npm run articulate-logo -- /absolute/path/to/source.glb`. The source GLB is never overwritten. `scripts/articulate-logo.mjs` contains the documented silhouette masks, geometry dimensions and material settings. The GLB also includes a standalone 60-second `Gear idle` animation clip targeting only `GearAssembly`; the website controls the same gear directly for scroll responsiveness.

`src/lib/cameraSolver.ts` controls idle speed (`IDLE_GEAR_SPEED`), the scroll speed multiplier and maximum speed; `scrollWorker` runs it. It uses time-based damping without React state updates on animation frames. Canvas sizing uses layout dimensions (`offsetSize`) so GSAP Flip transforms do not leave a clipped hero-sized drawing buffer inside the docked badge. Rendering pauses when the canvas leaves the viewport or the tab is hidden. Reduced motion resets the rig to a still front-facing pose; disabling it resumes idle motion. The original static badge remains as the WebGL fallback.


## Engine tour

`src/components/EngineShowcase.tsx` owns the sticky tour, 0.6-second scroll smoothing, labelled chapter controls, previous/next buttons, keyboard navigation (←/→/Home/End), the HUD bridge and booking links; `EngineShowcase.css` defines the desktop side-card and portrait 58/42 layouts. Copy lives in `src/copy.ts`. `src/enginePath.ts` provides the camera/target curves and the four measured inspection anchors; tests cover path continuity, clearance, inspection angle range, descent toward the lower block, and that the settled camera keeps the engine inside the frustum in every aspect band.

## Studio engine enhancement

`npm run enhance-engine` rebuilds two Draco-compressed variants from the untouched `../EngineM&D.glb`: desktop `engine-studio.glb` (411,490 triangles, 4K base-color/normal maps, 8.14 MB) and mobile `engine-mobile.glb` (197,475 triangles, 2K maps, 4.18 MB). Both use a lossless 1K packed AO/roughness/metalness map. The desktop version retains 2.61× the triangles of the previous web engine. Phones and Save Data clients choose the lighter asset before fetching; no double download. The old `engine.glb` remains available as a retained asset.

The offline pipeline casts 12 hemisphere rays per vertex, bakes crevice occlusion into the existing atlas, dilates texture gutters, and calibrates roughness/metalness from the authored atlas. Polymer stays dark and rough; aluminum has broader highlights. This material classification is inferred from existing textures, not a CAD parts map. `src/lib/engineMaterials.ts` retains the original normal maps and layers the runtime zone shader described above. A warm key, cool fill and rim light plus a once-generated local PMREM studio environment replace red reflections on the engine. No screen-space AO or other full-screen postprocessing is required. `cameraSolver.ts` fits camera-space engine bounds so portrait/short screens cannot clip the cover or lower block, and caps phone pixel density at 1.25.

The supplied engine is one mesh with one material atlas. This update improves its presentation and retained detail; it does not rebuild it into separated, dimensionally verified, watertight parts. See `design/engine-production-prompt.md` for the modeling/texturing brief and acceptance checks for that further asset-production pass, and `design/engine-studio-asset-report.json` for measured output sizes.
