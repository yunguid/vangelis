import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './style.css';
import { audioEngine } from './utils/audioEngine.js';
import { withBase } from './utils/baseUrl.js';

try {
  await audioEngine.ensureWasm();
} catch (e) {
  // Allow UI to render even if AudioWorklet isn't available yet.
}
// Warm the audio graph in the background, but don't block rendering on it.
audioEngine.warmGraph();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(withBase('sw.js')).catch(() => {
      /* silent */
    });
  });
}
