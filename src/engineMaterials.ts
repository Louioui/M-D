import { Mesh, MeshStandardMaterial, Vector3, type Object3D } from 'three';

/** Retain authored maps; add tiny object-space surface relief without new textures. */
export function prepareEngineMaterials(source: Object3D) {
  const model = source.clone(true);
  const materials = new Map<MeshStandardMaterial, MeshStandardMaterial>();
  const supports: { direction: Vector3; point: Vector3; score: number }[] = [];
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) {
    if (x || y || z) supports.push({ direction: new Vector3(x, y, z), point: new Vector3(), score: -Infinity });
  }
  const vertex = new Vector3();
  model.updateMatrixWorld(true);
  model.traverse(object => {
    if (!(object instanceof Mesh)) return;
    // Exact directional extrema of the real mesh give tighter framing than a box.
    // Compute once at load time; the animation loop only visits these 26 points.
    const positions = object.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
      for (const support of supports) {
        const score = vertex.dot(support.direction);
        if (score > support.score) { support.score = score; support.point.copy(vertex); }
      }
    }
    const prepare = (original: MeshStandardMaterial) => {
      if (materials.has(original)) return materials.get(original)!;
      const material = original.clone();
      material.envMapIntensity = .7;
      material.normalScale.set(.6, .6);
      material.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vEngineSurface;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEngineSurface = position;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
          varying vec3 vEngineSurface;
          float engineHash(vec3 p) { p = fract(p * .3183099 + vec3(.1,.2,.3)); p *= 17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
          float engineGrain(vec3 p) {
            vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
            return mix(mix(mix(engineHash(i),engineHash(i+vec3(1,0,0)),f.x),mix(engineHash(i+vec3(0,1,0)),engineHash(i+vec3(1,1,0)),f.x),f.y),
              mix(mix(engineHash(i+vec3(0,0,1)),engineHash(i+vec3(1,0,1)),f.x),mix(engineHash(i+vec3(0,1,1)),engineHash(i+vec3(1,1,1)),f.x),f.y),f.z);
          }`)
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
            float footprint = max(length(dFdx(vEngineSurface)),length(dFdy(vEngineSurface)));
            float grainFade = 1. - smoothstep(.002,.008,footprint);
            float microHeight = (engineGrain(vEngineSurface*460.)-.5)*.00055*grainFade;
            vec3 sigmaX=dFdx(-vViewPosition), sigmaY=dFdy(-vViewPosition);
            vec3 r1=cross(sigmaY,normal), r2=cross(normal,sigmaX);
            float determinant=dot(sigmaX,r1);
            normal=normalize(abs(determinant)*normal-sign(determinant)*(dFdx(microHeight)*r1+dFdy(microHeight)*r2));`);
      };
      material.customProgramCacheKey = () => 'md-engine-foundry-grain-v1';
      material.needsUpdate = true;
      materials.set(original, material);
      return material;
    };
    object.material = Array.isArray(object.material) ? object.material.map(prepare) : prepare(object.material);
  });
  return { model, framing: supports.map(support => support.point.multiplyScalar(1.22)), dispose: () => materials.forEach(material => material.dispose()) };
}
