import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

// Static Vite app. Progress is localStorage — no server, no vault bridge.
export default defineConfig({
  plugins: [react()],
  server: { port: 5178, strictPort: true },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
})
