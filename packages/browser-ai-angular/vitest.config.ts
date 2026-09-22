import angular from '@analogjs/vite-plugin-angular';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [angular({ jit: true, tsconfig: fileURLToPath(new URL('./tsconfig.spec.json', import.meta.url)) })],
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/types.ts'],
      reporter: ['text', 'lcov'],
      thresholds: { lines: 95, functions: 95, statements: 95, branches: 95 }
    }
  }
});
