import { defineConfig, loadEnv } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

const { publicVars } = loadEnv({ prefixes: ['REACT_APP_'] });

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: { index: './src/index.tsx' },
    define: { 'process.env': '{}', ...publicVars, 'process.env.PUBLIC_URL': JSON.stringify(process.env.PUBLIC_URL || '') },
  },
  html: { template: './index.html' },
  output: { distPath: { root: 'build' } },
  server: { port: Number(process.env.PORT || 3000) },
  tools: { rspack: { resolve: { symlinks: false } } },
});
