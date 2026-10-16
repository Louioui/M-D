import {
  Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Vector3,
  type IUniform, type Object3D, type Texture, type WebGLProgramParametersWithUniforms,
} from 'three';
import { ENGINE_SCALE } from '../enginePath.ts';

import type { InspectionMode } from './inspection.ts';
const MODE_INDEX: Record<InspectionMode | 'zones', number> = { studio: 0, cad: 1, spec: 2, zones: 3 };

export interface EngineUniforms {
  uMode: IUniform<number>;
  uDetail: IUniform<number>;
  uDetailMap: IUniform<Texture>;
  uDetailScale: IUniform<number>;
  uFlyCenter: IUniform<Vector3>;
  uFlyAxis: IUniform<Vector3>;
  uFlyRadius: IUniform<number>;
  uAniso: IUniform<number>;
}

// Flexplate geometry measured from the supplied mesh (object space): machined
// face at x≈0.57, hub centred near y=-0.42, z=0; ring gear radius ≈0.47.
const FLYWHEEL = { center: new Vector3(.52, -.42, 0), axis: new Vector3(1, 0, 0), radius: .47 };

const VERTEX_PARS = /* glsl */`
attribute float aCurvature;
attribute float aCavity;
uniform vec3 uFlyCenter;
uniform vec3 uFlyAxis;
varying vec3 vEnginePos;
varying vec3 vEngineNormal;
varying vec3 vEngineRadial;
varying float vCurv;
varying float vCav;`;

const VERTEX_MAIN = /* glsl */`
vEnginePos = position;
vEngineNormal = objectNormal;
vCurv = aCurvature;
vCav = aCavity;
vec3 flyOffset = position - uFlyCenter;
vEngineRadial = (modelViewMatrix * vec4(flyOffset - dot(flyOffset, uFlyAxis) * uFlyAxis, 0.0)).xyz;`;

const FRAGMENT_PARS = /* glsl */`
varying vec3 vEnginePos;
varying vec3 vEngineNormal;
varying vec3 vEngineRadial;
varying float vCurv;
varying float vCav;
uniform sampler2D uDetailMap;
uniform float uDetail;
uniform float uDetailScale;
uniform int uMode;
uniform vec3 uFlyCenter;
uniform vec3 uFlyAxis;
uniform float uFlyRadius;
uniform float uAniso;
// x: sand-cast aluminium, y: machined flexplate steel, z: polymer, w: fasteners
vec4 engineZones;
float engineChrome;
float engineHeight;
float engineLine(float coordinate) {
  float width = max(fwidth(coordinate), 1e-4);
  return 1.0 - smoothstep(0.0, 1.0, abs(fract(coordinate - 0.5) - 0.5) / width);
}`;

// Segment by sRGB albedo luminance/saturation, measured object-space bounds and
// worker curvature. Weights are smooth, so zone borders never alias or pop.
const ZONES = /* glsl */`
{
  vec3 albedo = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(1.0 / 2.2));
  float lum = dot(albedo, vec3(0.2126, 0.7152, 0.0722));
  float hi = max(max(albedo.r, albedo.g), albedo.b);
  float sat = (hi - min(min(albedo.r, albedo.g), albedo.b)) / max(hi, 1e-3);
  vec3 fly = vEnginePos - uFlyCenter;
  float axial = dot(fly, uFlyAxis);
  float radial = length(fly - axial * uFlyAxis);
  float zB = (1.0 - smoothstep(uFlyRadius * 0.94, uFlyRadius * 1.06, radial)) * smoothstep(-0.07, -0.02, axial);
  float zC = (1.0 - smoothstep(0.16, 0.26, lum)) * (1.0 - zB);
  float zE = smoothstep(0.56, 0.72, lum) * smoothstep(0.3, 0.45, vEnginePos.y) * smoothstep(0.2, 0.45, vCurv) * (1.0 - sat) * (1.0 - zB) * (1.0 - zC);
  float zD = smoothstep(0.55, 0.78, vCurv) * (1.0 - zB) * (1.0 - zC) * (1.0 - zE);
  float zA = clamp(1.0 - zB - zC - zD - zE, 0.0, 1.0);
  engineZones = vec4(zA, zB, zC, zD);
  engineChrome = zE;
  // Heat cycling: bronze/amber on the exhaust (-Z) flank and along the head gasket seam.
  float exhaust = smoothstep(-0.5, -0.72, vEnginePos.z) * smoothstep(-0.15, 0.1, vEnginePos.y) * (1.0 - smoothstep(0.45, 0.62, vEnginePos.y));
  float seam = 1.0 - smoothstep(0.0, 0.03, abs(vEnginePos.y - 0.18));
  float heat = clamp(exhaust + seam * 0.5, 0.0, 1.0) * zA;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.16, 0.95, 0.72), heat * 0.42);
  // Oiled crevice occlusion: deepest in tooth roots, balancing holes and around bolt bases.
  diffuseColor.rgb *= 1.0 - clamp(vCav, 0.0, 1.0) * (0.3 + 0.38 * (zB + zD));
}`;

