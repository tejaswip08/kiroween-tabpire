import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3,
  manifest: {
    name: 'Tabpire',
    description: 'Your tabs are draining you. Stake them.',
    permissions: ['tabs', 'storage', 'alarms', 'search'],
    browser_specific_settings: {
      gecko: {
        // Placeholder. Replace with the real add-on id before submission.
        id: 'tabpire@example.invalid',
      },
    },
  },
});
