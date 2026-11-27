import { defineConfig } from 'wxt';
import { noRemoteDraco } from './build/noRemoteDraco';




const ICONS = { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' };
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3,
  vite: () => ({ plugins: [noRemoteDraco] }),
  manifest: {
    name: 'Tabpire',
    description: 'Your tabs are draining you. Stake them.',
    // 'favicon' lets Chrome's own icon cache (the _favicon address) be used for the haunts. Firefox ignores it.
    permissions: ['tabs', 'storage', 'alarms', 'search', 'favicon'],
    // Only the text typed in the search box is ever sent here (search suggestions).
    host_permissions: ['https://suggestqueries.google.com/*'],
    // The compressed vampire model needs the meshopt WebAssembly decoder.
    content_security_policy: { extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'" },
    // The pink bat logo, made by tools/make-icons.mjs from tools/icon/bat.svg.
    icons: ICONS,
    // The toolbar badge (browser.action) and the popup (entrypoints/popup, added by WXT as default_popup).
    action: { default_title: 'Tabpire', default_icon: ICONS, default_popup: 'popup.html' },
    browser_specific_settings: {
      gecko: {
        // A fixed id lets Firefox Sync match installs across devices. Change the domain to one you own.
        id: 'tabpire@tabpire.app',
      },
    },
  },
});