const SURFACE = /* glsl */`
{
  engineHeight = 0.5;
  if (uDetail > 0.0) {
    vec3 n = abs(normalize(vEngineNormal));
    vec3 w = pow(n, vec3(4.0)); w /= max(w.x + w.y + w.z, 1e-4);
    vec3 p = vEnginePos * uDetailScale;
    vec4 tri = texture2D(uDetailMap, p.yz) * w.x + texture2D(uDetailMap, p.zx) * w.y + texture2D(uDetailMap, p.xy) * w.z;
    // Lathe lines are concentric: sample the brushed channel in polar coordinates.
    vec3 fly = vEnginePos - uFlyCenter;
    vec3 rim = fly - dot(fly, uFlyAxis) * uFlyAxis;
    // Integer angular repeats keep the atan seam continuous; unwrap its derivative too.
    vec2 polar = vec2(atan(rim.z, rim.y) * (3.0 / 6.2831853), length(rim) * uDetailScale * 1.8);
    vec2 gx = dFdx(polar), gy = dFdy(polar);
    gx.x -= 3.0 * floor(gx.x / 3.0 + 0.5); gy.x -= 3.0 * floor(gy.x / 3.0 + 0.5);
    float lathe = textureGrad(uDetailMap, polar, gx, gy).g;
    engineHeight = engineZones.x * tri.r + engineZones.y * lathe + engineZones.z * tri.b + engineZones.w * mix(0.5, tri.r, 0.3) + engineChrome * 0.5;
    roughnessFactor += ((tri.r - 0.5) * 0.12 * engineZones.x + (tri.b - 0.5) * 0.1 * engineZones.z) * uDetail;
  }
  float zoneRough = engineZones.x * 0.42 + engineZones.y * 0.22 + engineZones.z * 0.68 + engineZones.w * 0.18 + engineChrome * 0.08;
  float zoneMetal = engineZones.x * 0.88 + engineZones.y * 0.96 + engineZones.z * 0.04 + engineZones.w * 0.95 + engineChrome;
  // Keep 28% of the authored roughness variation so baked wear still reads.
  roughnessFactor = clamp(mix(roughnessFactor, zoneRough, 0.72), 0.04, 1.0);
  metalnessFactor = clamp(mix(metalnessFactor, zoneMetal, 0.8), 0.0, 1.0);
  if (uMode == 2) roughnessFactor *= 0.55; // Raking inspection light wants tight lobes.
}`;

const BUMP = /* glsl */`
if (uDetail > 0.0) {
  float footprint = max(length(dFdx(vEnginePos)), length(dFdy(vEnginePos)));
  float fade = 1.0 - smoothstep(0.004, 0.012, footprint);
  float micro = (engineHeight - 0.5) * 0.0011 * uDetail * fade;
  vec3 sigmaX = dFdx(-vViewPosition), sigmaY = dFdy(-vViewPosition);
  vec3 r1 = cross(sigmaY, normal), r2 = cross(normal, sigmaX);
  float determinant = dot(sigmaX, r1);
  normal = normalize(abs(determinant) * normal - sign(determinant) * (dFdx(micro) * r1 + dFdy(micro) * r2));
}`;

// Radial anisotropy on the machined flexplate face and clearcoat only there.
const LOBES = /* glsl */`
#ifdef USE_ANISOTROPY
{
  float radialLength = length(vEngineRadial);
  vec3 tangentDir = radialLength > 1e-5 ? vEngineRadial / radialLength : tbn[0];
  tangentDir = normalize(tangentDir - dot(tangentDir, normal) * normal + vec3(1e-6));
  float strength = uAniso * engineZones.y;
  material.anisotropy = strength;
  material.alphaT = mix(pow2(material.roughness), 1.0, pow2(strength));
  material.anisotropyT = tangentDir;
  material.anisotropyB = cross(normal, tangentDir);
}
#endif
#ifdef USE_CLEARCOAT
  material.clearcoat *= engineZones.y;
#endif`;

