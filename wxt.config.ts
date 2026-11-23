import { defineConfig } from 'wxt';
import { noRemoteDraco } from './build/noRemoteDraco';




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
    // Required for the toolbar badge (browser.action). No popup yet.
    action: { default_title: 'Tabpire' },
    browser_specific_settings: {
      gecko: {
        // Placeholder. Replace with the real add-on id before submission.
        id: 'tabpire@example.invalid',
      },
    },
  },
});
