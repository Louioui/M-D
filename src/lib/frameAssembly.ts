import { Vector3, type PerspectiveCamera } from 'three';

const right = new Vector3(), up = new Vector3(), back = new Vector3(), point = new Vector3();

/** A bounded safety fit for the current RAF. Worker replies can be one frame
 * behind moving parts; guard the rendered pose without visiting mesh vertices. */
export function frameAssembly(camera: PerspectiveCamera, points: Float32Array, aspect: number, width: number, height: number) {
  right.set(1,0,0).applyQuaternion(camera.quaternion);
  up.set(0,1,0).applyQuaternion(camera.quaternion);
  back.set(0,0,1).applyQuaternion(camera.quaternion);
  const tanY=Math.tan(camera.fov*Math.PI/360), fitY=tanY*height, fitX=tanY*Math.max(.2,aspect)*width;
  let pull=0;
  for(let i=0;i<points.length;i+=3){
    point.fromArray(points,i).sub(camera.position);
    pull=Math.max(pull,point.dot(back)+Math.max(Math.abs(point.dot(right))/fitX,Math.abs(point.dot(up))/fitY));
  }
  if(pull>0)camera.position.addScaledVector(back,pull+.002);
  return pull;
}
