import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const webMcpHeaders = {
  'Origin-Agent-Cluster': '?1',
  'Permissions-Policy': 'tools=(self)'
};

export default defineConfig({
  plugins: [vue()],
  server: { host: '127.0.0.1', port: 4171, strictPort: true, headers: webMcpHeaders },
  preview: { host: '127.0.0.1', port: 4171, strictPort: true, headers: webMcpHeaders }
});
