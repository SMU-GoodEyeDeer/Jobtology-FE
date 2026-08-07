import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('starter project', () => {
  it('renders its welcome message', () => {
    const html = renderToStaticMarkup(createElement(App))

    expect(html).toContain('Hello, world!')
    expect(html).toContain('ready for Railpack')
  })
})
