import '../../entrypoints/newtab/bootTheme';
import { createRoot } from 'react-dom/client';
import { capabilities } from '../../lib/capabilities';
import '../../entrypoints/newtab/styles';
import '../../entrypoints/bloodbank/bloodbank.css';
import './demo.css';
import { DemoShell } from './DemoShell';
import { installInterceptors } from './intercept';
import { seedDemo } from './seed';

// Startup order matters: pages must not run before the seed.
// (Imports above only define modules. Nothing reads the fake until render.)
// 1. No request may leave the page.
capabilities.remoteSuggestions = false;
capabilities.remoteIcons = false;
// 2. Turn navigation and search into notices. Own-page links change the hash.
installInterceptors((route) => {
  window.location.hash = `#/${route}`;
});
// 3. Fill the fake, relative to the time of this load.
seedDemo(Date.now());
// 4. Render.
createRoot(document.getElementById('root')!).render(<DemoShell />);
