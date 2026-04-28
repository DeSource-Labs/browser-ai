import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'url';

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      name: 'BrowserAiVue',
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es', 'cjs'],
      fileName: (format, entryName = 'index') => {
        if (format === 'es') return `${entryName}.mjs`;
        return `${entryName}.cjs`;
      }
    },
    minify: false,
    rollupOptions: {
      external: ['vue'],
      output: {
        exports: 'named',
        globals: {
          vue: 'Vue'
        }
      }
    }
  }
});
