import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const webMcpHeaders = {
  'Origin-Agent-Cluster': '?1',
  'Permissions-Policy': 'tools=(self)'
};

export default defineConfig({
  plugins: [svelte({ configFile: resolve(import.meta.dirname, '../svelte.config.js') })],
  server: { host: '127.0.0.1', port: 4173, strictPort: true, headers: webMcpHeaders },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, headers: webMcpHeaders }
});
