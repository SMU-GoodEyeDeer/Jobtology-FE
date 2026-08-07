import { describe, expect, it } from 'vitest'

describe('starter project', () => {
  it('has a deterministic test command for CI', () => {
    expect('Hello, world!').toContain('world')
  })
})
