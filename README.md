# M&D Multi-Service

Cinematic, accessible single-page automotive site built with React 19, TypeScript, Vite, Tailwind CSS 4, Three.js / React Three Fiber, and GSAP ScrollTrigger + Flip.

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

## Experience

- Actual supplied 3D badge, mouse tilt and opt-in device orientation; GSAP Flip docks the same live canvas into the navigation at 15% total document scroll. Rotation follows scroll velocity and settles when scrolling stops.
- Engine scene is loaded near the tour. A 500vh section keeps its 100vh stage sticky for 400vh of camera travel. Four chapter buttons also provide direct navigation.
- The background watermark moves at 0.25x; the foreground HUD cards use an additional 0.35x offset for 1.35x apparent travel and alternate sides. Motion updates use GSAP's frame ticker and a single RAF-batched scroll/resize path. React state changes only on chapter changes, never every frame.
- WebGL uses demand rendering, capped pixel density, local Draco decoders, and no external HDR downloads. No claim is made that all hardware or network conditions achieve 60fps or instantaneous loading.
- Live `prefers-reduced-motion` support disables orbit, pointer tilt, parallax, smooth scrolling, and animated drawer entrance. Small screens use shallower camera offsets and compact HUDs. Form, navigation, and location remain usable without WebGL.
- Native modal dialog provides focus containment, Escape dismissal, and focus restoration. Vehicle and name inputs are validated before message generation.
- Booking generates a customer-reviewed SMS or email. The visitor sends the message in their native app. This site does not store requests, send messages, or confirm appointments automatically.

## Business configuration

`src/shop.mjs` holds contact details and Los Angeles timezone logic. Hours confirmed by the owner in the build conversation: Mon–Fri 8:30 AM–6 PM, Sat 8 AM–4 PM, Sun closed. Holiday exceptions are not configured.

The directions link and embedded Google map point to 419 N Boyle Ave, Los Angeles, CA 90033. Phone: +1 (323) 354-4795. Email: md_multiservice@yahoo.com.

No unverified testimonials or review counts are published. The atmospheric garage background is generated artwork, not a photograph of the actual premises. The engine is an illustrative supplied mesh, not a guarantee of any vehicle's construction or compatibility.

## Assets

Original files remain untouched one level above this project. Geometry inspection corrected the brief's filenames:

| Original | Actual content | Web asset | Original bytes | Optimized bytes |
|---|---|---|---:|---:|
| `M&D3dmodel.glb` | shallow badge | `public/models/logo.glb` | 47,994,708 | 1,455,916 |
| `EngineM&D.glb` | engine | `public/models/engine.glb` | 211,497,724 | 2,119,972 |

`npm run optimize` uses glTF Transform, meshoptimizer simplification (8% badge / 2.5% engine with 0.02 error limit), 2048px WebP textures, and Draco compression. Originals are not included in deployment. `design/asset-report.json` records measured sizes. Decoders ship locally under `public/draco/` with the Three.js distribution's license in `public/draco/LICENSE`.

`design/concept.png` is the generated visual reference. The supplied original M&D badge replaces the conceptual logo. Typography, red/black palette, industrial composition, outlined engine watermark and HUDs follow that direction. The booking form is presented in the requested slide-over vault rather than inline beside the location. The service list gives visitors a direct way to understand and request work.
