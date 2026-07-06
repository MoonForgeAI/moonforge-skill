import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    coverage: { include: ['skills/moonforge-implement/assets/moonforge-sdk/**'] },
  },
});
