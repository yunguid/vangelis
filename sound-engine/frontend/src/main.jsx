import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { getBuiltInStudy } from './data/songStudies.js';
import GeneratedSongStudyPage from './pages/GeneratedSongStudyPage.jsx';
import MidiPipelinePage from './pages/MidiPipelinePage.jsx';
import SongStudyPage from './pages/SongStudyPage.jsx';
import StudySongsPage from './pages/StudySongsPage.jsx';
import './style.css';
import { withBase } from './utils/baseUrl.js';
import {
  getActiveRoute,
  getStudyRouteMatch,
  isMidiPipelineRoute,
  isStudySongsRoute
} from './utils/routes.js';

const Root = () => {
  const [route, setRoute] = React.useState(() => getActiveRoute());
  const showMidiPipeline = isMidiPipelineRoute(route);
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
  }, [route]);

  if (studyRoute?.kind === 'builtin') {
    const study = getBuiltInStudy(studyRoute.slug);
    if (study) {
      return <SongStudyPage study={study} />;
    }
  }

  if (studyRoute?.kind === 'generated') {
    return <GeneratedSongStudyPage jobId={studyRoute.jobId} />;
  }

  if (showMidiPipeline) {
    return <MidiPipelinePage />;
  }

  if (showStudySongs) {
    return <StudySongsPage />;
  }

  return <App />;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(withBase('sw.js')).catch(() => {
      /* silent */
    });
  });
}
