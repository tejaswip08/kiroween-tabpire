import '../newtab/bootTheme';
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/grenze-gotisch/latin-800.css';
import '@fontsource/sora/latin-400.css';
import '@fontsource/sora/latin-600.css';
import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-500.css';
import '../newtab/styles/tokens.css';
import '../newtab/styles/base.css';
import { BloodBank } from './BloodBank';

document.title = 'Blood Bank - Tabpire';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BloodBank />
  </React.StrictMode>,
);
