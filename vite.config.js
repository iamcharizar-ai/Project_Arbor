import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vault sync is client-side (src/lib/vaultSync.js, File System Access API) —
// no server bridge needed, so this config is a plain static build/dev setup.
// Works identically on localhost and once deployed (e.g. Vercel).
export default defineConfig({
  plugins: [react()],
  server: { port: 5178, strictPort: true },
})
