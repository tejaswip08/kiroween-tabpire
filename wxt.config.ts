import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Tabpire',
    description: 'Your tabs are draining you. Stake them.',
    permissions: ['tabs', 'storage', 'alarms', 'search'],
    // Search-box suggestions, the same service Chrome's address bar uses.
    host_permissions: ['https://suggestqueries.google.com/*'],
    action: { default_title: 'Tabpire' },
  },
});
