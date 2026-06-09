import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    host: true,
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
  publicDir: path.resolve(__dirname, '../front-end/public'),
})