const OUTPUT = /* glsl */`
if (uMode == 1) {
  // CAD inspection: blueprint shading, creases from geometric normal derivatives,
  // station lines every 40 mm (model scale) and curvature-traced fastener edges.
  vec3 geometric = normalize(vNormal);
  float crease = clamp(length(fwidth(geometric)) * 2.2, 0.0, 1.0);
  float facing = pow(1.0 - abs(dot(geometric, normalize(vViewPosition))), 2.0);
  float stations = max(engineLine(vEnginePos.y * 25.0) * 0.4, engineLine(vEnginePos.x * 25.0) * 0.22);
  float lines = clamp(max(max(crease, stations), smoothstep(0.55, 0.9, vCurv) * 0.65), 0.0, 1.0);
  vec3 base = vec3(0.025, 0.06, 0.12) + vec3(0.06, 0.13, 0.22) * facing - vec3(0.02, 0.03, 0.05) * vCav;
  outgoingLight = mix(base, vec3(0.62, 0.86, 1.0), lines);
} else if (uMode == 3) {
  outgoingLight = engineZones.x * vec3(0.55) + engineZones.y * vec3(0.1, 0.35, 1.0) + engineZones.z * vec3(0.1, 0.8, 0.2)
    + engineZones.w * vec3(1.0, 0.85, 0.1) + engineChrome * vec3(1.0, 0.1, 0.8);
}`;

export interface EngineMaterialOptions { detailMap: Texture; clearcoat: boolean; detailScale?: number }

/** Clones the shared GLTF scene and upgrades its single atlas material to the zoned physical shader. */
export function prepareEngineMaterials(source: Object3D, options: EngineMaterialOptions) {
  const model = source.clone(true);
  const uniforms: EngineUniforms = {
    uMode: { value: 0 },
    uDetail: { value: 1 },
    uDetailMap: { value: options.detailMap },
    uDetailScale: { value: options.detailScale ?? 1 / .35 },
    uFlyCenter: { value: FLYWHEEL.center.clone() },
    uFlyAxis: { value: FLYWHEEL.axis.clone() },
    uFlyRadius: { value: FLYWHEEL.radius },
    uAniso: { value: options.clearcoat ? .62 : 0 },
  };
  const materials = new Map<MeshStandardMaterial, MeshPhysicalMaterial>();
  const supports: { direction: Vector3; point: Vector3; score: number }[] = [];
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) {
    if (x || y || z) supports.push({ direction: new Vector3(x, y, z), point: new Vector3(), score: -Infinity });
  }
  const vertex = new Vector3();
  model.updateMatrixWorld(true);

  const upgrade = (original: MeshStandardMaterial) => {
    const existing = materials.get(original);
    if (existing) return existing;
    const material = new MeshPhysicalMaterial({
      name: original.name, color: original.color, map: original.map,
      normalMap: original.normalMap, normalMapType: original.normalMapType,
      aoMap: original.aoMap, aoMapIntensity: original.aoMapIntensity,
      roughness: original.roughness, roughnessMap: original.roughnessMap,
      metalness: original.metalness, metalnessMap: original.metalnessMap,
      emissive: original.emissive, emissiveMap: original.emissiveMap, emissiveIntensity: original.emissiveIntensity,
      side: original.side, transparent: original.transparent, opacity: original.opacity, alphaTest: original.alphaTest,
    });
    material.envMapIntensity = .7;
    material.normalScale.set(.6, .6);
    material.clearcoat = options.clearcoat ? .35 : 0;
    material.clearcoatRoughness = .12;
    material.anisotropy = options.clearcoat ? 1 : 0; // Strength is set per pixel in LOBES.
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX_MAIN}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${ZONES}`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${SURFACE}`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${BUMP}`)
        .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>\n${LOBES}`)
        .replace('#include <opaque_fragment>', `${OUTPUT}\n#include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => `md-engine-zones-v2-${options.clearcoat ? 'hq' : 'lite'}`;
    material.needsUpdate = true;
    materials.set(original, material);
    return material;
  };

  model.traverse(object => {
    if (!(object instanceof Mesh)) return;
    // Exact directional extrema give tighter framing than a bounding box; the
    // camera solver only visits these 26 points per frame.
    const positions = object.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
      for (const support of supports) {
        const score = vertex.dot(support.direction);
        if (score > support.score) { support.score = score; support.point.copy(vertex); }
      }
    }
    const convert = (material: unknown) => material instanceof MeshStandardMaterial ? upgrade(material) : material;
    object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
  });

  const framing = new Float32Array(supports.length * 3);
  supports.forEach((support, i) => support.point.multiplyScalar(ENGINE_SCALE).toArray(framing, i * 3));
  return {
    model,
    uniforms,
    materials: [...materials.values()],
    framing,
    setMode(mode: InspectionMode | 'zones') { uniforms.uMode.value = MODE_INDEX[mode]; },
    dispose: () => materials.forEach(material => material.dispose()),
  };
}
