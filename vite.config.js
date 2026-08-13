import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react()
  ],
  base: process.env.GITHUB_PAGES ? '/vangelis/' : './',
  build: {
    outDir: 'dist',
    target: 'esnext',
    assetsDir: 'assets',
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('@tonejs/midi')
              || id.includes('/midi-file/')
              || id.includes('/array-flatten/')
            ) {
              return undefined;
            }
            if (id.includes('react') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            return 'vendor-misc';
          }
          return undefined;
        }
      }
    }
  },
  server: {
    open: true
  },
  resolve: {
    alias: [
      { find: 'react/jsx-runtime', replacement: 'preact/jsx-runtime' },
      { find: 'react/jsx-dev-runtime', replacement: 'preact/jsx-dev-runtime' },
      { find: 'react-dom/test-utils', replacement: 'preact/test-utils' },
      { find: 'react-dom/client', replacement: 'preact/compat/client' },
      { find: 'react-dom', replacement: 'preact/compat' },
      { find: 'react', replacement: 'preact/compat' }
    ],
    dedupe: ['preact'],
  },
});
