import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { apiDevMiddleware } from './vite-plugins/api-dev.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vite only puts VITE_-prefixed vars into import.meta.env for client code;
  // '' as the third arg here (no prefix filter) reads every var from
  // .env.local, including the server-only ones (SUPABASE_SERVICE_ROLE_KEY,
  // ANTHROPIC_API_KEY) that api/*.ts handlers need via process.env —
  // otherwise apiDevMiddleware's ssrLoadModule of those handlers would find
  // them undefined.
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ANTHROPIC_API_KEY']) {
    if (env[key]) process.env[key] = env[key]
  }

  return {
    plugins: [react(), tailwindcss(), apiDevMiddleware()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
  }
})
