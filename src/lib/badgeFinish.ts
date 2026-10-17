import { BufferAttribute, DataTexture, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, type Object3D, type Texture } from 'three';
import { inject } from './shaderInject.ts';

/** Seconds between automatic glints, how long one sweep takes, and the first one after load. */
export const SHEEN_PERIOD = 12;
export const SHEEN_SECONDS = 1.6;
export const SHEEN_FIRST = 2.5;

/**
 * Progress (0..1, eased) of the light sweep at `elapsed` seconds, or -1 when
 * no sweep is running. The glint runs on a clock, never from the cursor.
 */
export function sheenAt(elapsed: number) {
  const t = elapsed - SHEEN_FIRST;
  if (t < 0) return -1;
  const phase = t % SHEEN_PERIOD;
  if (phase >= SHEEN_SECONDS) return -1;
  const x = phase / SHEEN_SECONDS;
  return x * x * (3 - 2 * x);
}

const VERTEX_PARS = /* glsl */`
attribute float aCurvature;
attribute float aCavity;
varying vec3 vBadgePos;
varying vec3 vBadgeNormal;
varying float vBadgeCurv;
varying float vBadgeCav;`;

const VERTEX_MAIN = /* glsl */`
vBadgePos = position;
vBadgeNormal = objectNormal;
vBadgeCurv = aCurvature;
vBadgeCav = aCavity;`;

const FRAGMENT_PARS = /* glsl */`
uniform float uSheen;        // sweep progress 0..1, < 0 when idle
uniform float uDetail;
uniform float uZones;
uniform sampler2D uDetailMap;
varying vec3 vBadgePos;
varying vec3 vBadgeNormal;
varying float vBadgeCurv;
varying float vBadgeCav;
float badgeSteel;   // Zone A: forged brushed steel
float badgeLetter;  // white painted lettering: MULTI-SERVICE, ALL TYPES OF, AUTO MECHANIC SERVICE, EST.
float badgeEnamel;  // Zone B: crimson enamel insets
float badgeChip;    // enamel chipped back to bare steel at laser-cut edges
float badgeForged;  // forged-steel height (0.5 = polished plane)
float badgeRect(vec2 p, vec2 lo, vec2 hi) {
  vec2 inside = smoothstep(lo - 0.02, lo + 0.01, p) * (1.0 - smoothstep(hi - 0.01, hi + 0.02, p));
  return inside.x * inside.y;
}
// Text bands measured on the supplied badge (object space, badge ≈ ±0.95). The
// silver wrenches cross diagonally outside them, so they keep their forged steel.
float letterBands(vec2 p) {
  float arc = badgeRect(p, vec2(-0.52, 0.27), vec2(0.52, 0.52));     // AUTO MECHANIC SERVICE
  float types = badgeRect(p, vec2(-0.38, -0.02), vec2(0.38, 0.19));  // ALL TYPES OF
  float banner = badgeRect(p, vec2(-0.89, -0.34), vec2(0.89, 0.0));  // MULTI-SERVICE
  float est = badgeRect(p, vec2(-0.24, -0.66), vec2(0.24, -0.48));   // EST. 2020
  return max(max(arc, types), max(banner, est));
}`;

// PAINTED is the original atlas (lettering, plate, wrenches); the separately
// modeled gear parts are all steel, so only the atlas needs a hue mask.
const ZONES = /* glsl */`
{
  vec3 albedo = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(1.0 / 2.2));
  float hi = max(max(albedo.r, albedo.g), albedo.b), lo = min(min(albedo.r, albedo.g), albedo.b);
#ifdef PAINTED
  badgeSteel = 1.0 - smoothstep(0.08, 0.3, hi - lo);
  badgeEnamel = smoothstep(0.1, 0.28, albedo.r - max(albedo.g, albedo.b));
  // Light, neutral paint is lettering, not forged steel: keep it clean and bright
  // so the words stay legible instead of turning into scratched grey chrome.
  float lum = dot(albedo, vec3(0.2126, 0.7152, 0.0722));
  badgeLetter = smoothstep(0.55, 0.72, lum) * (1.0 - smoothstep(0.06, 0.18, hi - lo)) * letterBands(vBadgePos.xy);
  badgeSteel *= 1.0 - badgeLetter;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80, 0.81, 0.82), badgeLetter * 0.45);
#else
  badgeSteel = 1.0;
  badgeEnamel = 0.0;
  badgeLetter = 0.0;
#endif
  badgeForged = 0.5;
  if (uDetail > 0.0) {
    vec3 n = abs(normalize(vBadgeNormal));
    vec3 w = pow(n, vec3(4.0)); w /= max(w.x + w.y + w.z, 1e-4);
    vec3 p = vBadgePos * 2.5;
    float a = texture2D(uDetailMap, p.yz).a * w.x + texture2D(uDetailMap, p.zx).a * w.y + texture2D(uDetailMap, p.xy).a * w.z;
    badgeForged = mix(0.5, a, uDetail);
  }
  // Chips start on convex laser-cut edges, broken up by the pitting field.
  // Kept to true convex edges (weak noise term) so the red "M&D" isn't speckled.
  badgeChip = badgeEnamel * smoothstep(0.7, 0.95, vBadgeCurv + (0.5 - badgeForged) * 0.6) * uDetail;
  badgeEnamel *= 1.0 - badgeChip;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5, 0.52, 0.55), badgeChip);
  badgeSteel = max(badgeSteel, badgeChip);
  // Scratch grooves darken and burnished lips brighten the steel only.
  diffuseColor.rgb *= 1.0 + (badgeForged - 0.5) * 0.8 * badgeSteel;
  // Occlusion where the geometry is recessed: gear roots, socket, plate edges.
  diffuseColor.rgb *= 1.0 - clamp(vBadgeCav, 0.0, 1.0) * 0.55 * uDetail * (1.0 - badgeLetter);
}`;

