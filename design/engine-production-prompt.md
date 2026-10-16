# M&D Multi-Service — engine production brief and generation prompt

Use this brief for a new asset-production pass in Blender, a PBR authoring tool, or an image-to-3D service. It is a specification and acceptance contract, not a promise that a text prompt can force a generator to create correct mechanical geometry.

Reference image: `/Users/mac/Desktop/engine_001.png`. Retain the owner's original `EngineM&D.glb` as a protected source. The current source is a single fused reconstruction mesh; it is useful for silhouette/texture reference, but it is not a separated CAD assembly. One photograph does not establish dimensions, hidden parts, fastener specifications, wiring paths or exact engine variant. Obtain additional reference or label uncertain details for review.

## Copy-ready master prompt

Create a premium automotive studio asset for M&D Multi-Service: a recognizable Toyota A25A-FKS engine assembly based on the supplied reference image and additional verified references. Preserve its characteristic silhouette, top cover, intake runners, side housings, lower block and flexplate. The visual target is a clean, recently serviced real engine photographed in a professional studio. It must show believable engineering and varied material response, not a uniformly chrome object or an exaggerated science-fiction engine.

Work in separate passes: reference analysis and part inventory; blockout; mechanically plausible component modeling; topology cleanup; UVs; physically based texturing; high-to-low baking; level-of-detail generation; export validation; studio turntable review. Stop and flag uncertainty instead of inventing inaccessible internals or asserting dimensional accuracy. Generation output is a starting point for manual retopology and hard-surface cleanup.

### Reference, scale and assembly

- Establish meters as the export unit and confirm at least one real dimension from a drawing, measurement or authoritative part reference before applying millimeter tolerances. The supplied mesh's display-space coordinates are not verified physical dimensions.
- Maintain a component inventory with stable names: `EngineRoot`, `ValveCover`, `CylinderHead`, `Block`, `IntakeManifold`, `TimingHousing`, `OilPan`, `Flexplate`, `Harness`, `FluidLines`, `Sensors`, `Brackets`, and fastener families. Parent components under functional assembly groups. Keep static assemblies distinct from any explicitly animated part.
- Match verified OEM layout. Do not add exposed timing gears, extra cylinders, turbochargers, aftermarket carbon fiber or racing fittings simply to make the engine look complicated. If those options are requested, label them as a custom variant.
- Model a component only where references support it. Record which hidden faces are reconstructed and which dimensions are estimated. Do not describe the finished asset as OEM CAD or mechanically certified unless that has been independently established.

### Primary forms and tolerances

- Build clean cast housings with believable wall thickness, flange geometry, bosses, ribs and mating surfaces. Model parting lines where the casting process and reference support them. Preserve smooth designed surfaces, controlled bevels and consistent silhouette curvature.
- Separate intake runner bodies, manifold flanges, covers, brackets, sensors, hoses and clamps. Remove fused bridges, self-intersections, stretched triangles and melted hose-to-block connections.
- Use visible assembly gaps appropriate to each interface. Where reference supports a visible external gap, target roughly 0.5–1 mm after real scale is established. Gaskets, interference fits and sealed mating faces must follow their own design; do not insert an arbitrary air gap into every joint.
- Give external exposed edges small scale-appropriate bevels so grazing light reveals their shape. Preserve gasket seats, counterbores, recessed fastener pockets and connector release tabs. Do not simulate large missing geometry with texture relief.

### Fasteners, flexplate and moving parts

- Use instanced reusable fastener geometry at the master-asset stage. Model correct head form, socket depth, under-head washer contact, bracket clearance and visible thread sections. Match the reference's actual head type and grade. Use grade 10.9 markings only on verified fasteners of that specification.
- Reserve individually modeled helical threads and socket striations for hero close-up parts. Bake subpixel threads into normals in runtime LODs. At normal website viewing distance, a large number of invisible threads must not dominate the triangle budget.
- Rebuild the visible flexplate/ring gear with evenly spaced teeth, a consistent verified tooth count/profile, beveled tooth edges, clean circular cutouts and a defined crankshaft bolt pattern. Use authoritative dimensions where available. Avoid hand-waving mechanical precision with decorative random holes.
- Set the flexplate pivot on its true rotation axis. Keep bolts and teeth attached to the proper assembly. Include animation only if it is requested and mechanically meaningful; the website's existing camera tour does not require the engine internals to operate.

### Harnesses, plumbing and connectors

- Route separate wiring looms with believable bend radii and attachment points. Model connector housings, locking tabs, grommets and terminal boots. Use curve-driven corrugated conduit with explicit ribs where its projected size requires geometry; bake finer weave into normals.
- Keep coolant hoses, electrical looms, fuel lines and metal pipes visually distinct. Add plausible clamps, crimp collars and mounting clips. Avoid pipes intersecting through housings or hoses ending without a connector.
- Use rubber for rubber hoses, nylon/PET for braided loom sleeves, and appropriate metals for rigid fluid conduits. Add stainless braid and AN fittings only where the selected reference actually shows them; they must not silently replace OEM plumbing.

### PBR surfaces

Author a calibrated metallic/roughness workflow with separate exported base color, metalness, roughness, tangent-space normal and ambient occlusion channels. Packed glTF ORM may be supplied in addition to the separate masters: red = AO, green = roughness, blue = metalness. Keep AO out of the base color master and use non-color data for normal/ORM textures.

