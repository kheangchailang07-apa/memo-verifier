import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode, command, isPreview}) => {
  // .env.apa1 / .env.apa2 select the instance: port, backend origin, API base.
  const env = loadEnv(mode, process.cwd(), '');
  const backendOrigin = env.VITE_BACKEND_ORIGIN || 'http://localhost:5422';
  const port = Number(env.VITE_FRONTEND_PORT) || 3366;

  const publicApiUrl = env.VITE_PUBLIC_API_URL || '';
  const isDevServer = command === 'serve' && !isPreview;
  if (isDevServer) {
    console.log(`[api] local (dev)    -> ${backendOrigin}`);
  } else {
    console.log(`[api] server (build) -> ${publicApiUrl || '(same-origin /api)'}`);
  }

  // Hosts the dev/preview server may be reached through (reverse proxy or
  // hosts-file mapping). Extend via VITE_ALLOWED_HOSTS=a.example.com,b.example.com
  const allowedHosts = [
    'memo.apa1-eva.com',
    'memo.apa2-eva.com',
    ...(env.VITE_ALLOWED_HOSTS || '').split(',').map((host) => host.trim()).filter(Boolean),
  ];

  // Shared by the dev server and `vite preview`: /api and /health live outside
  // the static bundle, so both forward them to this instance's backend.
  const proxy = {
    '/api': {
      target: backendOrigin,
      changeOrigin: true,
      secure: false,
      ws: false,
    },
    // The signature artwork is served by the backend under the layout of the
    // bucket (/signatures_memo/<owner>/<file>), so the URLs that are stored in
    // the database resolve on this origin too.
    '/signatures_memo': {
      target: backendOrigin,
      changeOrigin: true,
      secure: false,
      ws: false,
    },
    // /health lives outside the /api mount; proxy it too so the client
    // can reach it without a second hardcoded host.
    '/health': {
      target: backendOrigin,
      changeOrigin: true,
      secure: false,
      ws: false,
    },
  };

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      port,
      host: '0.0.0.0',
      allowedHosts,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy,
    },
    // `npm run preview1/preview2` hits the same host check and proxy as dev.
    preview: {
      allowedHosts,
      proxy,
    },
  };
});
