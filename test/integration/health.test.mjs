import assert from 'node:assert/strict'
import test from 'node:test'

const baseUrl = process.env.BASE_URL

test('deployed app responds at /health', { skip: !baseUrl }, async () => {
  const response = await fetch(new URL('/health', baseUrl), {
    signal: AbortSignal.timeout(10_000),
  })
  const body = await response.text()

  assert.equal(response.ok, true)
  assert.equal(body.trim(), 'ok')
})

test('bundled Korean UI font is served as WOFF2 rather than the SPA fallback', { skip: !baseUrl }, async () => {
  const response = await fetch(new URL('/fonts/pretendard-variable-1.3.9.woff2', baseUrl), {
    signal: AbortSignal.timeout(10_000),
  })
  assert.equal(response.ok, true)
  const body = new Uint8Array(await response.arrayBuffer())
  assert.equal(new TextDecoder().decode(body.subarray(0, 4)), 'wOF2')
  assert.ok(body.byteLength > 1_000_000)
})
