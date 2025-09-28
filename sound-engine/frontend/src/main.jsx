import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './style.css';
import { audioEngine } from './utils/audioEngine.js';

await audioEngine.ensureWasm();
// Warm the audio graph in the background, but don't block rendering on it.
audioEngine.warmGraph();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
