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

    expect(html).toContain('나의 다음을,')
    expect(html).toContain('연결하다.')
    expect(html).toContain('Google로 시작하기')
  })

  it('offers an interactive example graph without claiming personal results', () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Onboarding)))

    expect(html).toContain('미리 볼 목표 직무')
    expect(html).toContain('나의 경험 연결 보기')
    expect(html).toContain('예시 경로')
    expect(html).not.toContain('충족률')
  })

  it('requires security verification before Google login', () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Onboarding)))

    expect(html).toContain('aria-label="보안 확인"')
    expect(html).toContain('disabled=""')
    expect(html).not.toContain('href="/api/v1/auth/google/login"')
    expect(html).toContain('Google로 시작하기')
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
