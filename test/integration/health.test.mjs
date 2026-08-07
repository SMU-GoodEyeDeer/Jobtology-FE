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
