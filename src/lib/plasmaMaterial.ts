import { AdditiveBlending, DoubleSide, ShaderMaterial, Vector3, type IUniform } from 'three';

export interface HeatUniforms {
  uHoverPoint: IUniform<Vector3>;
  uHoverIntensity: IUniform<number>;
  uHoverRadius: IUniform<number>;
}
export const createHeatUniforms = (): HeatUniforms => ({
  uHoverPoint: { value: new Vector3() }, uHoverIntensity: { value: 0 }, uHoverRadius: { value: .34 },
});

export const HEAT_PARS = /* glsl */`
uniform vec3 uHoverPoint;
uniform float uHoverIntensity;
uniform float uHoverRadius;
varying vec3 vHeatWorld;
float hoverHeat() {
  float d = distance(vHeatWorld, uHoverPoint) / max(uHoverRadius, 0.001);
  return exp(-d*d*3.0) * uHoverIntensity;
}`;

/** A single-pass, unlit crystal shell. No costly screen-space transmission/bloom.
 * Backfaces are dimmed, depth writes disabled; inner cores are rendered first. */
export function createPlasmaMaterial(heat: HeatUniforms, core = false) {
  return new ShaderMaterial({
    name: core ? 'Crimson energy core' : 'Fresnel crystal X-ray',
    uniforms: { ...heat, uTime: { value: 0 }, uCore: { value: core ? 1 : 0 } },
    transparent: true, depthWrite: false, side: DoubleSide, forceSinglePass: true, blending: AdditiveBlending,
    vertexShader: /* glsl */`
      varying vec3 vWorld; varying vec3 vView; varying vec3 vNormalView; varying vec3 vLocal;
      varying vec3 vHeatWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        vWorld = world.xyz; vHeatWorld = world.xyz; vView = -view.xyz;
        vNormalView = normalize(normalMatrix * normal); vLocal = position;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uCore;
      varying vec3 vWorld; varying vec3 vView; varying vec3 vNormalView; varying vec3 vLocal;
      ${HEAT_PARS}
      float grid(vec3 p) {
        vec3 g = abs(fract(p * 26.0 - 0.5) - 0.5) / max(fwidth(p * 26.0), vec3(0.001));
        return 1.0 - min(min(g.x,g.y), min(g.z,1.0));
      }
      void main() {
        float fresnel = pow(1.0 - abs(dot(normalize(vView), normalize(vNormalView))), 2.4);
        float scan = pow(0.5 + 0.5*sin(vWorld.y*27.0-uTime*1.2), 14.0);
        float lattice = clamp(grid(vLocal), 0.0, 1.0);
        float heat = hoverHeat();
        vec3 cold = mix(vec3(0.025,0.1,0.2), vec3(0.30,0.78,1.0), fresnel);
        vec3 color = cold * (0.3 + fresnel*1.8) + lattice*vec3(0.04,0.15,0.23) + scan*vec3(0.12,0.03,0.045);
        float alpha = 0.035 + fresnel*0.48 + lattice*0.055;
        if (uCore > 0.5) {
          float pulse = 0.9 + 0.1*sin(uTime*1.5+vLocal.y*18.0);
          color = mix(vec3(0.9,0.015,0.055), vec3(1.0,0.38,0.09), fresnel) * pulse;
          alpha = 0.35 + fresnel*0.55;
        }
        color = mix(color, vec3(1.2,0.2,0.025), heat);
        alpha += heat*0.25;
        if (!gl_FrontFacing) { color *= 0.45; alpha *= 0.5; }
        gl_FragColor = vec4(color, clamp(alpha,0.0,0.9));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
