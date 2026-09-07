import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ViteDevServer } from 'vite'

// api/*.ts files use the @vercel/node handler shape (req.method, req.headers,
// req.body, res.status().json()) so they deploy to Vercel unchanged. `vite
// build`/`vite preview` never call configureServer, so this only exists for
// `npm run dev` — in production Vercel's own routing serves api/*.ts
// directly, this file is never involved. Add a new endpoint's filename here
// (no extension) to make it reachable locally too.
const API_ROUTES = ['structure-gm-notes', 'gm-recommendations', 'generate-system-reference', 'generate-portrait', 'generate-scene']

interface MinimalVercelResponse {
  status(code: number): MinimalVercelResponse
  json(payload: unknown): void
}

export function apiDevMiddleware(): Plugin {
  return {
    name: 'api-dev-middleware',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = req.url ?? ''
        const route = API_ROUTES.find((name) => url === `/api/${name}` || url.startsWith(`/api/${name}?`))
        if (!route) {
          next()
          return
        }

        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const rawBody = Buffer.concat(chunks).toString('utf-8')
          const body = rawBody ? JSON.parse(rawBody) : undefined

          const vercelReq = { method: req.method, headers: req.headers, body }
          const vercelRes: MinimalVercelResponse = {
            status(code) {
              res.statusCode = code
              return vercelRes
            },
            json(payload) {
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(payload))
            },
          }

          // ssrLoadModule: Vite's own dev-time loader (handles the TS
          // transform + the api/_lib/*.js-extension imports), not a plain
          // Node import — a plain import can't resolve this the same way
          // the dev server's module graph does.
          const mod = await server.ssrLoadModule(`/api/${route}.ts`)
          await mod.default(vercelReq, vercelRes)
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Dev API middleware error.' }))
        }
      })
    },
  }
}
