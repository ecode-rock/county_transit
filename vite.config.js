import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves this repo at /county_transit/. Only apply that base to
  // production builds so local `npm run dev` still serves from the root.
  base: command === 'build' ? '/county_transit/' : '/',
  plugins: [react()],
  // The folder path contains a space ("County Transit"); the dev launcher
  // reaches it via the Windows 8.3 short path, which doesn't match Vite's
  // default fs allow-list. Relax the restriction for local dev.
  server: {
    fs: { strict: false },
  },
}))
