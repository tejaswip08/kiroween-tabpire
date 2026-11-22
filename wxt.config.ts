import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3,
  manifest: {
    name: 'Tabpire',
    description: 'Your tabs are draining you. Stake them.',
    permissions: ['tabs', 'storage', 'alarms', 'search'],
    // Only the text typed in the search box is ever sent here (search suggestions).
    host_permissions: ['https://suggestqueries.google.com/*'],
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
