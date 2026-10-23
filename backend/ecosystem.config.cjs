const path = require('path');

/**
 * PM2 wrappers around the bundled backend.
 *
 *   npm run build           -> webpack writes dist/servermemo.bundle.js
 *   npm run serve1          -> pm2 start ecosystem.config.cjs --only memo_backend1
 *   npm run serve2          -> pm2 start ecosystem.config.cjs --only memo_backend2
 *   pm2 logs memo_backend1
 *
 * Both apps read only `.env` (no ENV_FILE, no overrides). On the server each
 * instance lives in its own directory with its own .env, so the right values are
 * picked up from the working directory — .env1 / .env2 are local-dev only.
 *
 * `watch: ['dist']` restarts the process whenever a new bundle is built.
 */
const app = (name) => ({
  name,
  script: path.join(__dirname, 'dist', 'servermemo.bundle.js'),
  cwd: __dirname,
  autorestart: true,
  merge_logs: true,
  time: true,
  watch: ['dist'],
  ignore_watch: ['node_modules', '.git', '*.map'],
  watch_options: { usePolling: true, interval: 1000 },
});

module.exports = {
  apps: [
    app('memo_backend1'),
    app('memo_backend2'),
  ],
};
