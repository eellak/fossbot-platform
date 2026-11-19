import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginTypeCheck } from '@rsbuild/plugin-type-check';

export default defineConfig(({ command, envMode }) => {
  // The deployment build skips Rsbuild's shared .env.local. Local commands
  // let the CLI load the development files before evaluating this config.
  if (command === 'build' && envMode === 'production' && existsSync('.env.production')) {
    loadEnvFile('.env.production');
  }
  const env = { ...process.env };
  if (command === 'dev') {
    env.REACT_APP_BACKEND_URL ??= 'http://localhost:8000';
  }
  const publicVars: Record<string, string> = {};
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith('REACT_APP_')) continue;
    const literal = JSON.stringify(value);
    publicVars[`process.env.${name}`] = literal;
    publicVars[`import.meta.env.${name}`] = literal;
  }
  const publicUrl = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');

  return {
    plugins: [pluginReact(), command === 'dev' && pluginTypeCheck()],
    source: {
      entry: { index: './src/index.tsx' },
      define: { 'process.env': '{}', ...publicVars, 'process.env.PUBLIC_URL': JSON.stringify(publicUrl) },
    },
    html: { template: './index.html' },
    output: { assetPrefix: publicUrl || '/', distPath: { root: 'build' } },
    server: { host: process.env.HOST || '127.0.0.1', port: Number(process.env.PORT || 3000) },
    tools: { rspack: { resolve: { symlinks: false } } },
  };
});