- **Top cover and intake polymer:** OEM-style dark charcoal glass-filled engineering polymer. Subtle fine molded grain, faint directional handling scratches and restrained dust at sheltered edges. Start near metalness 0 and roughness 0.55–0.8, then calibrate under neutral lighting. No thick wet clearcoat. Carbon weave is optional only for a clearly requested custom cover.
- **Head and block:** cast aluminum with fine sand-cast microtexture, controlled porosity and reference-supported parting lines. Use real geometric casting ribs and flange edges. Broader highlights than polished pipes; starting roughness approximately 0.4–0.65. Bare exposed aluminum is metallic; paint, oxide or dirt layers are not automatically fully metallic.
- **Fasteners and brackets:** dark oiled or zinc-plated high-tensile steel as the reference requires. Introduce subtle finish variation, clean head edges and local oil sheen. Do not make every fastener mirror chrome or cover it with thick orange rust.
- **Pipes and machined faces:** brighter metal with restrained fine brushing and tight highlights, generally roughness 0.18–0.35 where genuinely polished. Machined bores may show concentric tooling marks. Polished detail should be selective enough to contrast with cast surfaces.
- **Rubber, seals and loom sleeves:** low-metalness dark surfaces with different roughness and texture scales from molded plastic. Include controlled normal detail for braid and corrugations. Avoid crushed blacks that hide their shape.
- Add only subtle, localized thermal discoloration around verified hot exhaust-side surfaces. Keep dust, grease, oil film and wear sparse and logically placed. The target is premium mechanical realism, not a damaged or filthy engine.
- Use scale-aware microstructure. Do not turn millimeter casting pores into centimeter craters or make baked normals distort broad planar parts. Verify detail at the intended screen size and at a close-up crop.

### Topology and UV acceptance

- Maintain quad-dominant editable source topology where it supports curvature and subdivision. Triangulated runtime GLB output is expected and acceptable. Use clean edge flow around bores, runner bends, rounded bosses and visible holes; inspect normals at grazing angles.
- Check each intended solid component for non-manifold edges, unintended boundary edges, duplicate/interior faces, inverted normals, degenerate faces, self-intersections and zero-area UVs. Do not weld the whole assembly into one solid to make a manifold report pass.
- A real open-ended tube needs wall thickness and properly closed wall boundaries; its functional bore must remain open. Distinguish designed openings from accidental holes. Record justified exceptions instead of claiming universal watertightness from a text description.
- Produce unique non-overlapping UVs for baked hero parts, consistent texel density, adequate island padding through mip levels and separate material sets where useful. Document intentional overlap for repeated instanced hardware; do not use accidental overlaps or mirrored unique text/labels.
- Bake high-to-low normal and AO with a tuned cage. Inspect seams, skewed rays, waviness and channel orientation. Export OpenGL-style tangent normals for glTF and validate against the target renderer.

### Delivery and web budgets

Deliver the editable source (`.blend` or equivalent), high-detail assembly, UV master textures, high-to-low bake settings, a named-part inventory, dimensions/provenance notes, and validated GLB LODs. Include front/back/left/right/top neutral renders, a short turntable and close-ups of the cover, intake connections, housing fasteners and flexplate teeth.

For the web assets, aim initially for roughly 300k–450k triangles and 4K hero maps on desktop, and 100k–200k triangles with 2K maps on phones. Target a desktop GLB under 9 MB and phone GLB under 4.5 MB, then adjust using actual visual and device tests. These are delivery budgets, not a claim that triangle count alone guarantees 60fps. Preserve visible ring teeth, bolt heads and silhouette before retaining hidden microgeometry. Instance repeated hardware where possible, combine static draw calls within sensible material groups, use Draco or Meshopt geometry compression, and test normal/ORM compression for artifacts.

Use a warm soft key, restrained cool fill and a bright narrow rim. Provide neutral calibration images before artistic lighting. Keep the background dark enough to frame the engine, but keep black plastic readable. Tone mapping must preserve aluminum highlights and prevent mirror-like clipping. A fixed studio environment and baked AO should be evaluated before adding expensive real-time postprocessing.

Validate the GLB in the actual React Three Fiber/Three.js application. Review all four scroll chapters: high cover, intake runners, timing-side housing and low flexplate. Check camera clearance, no model clipping, legible foreground text, working mobile LOD selection, reduced motion, no WebGL console errors, idle-render pause and measured frame times on representative real devices. Reject the asset if reference-critical forms are melted, materials are uniformly chrome, hoses are fused, ring teeth are irregular or the topology/scale report is missing.

### Negative prompt for generative tools

No melted or fused components; no blobby housings; no random pipes, unsupported wiring or invented internals; no floating bolts; no warped gear teeth; no random bolt patterns; no flat painted-on major hardware; no polygon spikes; no collapsed UVs; no duplicated seams; no mirrored labels; no uniform chrome; no thick plastic gloss; no oversized scratches; no exaggerated rust, grime or oil puddles; no fake mechanical certification; no claiming hidden geometry or real-world tolerances have been verified from one image.

## Current website implementation versus further modeling

The current enhancement retains more of the original geometry, restores higher-resolution authored textures, adds baked crevice AO and calibrated surface response, and adds filtered micrograin plus studio lighting. It also delivers separate phone/desktop assets and safer guided camera framing. It does **not** satisfy the above component separation, exact physical tolerances, threaded fastener modeling or topology certification. Those criteria belong to the additional asset-production pass and must be checked on its actual exported files.
