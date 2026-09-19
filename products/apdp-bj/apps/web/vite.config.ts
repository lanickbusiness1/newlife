import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('../../dist-web', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: {
      '/v1': 'http://127.0.0.1:3001',
      '/health': 'http://127.0.0.1:3001',
    },
  },
});
