import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/grenze-gotisch/latin-800.css';
import '@fontsource/sora/latin-400.css';
import '@fontsource/sora/latin-600.css';
import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-500.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/controls.css';
import './styles/header.css';
import './styles/search.css';
import './styles/haunts.css';
import './styles/cards.css';
import './styles/states.css';
import './styles/layers.css';
import './styles/toasts.css';
import './styles/fps.css';
import { App } from './App';

document.title = 'Tabpire';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
