import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../..');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@shared': resolve(repoRoot, 'shared') },
  },
  server: {
    port: 5173,
    // The API is the only origin the app talks to; proxying keeps the browser
    // on one origin so there is no CORS surface to configure.
    proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false } },
    fs: { allow: [repoRoot] },
  },
  build: { outDir: 'dist', sourcemap: true },
});
