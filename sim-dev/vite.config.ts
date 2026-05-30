import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Simulator source
      { find: '@simulator', replacement: path.resolve(__dirname, '../front-end/src/components/js-simulator') },
      // Pin all npm packages used by the simulator to sim-dev/node_modules so
      // that files resolved outside the project root (../front-end/...) still
      // find these modules correctly. 'three' prefix-matches three/* sub-paths too.
      { find: 'three',        replacement: path.resolve(__dirname, 'node_modules/three') },
      { find: 'framer-motion', replacement: path.resolve(__dirname, 'node_modules/framer-motion') },
      { find: 'stats.js',     replacement: path.resolve(__dirname, 'node_modules/stats.js') },
    ],
  },
  server: {
    port: 3001,
    host: true,
    fs: {
      allow: [path.resolve(__dirname, '..')]
    },
  },
  publicDir: path.resolve(__dirname, '../front-end/public'),
})
