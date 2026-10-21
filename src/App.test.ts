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

    expect(html).toContain('목표 직무에 필요한 역량과 학습 경로')
    expect(html).toContain('Google로 시작하기')
  })

  it('renders the feature cards', () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Onboarding)))

    expect(html).toContain('내 상황에 맞는 경로')
    expect(html).toContain('데이터 기반 역량 분석')
    expect(html).toContain('경험에 따른 계획 조정')
  })

  it('links Google login through the same API origin', () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Onboarding)))

    expect(html).toContain('href="/api/v1/auth/google/login"')
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
