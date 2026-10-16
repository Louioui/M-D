# Engine tour redesign

Reference: `engine-tour-concept.png`. This section replaces the original outlined watermark/HUD layout; the hero and other section layouts retain their existing system.

## Design and content contract

- Plain headlines: FIND THE FIX. / ALL MAKES. / HONEST WORK. / FAMILY SHOP.
- Fully visible solid #f2f0eb heading on #0e0e0e, in a dedicated track above the engine. No cut-off lettering or decorative outline as the main message.
- Separate desktop story column and engine stage; mobile uses stacked title, engine, compact story and labeled chapters. Body copy remains on solid dark backgrounds.
- Existing Barlow Condensed / Barlow / IBM Plex Mono system, safety red #ed2429 and fine steel-colored rules.
- Four labeled chapter buttons with actual per-chapter scroll progress, accessible previous/next actions, keyboard arrows/Home/End, and clear booking links.
- Native 3D concentric turntable rings, depth ticks and focus marker; no simulated diagnostic values or invented statistics.
- Continuous orbit and look-at curves, smooth scroll-to-camera mapping, subtle pointer lean and studio lighting. Reduced motion freezes the camera and transforms while retaining all text and navigation.
- Original supplied engine geometry and material maps retained. The image concept's illustrative engine is not substituted for the real model.
- Hero copy and navigation unchanged; service labels and booking option use plain language as requested.

## Verification ledger

Compare the concept to fixed-size browser screenshots with `view_image`: solid fully visible headline; safe text/model layout; type hierarchy and body contrast; carbon/red palette; turntable and focus marker; labeled chapter controls; mobile adaptation. The actual supplied mesh differs from the conceptual engine, and compact two-column phone story copy is intentional to keep controls visible on short screens.

The model's ornamental ground rings may extend to the lower edge of the stage at low camera angles. All customer-facing words and controls remain in their own layout regions.

## Final QA result

- Concept and latest desktop/mobile renders inspected with view_image. Checked headline visibility, copy/model separation, typography, carbon/red palette, native 3D stage, chapter navigation and compact phone layout.
- Production build verified in Playwright Chromium at 1440×900, 1024×768, 390×844, 350×700 and 390×600. The in-app browser was used first; fixed-size checks use Playwright because the app panel's viewport height changes during capture. Composite desktop/mobile concept views are compared separately rather than treating the reference board as a single runnable viewport.
- Every chapter's complete headline, story and footer controls fit the viewport. No document horizontal overflow and no engine/text overlap. Chapter buttons, previous/next, booking and live reduced-motion switching verified. Camera positions differ across all four views.
- Six automated tests passed, including full-orbit continuity/clearance, chapter boundaries, mobile camera validity, logo rig isolation, shop hours and request encoding.
- No application errors in the final complete production-browser run. The initial loading-portal lifecycle error was fixed with a React-owned loading overlay outside the canvas.
- Hero/nav/first-viewport copy unchanged. Requested plain-language service labels and engine/booking copy are intentional updates.
- Intentional differences: uploaded engine geometry and material maps replace the conceptual engine render; mobile story copy uses a compact two-column layout to fit shorter phones; native ground rings run to the stage edge at lower orbit angles.
