const path = require('node:path');
const base = require('./craco.config.cjs');

module.exports = {
  ...base,
  devServer: (config) => {
    config.static = [
      { directory: path.resolve(__dirname, '../sim/public/images'), publicPath: '/simulator/images', watch: true },
      { directory: path.resolve(__dirname, '../sim/public/js-simulator'), publicPath: '/simulator', watch: true },
      ...(Array.isArray(config.static) ? config.static : [config.static].filter(Boolean)),
    ];
    return config;
  },
  webpack: {
    configure: (config, context) => {
      if (context.env !== 'development') {
        throw new Error('The standalone stage editor is development-only. Use npm run build for production.');
      }
      config = base.webpack.configure(config, context);
      config.entry = path.resolve(__dirname, 'src/dev/stage-editor/index.tsx');
      // Exact overrides must precede CRA's broad `src` alias.
      config.resolve.alias = {
        'src/authentication/AuthProvider$': path.resolve(__dirname, 'src/dev/stage-editor/session.ts'),
        'src/components/stage-builder/localStages$': path.resolve(__dirname, 'src/dev/stage-editor/localStages.ts'),
        ...config.resolve.alias,
      };
      return config;
    },
  },
};
