const path = require('path');
const { builtinModules } = require('module');

/**
 * Node built-ins and every bare package stay outside the bundle and are
 * resolved from node_modules at runtime (npm ci on the server), which keeps
 * mysql2 / sequelize / @aws-sdk working — they rely on dynamic requires.
 * Local sources (./src/**) are compiled by ts-loader and bundled in.
 */
const externals = [
  ({ request }, callback) => {
    if (!request) return callback();
    const isBuiltin = builtinModules.includes(request.replace(/^node:/, ''));
    const isLocal = request.startsWith('.') || path.isAbsolute(request);
    if (isBuiltin || isLocal) return callback();
    return callback(null, `commonjs ${request}`);
  },
];

module.exports = (env = {}) => ({
  target: 'node',
  mode: env.production ? 'production' : 'development',
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'servermemo.bundle.js',
  },
  externals,
  externalsPresets: { node: true },
  // Keep runtime __dirname/__filename so dotenv and static paths still resolve.
  node: {
    __dirname: false,
    __filename: false,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        // esbuild strips the types; ts-loader cannot run against TypeScript 7.
        // Type checking stays with `npm run lint` / tsc.
        test: /\.ts$/,
        loader: 'esbuild-loader',
        options: {
          loader: 'ts',
          target: 'es2022',
        },
        exclude: /node_modules/,
      },
    ],
  },
  devtool: 'source-map',
  optimization: {
    minimize: false,
  },
  performance: {
    hints: false,
  },
});
