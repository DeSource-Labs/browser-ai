import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/index.ts', 'src/env.d.ts'],
      reporter: ['text', 'lcov'],
      thresholds: { statements: 95, branches: 95, functions: 95, lines: 95 }
    }
  },
  build: {
    target: 'es2022',
    minify: false,
    cssMinify: true,
    sourcemap: true,
    lib: {
      name: 'BrowserAiVue',
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es', 'cjs'],
      fileName: (format, entryName = 'index') => {
        const name = entryName.replace(/[?&=]/g, '_');
        if (format === 'es') return `${name}.mjs`;
        return `${name}.cjs`;
      }
    },
    rolldownOptions: {
      external: (id) =>
        id === 'vue' || id === 'markdown-it' || id === '@desource/browser-ai' || id.startsWith('@desource/browser-ai/'),
      output: {
        preserveModules: true,
        preserveModulesRoot: fileURLToPath(new URL('./src', import.meta.url)),
        exports: 'named',
        globals: {
          vue: 'Vue'
        }
      }
    }
  }
});
