import '../newtab/bootTheme';
import React from 'react';
import ReactDOM from 'react-dom/client';
import '../newtab/styles';
import { Popup } from './Popup';
document.title = 'Tabpire';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup onDone={() => window.close()} />
  </React.StrictMode>,
);
