import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Module workers (scrollWorker, engineDetailWorker) share ES chunks with the app.
  worker: { format: 'es' },
  build: {
    rollupOptions: {
      output: {
        // Keep three.js out of the first-paint graph: React has its own chunk, so
        // the hero HTML renders while the lazy WebGL stages stream in.
        manualChunks(id) {
          // Vite's dynamic-import helper must not ride inside a heavy vendor chunk.
          if (id.includes('vite/preload-helper') || id.includes('vite/modulepreload-polyfill')) return 'runtime';
          if (id.includes('/node_modules/three/')) return 'three';
          if (id.includes('/node_modules/@react-three/')) return 'r3f';
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          if (id.includes('/node_modules/gsap/')) return 'motion';
          return undefined;
        },
      },
    },
  },
});
