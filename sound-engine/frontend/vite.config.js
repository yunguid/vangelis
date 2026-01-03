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
