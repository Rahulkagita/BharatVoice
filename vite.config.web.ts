import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * BharatVoice web build.
 *
 * The web app calls the backend through the same origin (`/api/chat`). In
 * development Vite proxies `/api` to the local FastAPI server; in production
 * the hosting layer is expected to route `/api/*` to the backend.
 *
 * This config deliberately does not import or run the extension manifest/CSP
 * plugin, and it writes to a separate output directory so the extension build
 * in `dist/` is never touched.
 */
export default defineConfig({
  root: path.resolve(__dirname, 'src/web'),
  plugins: [react()],
  define: {
    // An empty origin makes the shared API client call `/api/chat` on the
    // current page origin. The extension build keeps its absolute origin.
    __BACKEND_URL__: JSON.stringify(''),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist-web'),
    emptyOutDir: true,
  },
});
