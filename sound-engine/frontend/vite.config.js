import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait()
  ],
  base: process.env.GITHUB_PAGES ? '/vangelis/' : './',
  build: {
    outDir: 'dist',
    target: 'esnext',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('three') || id.includes('@react-three') || id.includes('postprocessing')) {
              return 'vendor-three';
            }
            if (id.includes('@tonejs/midi')) {
              return 'vendor-midi';
            }
            return 'vendor-misc';
          }
          return undefined;
        }
      }
    }
  },
  server: {
    open: true,
  },
  optimizeDeps: {
    include: ['react-dial-knob'],
    esbuildOptions: {
      target: 'es2020',
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
});
