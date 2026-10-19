import { describe, expect, it } from 'vitest'
import { developmentProxyOrigin } from './vite.config'

describe('development API proxy origin', () => {
  it('forwards same-origin local requests to the backend origin on either dev port', () => {
    for (const host of ['localhost:5173', 'localhost:5174', '127.0.0.1:5173', '[::1]:5173']) {
      expect(developmentProxyOrigin(`http://${host}`, host)).toBe('https://jobtology.yeongmin.net')
    }
  })

  it('preserves foreign and mismatched-port origins for backend validation', () => {
    for (const origin of ['https://untrusted.example', 'http://localhost:5174', 'http://localhost.attacker.example:5173']) {
      expect(developmentProxyOrigin(origin, 'localhost:5173')).toBeUndefined()
    }
  })

  it('does not add an origin for absent, opaque, or malformed origins', () => {
    for (const origin of [undefined, 'null', 'not a URL', 'file://localhost:5173']) {
      expect(developmentProxyOrigin(origin, 'localhost:5173')).toBeUndefined()
    }
    expect(developmentProxyOrigin('http://localhost:5173', undefined)).toBeUndefined()
  })
})
