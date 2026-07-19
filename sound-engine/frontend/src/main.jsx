import React from 'react';
import ReactDOM from 'react-dom/client';
import './style.css';
import {
  getActiveRoute,
  getStudyRouteMatch,
  isControlKitRoute,
  isMidiPipelineRoute,
  isSoundDesignerRoute,
  isStudySongsRoute,
  isVoiceLoopRoute
} from './utils/routes.js';

const ControlKitPage = React.lazy(() => import('./pages/ControlKitPage.jsx'));
const App = React.lazy(() => import('./App.jsx'));
const GeneratedSongStudyPage = React.lazy(() => import('./pages/GeneratedSongStudyPage.jsx'));
const MidiPipelinePage = React.lazy(() => import('./pages/MidiPipelinePage.jsx'));
const SongStudyPage = React.lazy(() => import('./pages/SongStudyPage.jsx'));
const SoundDesignerPage = React.lazy(() => import('./pages/SoundDesignerPage.jsx'));
const StudySongsPage = React.lazy(() => import('./pages/StudySongsPage.jsx'));
const VoiceLoopLabPage = React.lazy(() => import('./pages/VoiceLoopLabPage.jsx'));

const RouteLoading = () => (
  <div className="route-loading" role="status" aria-live="polite">
    Loading workspace…
  </div>
);

const Root = () => {
  const [route, setRoute] = React.useState(() => getActiveRoute());
  const showMidiPipeline = isMidiPipelineRoute(route);
  const showSoundDesigner = isSoundDesignerRoute(route);
  const showControlKit = isControlKitRoute(route);
  const showVoiceLoop = isVoiceLoopRoute(route);
  const showStudySongs = isStudySongsRoute(route);
  const studyRoute = getStudyRouteMatch(route);

  React.useEffect(() => {
    const syncRoute = () => {
      setRoute(getActiveRoute());
    };

    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('popstate', syncRoute);
    return () => {
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('popstate', syncRoute);
    };
  }, []);

  React.useEffect(() => {
    window.scrollTo(0, 0);
    window.__vangelisPerf?.markRouteReady?.(window.location.hash || '#/');
  }, [route]);

  if (studyRoute?.kind === 'builtin') {
    return <SongStudyPage studySlug={studyRoute.slug} />;
  }

  if (studyRoute?.kind === 'generated') {
    return <GeneratedSongStudyPage jobId={studyRoute.jobId} />;
  }

  if (showMidiPipeline) {
    return <MidiPipelinePage />;
  }

  if (showSoundDesigner) {
    return <SoundDesignerPage />;
  }

  if (showControlKit) {
    return <ControlKitPage />;
  }

  if (showVoiceLoop) {
    return <VoiceLoopLabPage />;
  }

  if (showStudySongs) {
    return <StudySongsPage />;
  }

  return <App />;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <React.Suspense fallback={<RouteLoading />}>
      <Root />
    </React.Suspense>
  </React.StrictMode>
);

const profilingRequested = (
  import.meta.env.DEV
  || new URLSearchParams(window.location.search).has('profile')
);
const consoleProfilingRequested = new URLSearchParams(window.location.search).has('profile');
if (profilingRequested) {
  const startProbe = () => {
    const schedule = window.requestIdleCallback
      || ((callback) => window.setTimeout(callback, 0));
    schedule(() => {
      import('./utils/performanceProbe.js')
        .then(({ startPerformanceProbe }) => startPerformanceProbe({
          reportToConsole: consoleProfilingRequested
        }))
        .catch(() => {});
    });
  };
  if (document.readyState === 'complete') startProbe();
  else window.addEventListener('load', startProbe, { once: true });
}
