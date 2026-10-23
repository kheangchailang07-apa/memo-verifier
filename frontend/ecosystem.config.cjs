const path = require('path');

/**
 * PM2 wrappers around `vite preview` for the two built apps.
 *
 *   npm run preview1        -> pm2 start ecosystem.config.cjs --only memo-frontend1
 *   npm run preview2        -> pm2 start ecosystem.config.cjs --only memo-frontend2
 *   npm run preview:stop    -> pm2 delete memo-frontend1 memo-frontend2
 *   pm2 logs memo-frontend1
 *
 * Build first: npm run build1 / build2 (dist1 / dist2).
 */
const viteBin = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');

const app = (name, mode, outDir, port) => ({
  name,
  script: viteBin,
  args: `preview --mode ${mode} --outDir ${outDir} --port ${port}`,
  cwd: __dirname,
  autorestart: true,
  merge_logs: true,
  time: true,
  // Restart the preview when a fresh build lands in this instance's output dir.
  watch: [outDir],
  ignore_watch: ['node_modules', '.git'],
  watch_options: { usePolling: true, interval: 1000 },
});

module.exports = {
  apps: [
    app('memo-frontend1', 'apa1', 'dist1', 3366),
    app('memo-frontend2', 'apa2', 'dist2', 3367),
  ],
};
