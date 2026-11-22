import { defineConfig } from 'wxt';

/**
 * drei's useGLTF has a default Draco decoder address on gstatic.com. Extensions cannot load remote
 * code, and no Tabpire model uses Draco, so the address is replaced with a local path that is
 * never requested (every useGLTF call turns Draco off).
 */
const noRemoteDraco = {
  name: 'tabpire-no-remote-draco',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id.includes('@react-three/drei') || !code.includes('gstatic.com/draco')) return null;
    return { code: code.replace(/https:\/\/www\.gstatic\.com\/draco\/[^'"`]*/g, '/draco-disabled/'), map: null };
  },
};

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3,
  vite: () => ({ plugins: [noRemoteDraco] }),
  manifest: {
    name: 'Tabpire',
    description: 'Your tabs are draining you. Stake them.',
    permissions: ['tabs', 'storage', 'alarms', 'search'],
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
