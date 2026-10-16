import WebGL from 'three/examples/jsm/capabilities/WebGL.js';

/** Check once, before model downloads as well as before canvas creation. */
export const webgl2Available = (() => {
  try { return WebGL.isWebGL2Available(); } catch { return false; }
})();
