import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Onboarding } from './pages/Onboarding/Onboarding'

const authState = vi.hoisted(() => ({ session: null, loading: false, error: null as string | null, refresh: async () => {} }))

vi.mock('./context/SessionContext', () => ({ useSession: () => authState }))

describe('Onboarding page', () => {
  beforeEach(() => { authState.error = null })

  it('renders the hero section', () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Onboarding)))

    expect(html).toContain('채용공고 5,000건')
    expect(html).toContain('1분 만에 내 경로 찾기')
  })

  it('renders the feature cards', () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Onboarding)))

    expect(html).toContain('사람마다 다른 경로')
    expect(html).toContain('모든 단계에 근거')
    expect(html).toContain('한 번 받고 끝이 아니에요')
  })

  it('links Google login through the same API origin', () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Onboarding)))

    expect(html).toContain('href="/api/v1/auth/google/login"')
    expect(html).toContain('Google 계정으로 로그인하고 시작해요.')
  })

  it('offers a retry when checking the session fails', () => {
    authState.error = '로그인 상태를 확인하지 못했어요.'
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Onboarding)))

    expect(html).toContain('role="alert"')
    expect(html).toContain(authState.error)
    expect(html).toContain('다시 시도')
    expect(html).not.toContain('/auth/google/login')
  })
})
