import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Onboarding } from './pages/Onboarding/Onboarding'

describe('Onboarding page', () => {
  it('renders the hero section', () => {
    const html = renderToStaticMarkup(createElement(Onboarding))

    expect(html).toContain('채용공고 5,000건')
    expect(html).toContain('1분 만에 내 경로 찾기')
  })

  it('renders the feature cards', () => {
    const html = renderToStaticMarkup(createElement(Onboarding))

    expect(html).toContain('사람마다 다른 경로')
    expect(html).toContain('모든 단계에 근거')
    expect(html).toContain('한 번 받고 끝이 아니에요')
  })
})