const SURFACE = /* glsl */`
{
  // Zone A 0.98 / 0.15; scratches and recesses scatter the lobe.
  float steelRough = 0.15 + abs(badgeForged - 0.5) * 0.9 + vBadgeCav * 0.3 * uDetail;
  float steelWeight = badgeSteel * ZONE_A_WEIGHT;
  roughnessFactor = mix(roughnessFactor, steelRough, steelWeight);
  metalnessFactor = mix(metalnessFactor, 0.98, steelWeight);
  // Zone B 0.10 / 0.25 enamel; its gloss comes from the clearcoat lobe.
  roughnessFactor = mix(roughnessFactor, 0.25 + (0.5 - badgeForged) * 0.1, badgeEnamel);
  metalnessFactor = mix(metalnessFactor, 0.1, badgeEnamel);
  // Lettering: glossy white paint (0.05 / 0.3), lit like paint rather than mirror.
  roughnessFactor = mix(roughnessFactor, 0.3, badgeLetter);
  metalnessFactor = mix(metalnessFactor, 0.05, badgeLetter);
}`;

const NORMALS = /* glsl */`
if (uDetail > 0.0) {
  float footprint = max(length(dFdx(vBadgePos)), length(dFdy(vBadgePos)));
  float micro = (badgeForged - 0.5) * 0.0005 * uDetail * badgeSteel * (1.0 - smoothstep(0.004, 0.01, footprint));
  vec3 sigmaX = dFdx(-vViewPosition), sigmaY = dFdy(-vViewPosition);
  vec3 r1 = cross(sigmaY, normal), r2 = cross(normal, sigmaX);
  float determinant = dot(sigmaX, r1);
  normal = normalize(abs(determinant) * normal - sign(determinant) * (dFdx(micro) * r1 + dFdy(micro) * r2));
}`;

// Crisper lettering from the same 3072px atlas: a sharper mip level plus, on
// desktop, a light unsharp mask whose taps follow the screen-pixel footprint
// (half a pixel each way), so it never reaches across atlas islands.
const MAP = /* glsl */`
#ifdef USE_MAP
#ifdef PAINTED
  vec4 sampledDiffuseColor = texture2D( map, vMapUv, MAP_BIAS );
#ifdef SHARPEN
  vec2 mapDu = dFdx( vMapUv ) * 0.5, mapDv = dFdy( vMapUv ) * 0.5;
  vec4 around = texture2D( map, vMapUv + mapDu, MAP_BIAS ) + texture2D( map, vMapUv - mapDu, MAP_BIAS )
    + texture2D( map, vMapUv + mapDv, MAP_BIAS ) + texture2D( map, vMapUv - mapDv, MAP_BIAS );
  sampledDiffuseColor.rgb = clamp( sampledDiffuseColor.rgb + ( sampledDiffuseColor.rgb - around.rgb * 0.25 ) * SHARPEN, 0.0, 1.0 );
#endif
#else
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
#endif
  diffuseColor *= sampledDiffuseColor;
#endif`;

const LOBES = /* glsl */`
#if defined(USE_CLEARCOAT) && defined(PAINTED)
  material.clearcoat *= max(badgeEnamel, badgeLetter * 0.6);
#endif`;

// Timed glint: a soft diagonal band of light crosses the emblem left to right
// (object space, so it travels with the badge's tilt). Brightest on steel,
// a gentler pass over enamel, nothing on the back faces.
const OUTPUT = /* glsl */`
if (uSheen >= 0.0) {
  float along = dot(vBadgePos.xy, vec2(0.8, 0.6));
  float centre = mix(-1.5, 1.5, uSheen);
  float band = exp(-pow((along - centre) / 0.11, 2.0)) + 0.35 * exp(-pow((along - centre) / 0.3, 2.0));
  float facing = clamp(normal.z, 0.0, 1.0);
  float finish = badgeSteel + badgeEnamel * 0.45 + badgeLetter * 0.5 + (1.0 - max(max(badgeSteel, badgeEnamel), badgeLetter)) * 0.2;
  float fade = sin(3.14159265 * uSheen);
  outgoingLight += vec3(1.0, 0.96, 0.9) * band * finish * facing * fade * 0.75;
}
if (uZones > 0.5) {
  outgoingLight = badgeSteel * vec3(0.6) + badgeEnamel * vec3(1.0, 0.05, 0.1) + badgeChip * vec3(1.0, 0.85, 0.1)
    + badgeLetter * vec3(1.0, 0.0, 1.0) + (1.0 - max(max(badgeSteel, badgeEnamel), badgeLetter)) * vec3(0.1, 0.25, 1.0);
  outgoingLight = mix(outgoingLight, vec3(0.1, 0.9, 0.2), clamp(vBadgeCav, 0.0, 1.0) * 0.8);
}`;

