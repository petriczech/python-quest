import { defineConfig } from 'vitest/config';

// Testy firestore.rules proti emulátoru, spouští se přes `npm run test:rules`
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.spec.ts'],
    environment: 'node',
    isolate: true,
    testTimeout: 20000,
  },
});
