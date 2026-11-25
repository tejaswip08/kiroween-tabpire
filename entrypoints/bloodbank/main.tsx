import '../newtab/bootTheme';
import React from 'react';
import ReactDOM from 'react-dom/client';
// The same fonts, tokens and component styles as the Crypt (site icons, buttons, tips), so the page follows the theme.
import '../newtab/styles';
import { BloodBank } from './BloodBank';
document.title = 'The Blood Bank - Tabpire';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BloodBank />
  </React.StrictMode>,
);
