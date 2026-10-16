import { BufferAttribute, DataTexture, MathUtils, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Vector3, type Object3D, type Texture } from 'three';
import { inject } from './shaderInject.ts';

export const createLiquidState = () => ({ x: 0, y: 0, energy: 0, phase: 0 });
export function stepLiquid(state: ReturnType<typeof createLiquidState>, x: number, y: number, scroll: number, dt: number, reduced: boolean) {
  dt = Math.min(.1, Math.max(0, dt));
  const speed = Math.min(1, Math.hypot(x-state.x,y-state.y) / Math.max(.008,dt) * .12 + Math.abs(scroll)*.00008);
  state.x=x; state.y=y;
  state.energy = reduced ? 0 : MathUtils.damp(state.energy,speed,speed > state.energy ? 10 : 4,dt);
  state.phase = reduced ? 0 : (state.phase + dt * (.18+state.energy*.8)) % (Math.PI*2);
  return state.energy;
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
uniform float uLiquid;
uniform float uPhase;
uniform float uDetail;
uniform float uZones;
uniform sampler2D uDetailMap;
uniform vec3 uRipple;        // xy: cursor in drawing-buffer px, z: ring radius px
uniform float uRippleStrength;
varying vec3 vBadgePos;
varying vec3 vBadgeNormal;
varying float vBadgeCurv;
varying float vBadgeCav;
float badgeSteel;   // Zone A: forged brushed steel
float badgeEnamel;  // Zone B: crimson enamel insets
float badgeChip;    // enamel chipped back to bare steel at laser-cut edges
float badgeForged;  // forged-steel height (0.5 = polished plane)
float badgeRing;    // cursor ripple at this pixel`;

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
  // Deep occlusion in the stamped recesses: lettering, socket and gear roots.
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
  // Liquid state: the steel flows toward a mirror while the pointer moves.
  roughnessFactor = clamp(roughnessFactor * (1.0 - uLiquid * badgeSteel * 0.54), 0.06, 1.0);
  metalnessFactor = max(metalnessFactor, badgeSteel * 0.92);
}`;

const NORMALS = /* glsl */`
{
  if (uDetail > 0.0) {
    float footprint = max(length(dFdx(vBadgePos)), length(dFdy(vBadgePos)));
    float micro = (badgeForged - 0.5) * 0.0005 * uDetail * badgeSteel * (1.0 - smoothstep(0.004, 0.01, footprint));
    vec3 sigmaX = dFdx(-vViewPosition), sigmaY = dFdy(-vViewPosition);
    vec3 r1 = cross(sigmaY, normal), r2 = cross(normal, sigmaX);
    float determinant = dot(sigmaX, r1);
    normal = normalize(abs(determinant) * normal - sign(determinant) * (dFdx(micro) * r1 + dFdy(micro) * r2));
  }
  // Surface-tension ripple: concentric rings spread from the cursor in screen
  // space (no raycast on the hero), plus a faint global swell while moving.
  vec2 toPointer = gl_FragCoord.xy - uRipple.xy;
  float rr = length(toPointer) / max(uRipple.z, 1.0);
  badgeRing = sin(rr * 22.0 - uPhase * 9.0) * exp(-rr * rr * 2.2) * uRippleStrength;
  vec2 radial = toPointer / max(length(toPointer), 1e-3);
  normal = normalize(normal + vec3(radial * badgeRing * 0.24, 0.0) * badgeSteel);
  normal = normalize(normal + vec3(sin(vViewPosition.y*14.0+uPhase), cos(vViewPosition.x*11.0-uPhase), 0.0) * uLiquid * badgeSteel * 0.03);
}`;

const LOBES = /* glsl */`
#if defined(USE_CLEARCOAT) && defined(PAINTED)
  material.clearcoat *= badgeEnamel;
#endif`;

