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
float badgeEnamel;  // Zone B: crimson enamel insets
float badgeChip;    // enamel chipped back to bare steel at laser-cut edges
float badgeForged;  // forged-steel height (0.5 = polished plane)`;

// PAINTED is the original atlas (lettering, plate, wrenches); the separately
// modeled gear parts are all steel, so only the atlas needs a hue mask.
const ZONES = /* glsl */`
{
  vec3 albedo = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(1.0 / 2.2));
  float hi = max(max(albedo.r, albedo.g), albedo.b), lo = min(min(albedo.r, albedo.g), albedo.b);
#ifdef PAINTED
  badgeSteel = 1.0 - smoothstep(0.08, 0.3, hi - lo);
  badgeEnamel = smoothstep(0.1, 0.28, albedo.r - max(albedo.g, albedo.b));
#else
  badgeSteel = 1.0;
  badgeEnamel = 0.0;
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
  badgeChip = badgeEnamel * smoothstep(0.5, 0.85, vBadgeCurv + (0.5 - badgeForged) * 1.6) * uDetail;
  badgeEnamel *= 1.0 - badgeChip;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5, 0.52, 0.55), badgeChip);
  badgeSteel = max(badgeSteel, badgeChip);
  // Scratch grooves darken and burnished lips brighten the steel only.
  diffuseColor.rgb *= 1.0 + (badgeForged - 0.5) * 0.8 * badgeSteel;
  // Occlusion where the geometry is recessed: gear roots, socket, plate edges.
  diffuseColor.rgb *= 1.0 - clamp(vBadgeCav, 0.0, 1.0) * 0.55 * uDetail;
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

const LOBES = /* glsl */`
#if defined(USE_CLEARCOAT) && defined(PAINTED)
  material.clearcoat *= badgeEnamel;
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
  float finish = badgeSteel + badgeEnamel * 0.45 + (1.0 - max(badgeSteel, badgeEnamel)) * 0.2;
  float fade = sin(3.14159265 * uSheen);
  outgoingLight += vec3(1.0, 0.96, 0.9) * band * finish * facing * fade * 0.75;
}
if (uZones > 0.5) {
  outgoingLight = badgeSteel * vec3(0.6) + badgeEnamel * vec3(1.0, 0.05, 0.1) + badgeChip * vec3(1.0, 0.85, 0.1)
    + (1.0 - max(badgeSteel, badgeEnamel)) * vec3(0.1, 0.25, 1.0);
  outgoingLight = mix(outgoingLight, vec3(0.1, 0.9, 0.2), clamp(vBadgeCav, 0.0, 1.0) * 0.8);
}`;

/** Instance-owned materials; never dispose the cached GLTF's shared textures. */
export function prepareBadgeFinish(badge: Object3D, highQuality: boolean) {
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
        let fragment = inject(shader.fragmentShader, '#include <common>', `#define ZONE_A_WEIGHT ${painted ? '0.8' : '0.35'}\n${FRAGMENT_PARS}`);
        fragment = inject(fragment, '#include <color_fragment>', ZONES);
        fragment = inject(fragment, '#include <metalnessmap_fragment>', SURFACE);
        fragment = inject(fragment, '#include <normal_fragment_maps>', NORMALS);
        fragment = inject(fragment, '#include <lights_physical_fragment>', LOBES);
        fragment = inject(fragment, '#include <opaque_fragment>', OUTPUT, 'before');
        shader.vertexShader = vertex; shader.fragmentShader = fragment;
      };
      material.customProgramCacheKey = () => `md-badge-sheen-1-${painted}-${highQuality}`;
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
