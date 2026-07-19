import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { generatePhraseLoop } = require('./api/lib/phraseLoopGenerator.js');
const { fallbackPhrase, generateVoicePhrase } = require('./api/lib/voicePhraseGenerator.js');

function applyLocalEnv(mode) {
  const envRoots = [
    path.resolve(process.cwd(), '../..'),
    process.cwd()
  ];

  for (const envRoot of envRoots) {
    const localEnv = loadEnv(mode, envRoot, '');
    for (const [key, value] of Object.entries(localEnv)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

async function readJsonBody(req) {
  let rawBody = '';
  for await (const chunk of req) {
    rawBody += chunk;
  }

  if (!rawBody) return {};

  try {
    return JSON.parse(rawBody);
  } catch (_) {
    return {};
  }
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function localAiDevApi() {
  return {
    name: 'vangelis-local-ai-dev-api',
    config(_, { mode }) {
      applyLocalEnv(mode);
    },
    configureServer(server) {
      server.middlewares.use('/api/phrase-loop', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.setHeader('Allow', 'POST');
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }

        const payload = await readJsonBody(req);
        try {
          const result = await generatePhraseLoop(payload);
          sendJson(res, 200, result);
        } catch (error) {
          console.error('Failed to generate phrase loop:', error);
          sendJson(res, error.statusCode || 500, {
            error: error.publicMessage || 'Phrase loop generation failed.',
            providerError: error.providerError || null
          });
        }
      });
      server.middlewares.use('/api/voice-phrase', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.setHeader('Allow', 'POST');
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }

        const payload = await readJsonBody(req);
        try {
          const result = await generateVoicePhrase(payload);
          sendJson(res, 200, result);
        } catch (error) {
          console.error('Failed to generate voice phrase:', error);
          sendJson(res, 200, {
            source: 'fallback',
            model: null,
            warning: 'Voice phrase generator fell back to the local phrase engine.',
            phrase: fallbackPhrase()
          });
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    localAiDevApi()
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
    open: true,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/generated': 'http://127.0.0.1:8000'
    }
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
