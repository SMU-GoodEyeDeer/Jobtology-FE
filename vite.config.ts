import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const BACKEND_ORIGIN = 'https://jobtology.yeongmin.net'

export function developmentProxyOrigin(origin: string | undefined, host: string | undefined): string | undefined {
  if (!origin || !host) return
  try {
    const source = new URL(origin)
    if (['http:', 'https:'].includes(source.protocol) && source.host === host) return BACKEND_ORIGIN
  } catch {
    // Leave unrecognized origins intact so the backend can reject them.
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: BACKEND_ORIGIN,
        changeOrigin: true,
        secure: true,
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq, req) => {
            // changeOrigin rewrites Host, but the backend also checks Origin on
            // writes. Forward our own dev page as the upstream origin while
            // preserving cookies, CSRF tokens, and rejection of other origins.
            const origin = developmentProxyOrigin(req.headers.origin, req.headers.host)
            if (origin) proxyReq.setHeader('Origin', origin)
          })
        },
      },
    },
  },
  preview: {
    allowedHosts: ['.yeongmin.net'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'vite.config.test.ts'],
  },
})