// A reflection of a place that doesn't exist: a synthwave sunset over a neon
// garage grid, visible only while the steel is "liquid", then gone.
const OUTPUT = /* glsl */`
{
  vec3 viewDir = normalize(vViewPosition);
  vec3 r = reflect(-viewDir, normal);
  vec3 neon;
  if (r.y < 0.0) {
    vec2 g = r.xz / max(-r.y, 0.06) * 1.4 + vec2(0.0, uPhase * 0.8);
    vec2 f = abs(fract(g) - 0.5) / max(fwidth(g), vec2(1e-3));
    float line = 1.0 - min(min(f.x, f.y), 1.0);
    neon = mix(vec3(0.03, 0.0, 0.07), vec3(0.0, 0.95, 1.0) * 1.7, line) * smoothstep(0.0, 0.18, -r.y);
  } else {
    vec3 sky = mix(vec3(1.0, 0.38, 0.08), vec3(0.5, 0.02, 0.42), smoothstep(0.0, 0.55, r.y));
    float sunDisc = 1.0 - smoothstep(0.26, 0.28, length(vec2(r.x, r.y - 0.2)));
    float bands = step(0.35 - r.y * 1.2, fract(r.y * 26.0));
    neon = sky * 0.75 + sunDisc * bands * vec3(1.7, 0.7, 0.2);
  }
  float facing = 0.35 + 0.65 * pow(1.0 - abs(dot(normal, viewDir)), 1.5);
  // Neon pools in the rings around the cursor; the rest of the steel only glints.
  float pooled = abs(badgeRing) * 2.2 + uLiquid * 0.4;
  float hit = clamp(pooled * badgeSteel * facing, 0.0, 0.8);
  outgoingLight = mix(outgoingLight, outgoingLight * 0.4 + neon, hit);
  if (uZones > 0.5) {
    outgoingLight = badgeSteel * vec3(0.6) + badgeEnamel * vec3(1.0, 0.05, 0.1) + badgeChip * vec3(1.0, 0.85, 0.1)
      + (1.0 - max(badgeSteel, badgeEnamel)) * vec3(0.1, 0.25, 1.0);
    outgoingLight = mix(outgoingLight, vec3(0.1, 0.9, 0.2), clamp(vBadgeCav, 0.0, 1.0) * 0.8);
  }
}`;

/** Instance-owned materials; never dispose the cached GLTF's shared textures. */
export function prepareLiquidBadge(badge: Object3D, highQuality: boolean) {
  const materials = new Map<MeshStandardMaterial, MeshPhysicalMaterial>();
  const flat = new DataTexture(new Uint8Array([128, 128, 128, 128]), 1, 1);
  flat.needsUpdate = true;
  const uniforms = {
    uLiquid: { value: 0 }, uPhase: { value: 0 }, uDetail: { value: 0 }, uZones: { value: 0 },
    uDetailMap: { value: flat as Texture },
    uRipple: { value: new Vector3(-1e4, -1e4, 140) }, uRippleStrength: { value: 0 },
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
      material.customProgramCacheKey = () => `md-mercury-2-${painted}-${highQuality}`;
      materials.set(original,material);
      return material;
    };
    object.material = Array.isArray(object.material) ? object.material.map(m=>m instanceof MeshStandardMaterial ? upgrade(m) : m) : object.material instanceof MeshStandardMaterial ? upgrade(object.material) : object.material;
  });
  return {
    materials: [...materials.values()], uniforms,
    update(energy: number, phase: number, x: number, y: number, reduced: boolean) {
      uniforms.uLiquid.value=energy; uniforms.uPhase.value=phase;
      for (const material of materials.values()) {
        material.envMapRotation.set(reduced ? 0 : y*.16,reduced ? 0 : x*.32+energy*.18,0);
        if(highQuality) { material.anisotropy=.12+energy*.45; material.anisotropyRotation=reduced ? 0 : x*.8; }
      }
    },
    /** Cursor in drawing-buffer pixels (origin bottom-left); strength 0 hides the rings. */
    ripple(x: number, y: number, radius: number, strength: number) {
      uniforms.uRipple.value.set(x, y, radius); uniforms.uRippleStrength.value = strength;
    },
    /** Worker-generated atlas (alpha = forged steel); null keeps the neutral surface. */
    setDetail(texture: Texture | null) { uniforms.uDetailMap.value = texture ?? flat; uniforms.uDetail.value = texture ? 1 : 0; },
    setZones(enabled: boolean) { uniforms.uZones.value = enabled ? 1 : 0; },
    dispose() { materials.forEach(material=>material.dispose()); flat.dispose(); },
  };
}