/** Instance-owned materials; never dispose the cached GLTF's shared textures. */
export function prepareBadgeFinish(badge: Object3D, highQuality: boolean, maxAnisotropy = 1) {
  const materials = new Map<MeshStandardMaterial, MeshPhysicalMaterial>();
  const flat = new DataTexture(new Uint8Array([128, 128, 128, 128]), 1, 1);
  flat.needsUpdate = true;
  const uniforms = {
    uSheen: { value: -1 }, uDetail: { value: 0 }, uZones: { value: 0 },
    uDetailMap: { value: flat as Texture },
  };
  badge.traverse(object => {
    if (!(object instanceof Mesh)) return;
    // Neutral surface data until the detail worker lands (shared cached geometry:
    // never overwrite attributes the worker already supplied).
    const count = object.geometry.getAttribute('position').count;
    if (!object.geometry.getAttribute('aCurvature')) object.geometry.setAttribute('aCurvature', new BufferAttribute(new Float32Array(count), 1));
    if (!object.geometry.getAttribute('aCavity')) object.geometry.setAttribute('aCavity', new BufferAttribute(new Float32Array(count), 1));
    const upgrade = (original: MeshStandardMaterial) => {
      if (materials.has(original)) return materials.get(original)!;
      const material = new MeshPhysicalMaterial();
      MeshStandardMaterial.prototype.copy.call(material,original);
      const painted = original.name.includes('painted');
      // GLTFLoader leaves anisotropy at 1, which smears small lettering whenever the
      // badge tilts. Only this badge uses these textures, so set it in place.
      for (const texture of [original.map, original.normalMap, original.roughnessMap, original.metalnessMap]) {
        if (texture && texture.anisotropy < maxAnisotropy) { texture.anisotropy = maxAnisotropy; texture.needsUpdate = true; }
      }
      // Standard.copy resets the defines; keep Physical's specular/IOR path.
      Object.assign(material, { defines: { STANDARD: '', PHYSICAL: '', ...(painted ? { PAINTED: '' } : {}) } });
      // Enamel gets 0.8 clearcoat (masked per pixel); the gear parts keep a light coat.
      material.clearcoat = highQuality ? painted ? .8 : .32 : 0;
      material.clearcoatRoughness = painted ? .1 : .15;
      material.anisotropy = highQuality ? .12 : 0;
      material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms,uniforms);
        let vertex = inject(shader.vertexShader, '#include <common>', VERTEX_PARS);
        vertex = inject(vertex, '#include <begin_vertex>', VERTEX_MAIN);
        const sharpness = `#define MAP_BIAS ${highQuality ? '-0.5' : '-0.3'}\n${highQuality ? '#define SHARPEN 0.6\n' : ''}`;
        let fragment = inject(shader.fragmentShader, '#include <common>', `#define ZONE_A_WEIGHT ${painted ? '0.8' : '0.35'}\n${sharpness}${FRAGMENT_PARS}`);
        fragment = inject(fragment, '#include <map_fragment>', MAP, 'replace');
        fragment = inject(fragment, '#include <color_fragment>', ZONES);
        fragment = inject(fragment, '#include <metalnessmap_fragment>', SURFACE);
        fragment = inject(fragment, '#include <normal_fragment_maps>', NORMALS);
        fragment = inject(fragment, '#include <lights_physical_fragment>', LOBES);
        fragment = inject(fragment, '#include <opaque_fragment>', OUTPUT, 'before');
        shader.vertexShader = vertex; shader.fragmentShader = fragment;
      };
      material.customProgramCacheKey = () => `md-badge-sheen-3-${painted}-${highQuality}`;
      materials.set(original,material);
      return material;
    };
    object.material = Array.isArray(object.material) ? object.material.map(m=>m instanceof MeshStandardMaterial ? upgrade(m) : m) : object.material instanceof MeshStandardMaterial ? upgrade(object.material) : object.material;
  });
  return {
    materials: [...materials.values()], uniforms,
    /** Sweep progress from sheenAt(); -1 hides the glint. */
    setSheen(progress: number) { uniforms.uSheen.value = progress; },
    /** Worker-generated atlas (alpha = forged steel); null keeps the neutral surface. */
    setDetail(texture: Texture | null) { uniforms.uDetailMap.value = texture ?? flat; uniforms.uDetail.value = texture ? 1 : 0; },
    setZones(enabled: boolean) { uniforms.uZones.value = enabled ? 1 : 0; },
    dispose() { materials.forEach(material=>material.dispose()); flat.dispose(); },
  };
}
