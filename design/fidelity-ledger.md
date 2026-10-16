# Concept-to-browser verification

Compared `design/concept.png` using view_image against fixed-size Playwright screenshots of the actual browser render. Initial exploration also used the Codex in-app browser. Its viewport height changed during capture, so exact-size visual and interaction verification used Playwright Chromium.

| Point inspected | Concept evidence | Actual render and resolution |
|---|---|---|
| Hero composition | Large condensed white headline on either side of centered steel badge | Corrected unintended desktop wrapping with compressed single-line title spans; centered the supplied original badge |
| Typography | Narrow industrial display with understated navigation and mono utilities | Barlow Condensed, Barlow, IBM Plex Mono; desktop and mobile heading/control text inspected |
| Palette | Carbon black, neutral silver, restrained safety red | #111111 canvas, #ed2429 actions, fine structural rules, restrained red engine rim light |
| Media treatment | Atmospheric garage, floating metal badge, engine over outlined watermark | Real GLBs and generated garage background; original models replace concept's illustrative asset geometry |
| Callout anatomy | One readable glass HUD and red leader line | High-contrast glass HUD, numbered chapter, part label, title, explanation and service line; alternates left/right on desktop |
| Mobile composition | Responsive continuation required | Mobile-specific title scale and camera offsets; corrected badge crop; compact HUD and chapter strip; no document horizontal overflow at 390px |
| Location/booking | Oversized GOOD PEOPLE / GREAT WORK and coherent form primitives | Location, hours and map use open composition; form lives in requested modal vault; native text/mail handoff verified |
| Copy | Nav labels, headline, CTA, address and family identity | Preserved. Added only requested opening status, tilt permission control and functional scroll cue in hero; no fake reviews or ratings |
| Motion | Dimensional mechanical transitions and scroll tour | Forward/reverse docking, four tour stops, camera changes and reduced-motion resting transform verified |

Material fixes: desktop headline wrapping, mobile badge crop, docking time progression during slow rendering, decoded triangle budget, request preview scrolling. Browser console contained no application errors in the final complete interaction pass. Live gyro permissions and SMS/email app dispatch require a real mobile device with those native handlers; protocol targets and encoded content were verified without sending messages.

This follows the generated reference's visual system faithfully, with the intentional content/asset/form-placement differences recorded in `design-system.md`. No claim is made that the conceptual raster and the real supplied 3D geometry are pixel-identical.
