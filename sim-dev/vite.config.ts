import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@simulator': path.resolve(__dirname, '../front-end/src/components/js-simulator'),
    },
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
