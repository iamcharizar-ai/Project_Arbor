import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Static Vite app. Progress is localStorage — no server, no vault bridge.
export default defineConfig({
  plugins: [react()],
  server: { port: 5178, strictPort: true },
})
