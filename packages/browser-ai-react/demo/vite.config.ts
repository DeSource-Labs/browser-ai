import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const webMcpHeaders = {
  'Origin-Agent-Cluster': '?1',
  'Permissions-Policy': 'tools=(self)'
};

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 4172, strictPort: true, headers: webMcpHeaders },
  preview: { host: '127.0.0.1', port: 4172, strictPort: true, headers: webMcpHeaders }
});
