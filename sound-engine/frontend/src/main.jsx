import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import VocalFinderPage from './components/VocalFinderPage.jsx';
import './style.css';
import { audioEngine } from './utils/audioEngine.js';
import { APP_ROUTES, getCurrentRoute, subscribeToRouteChanges } from './utils/appRoutes.js';
import { withBase } from './utils/baseUrl.js';

const RoutedApp = () => {
  const [route, setRoute] = React.useState(() => getCurrentRoute());

  React.useEffect(() => {
    const unsubscribe = subscribeToRouteChanges(setRoute);
    return unsubscribe;
  }, []);

  React.useEffect(() => {
    document.title = route === APP_ROUTES.vocalFinder ? 'Vocal Finder | Vangelis' : 'Vangelis';
  }, [route]);

  if (route === APP_ROUTES.vocalFinder) {
    return <VocalFinderPage />;
  }

  return <App />;
};

try {
  await audioEngine.ensureWasm();
} catch (e) {
  // Allow UI to render even if AudioWorklet isn't available yet.
}
// Warm the audio graph in the background, but don't block rendering on it.
audioEngine.warmGraph();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RoutedApp />
  </React.StrictMode>
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(withBase('sw.js')).catch(() => {
      /* silent */
    });
  });
}
