import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';

/**
 * Custom Vite Plugin for Single Page Application (SPA) History API Fallback.
 * Ensures page refreshes on client-side routes (e.g. /tickets, /repairs, /calendar)
 * cleanly serve /index.html without returning 404 errors.
 */
function historyApiFallbackPlugin(): Plugin {
  return {
    name: 'vite-plugin-history-api-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (
          req.method === 'GET' &&
          req.headers.accept?.includes('text/html') &&
          !req.url?.startsWith('/api') &&
          !req.url?.includes('.')
        ) {
          req.url = '/index.html';
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (
          req.method === 'GET' &&
          req.headers.accept?.includes('text/html') &&
          !req.url?.startsWith('/api') &&
          !req.url?.includes('.')
        ) {
          req.url = '/index.html';
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    appType: 'spa',
    plugins: [
      react(),
      tailwindcss(),
      historyApiFallbackPlugin(),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
    },
  };
});
