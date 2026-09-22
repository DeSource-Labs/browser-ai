import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    copyPublicDir: false,
    lib: {
      entry: {
        conversation: resolve(import.meta.dirname, 'src/conversation.ts'),
        chats: resolve(import.meta.dirname, 'src/chats.ts'),
        index: resolve(import.meta.dirname, 'src/index.ts'),
        workflows: resolve(import.meta.dirname, 'src/workflows.ts')
      },
      formats: ['es']
    },
    rollupOptions: {
      external: (id) => !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0'),
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js'
      }
    }
  }
});
