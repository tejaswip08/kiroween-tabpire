import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    // Several UI and property tests are slow when many test files run at once; a longer limit avoids timeouts under load.
    testTimeout: 20_000,
  },
});
