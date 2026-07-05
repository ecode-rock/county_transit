import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The folder path contains a space ("County Transit"); the dev launcher
  // reaches it via the Windows 8.3 short path, which doesn't match Vite's
  // default fs allow-list. Relax the restriction for local dev.
  server: {
    fs: { strict: false },
  },
})
