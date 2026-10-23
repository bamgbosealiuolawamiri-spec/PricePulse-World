import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  // Capacitor serves the built app from a local WebView, so assets must use relative paths.
  base: './',
})
