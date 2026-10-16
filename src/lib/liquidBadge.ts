import { MathUtils, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, type Object3D } from 'three';

export const createLiquidState = () => ({ x: 0, y: 0, energy: 0, phase: 0 });
export function stepLiquid(state: ReturnType<typeof createLiquidState>, x: number, y: number, scroll: number, dt: number, reduced: boolean) {
  dt = Math.min(.1, Math.max(0, dt));
  const speed = Math.min(1, Math.hypot(x-state.x,y-state.y) / Math.max(.008,dt) * .12 + Math.abs(scroll)*.00008);
  state.x=x; state.y=y;
  state.energy = reduced ? 0 : MathUtils.damp(state.energy,speed,speed > state.energy ? 10 : 4,dt);
  state.phase = reduced ? 0 : (state.phase + dt * (.18+state.energy*.8)) % (Math.PI*2);
  return state.energy;
}

/** Instance-owned materials; never dispose the cached GLTF's shared textures. */
export function prepareLiquidBadge(badge: Object3D, highQuality: boolean) {
  const materials = new Map<MeshStandardMaterial, MeshPhysicalMaterial>();
  const uniforms = { uLiquid: { value: 0 }, uPhase: { value: 0 } };
  badge.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const upgrade = (original: MeshStandardMaterial) => {
      if (materials.has(original)) return materials.get(original)!;
      const material = new MeshPhysicalMaterial();
      MeshStandardMaterial.prototype.copy.call(material,original);
      // Standard.copy resets the defines; keep Physical's specular/IOR path.
      Object.assign(material, { defines: { STANDARD: '', PHYSICAL: '' } });
      material.clearcoat = highQuality ? .32 : 0;
      material.clearcoatRoughness = .15;
      material.anisotropy = highQuality ? .12 : 0;
      const painted = original.name.includes('painted');
      material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms,uniforms);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uLiquid;\nuniform float uPhase;\nfloat liquidMask;')
          .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\nliquidMask = ${painted ? '1.0-smoothstep(0.08,0.3,max(max(diffuseColor.r,diffuseColor.g),diffuseColor.b)-min(min(diffuseColor.r,diffuseColor.g),diffuseColor.b))' : '1.0'};\nroughnessFactor = clamp(roughnessFactor * (1.0-uLiquid*liquidMask*0.54),0.09,1.0);\nmetalnessFactor = max(metalnessFactor,liquidMask*0.92);`)
          .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(normal + vec3(sin(vViewPosition.y*14.0+uPhase), cos(vViewPosition.x*11.0-uPhase),0.0)*uLiquid*liquidMask*0.035);');
      };
      material.customProgramCacheKey = () => `md-mercury-1-${painted}-${highQuality}`;
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
    dispose() { materials.forEach(material=>material.dispose()); },
  };
}
