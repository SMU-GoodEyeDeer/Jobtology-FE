import assert from 'node:assert/strict'
import test from 'node:test'

const baseUrl = process.env.BASE_URL

test('deployed app responds at /health', { skip: !baseUrl }, async () => {
  const response = await fetch(new URL('/health', baseUrl))
  assert.equal(response.ok, true)
})
