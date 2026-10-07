// Intro/outro pacing in one place. The intro targets ~3s of visible logo time:
// whatever the `/` splash already showed is subtracted from the onboarding hold
// so the user perceives the full ~3s regardless of lookup speed.
export const INTRO_TOTAL_MS = 3000;
export const INTRO_FADE_MS = 1500;
export const INTRO_HOLD_MS = INTRO_TOTAL_MS - INTRO_FADE_MS;
export const INTRO_FADE_S = INTRO_FADE_MS / 1000;

export const OUTRO_MIN_MS = 3000;
export const OUTRO_FADE_MS = 500;
export const OUTRO_FADE_S = OUTRO_FADE_MS / 1000;

export function introHoldMs(elapsedShownMs: number): number {
  const remaining = INTRO_HOLD_MS - Math.max(0, elapsedShownMs);
  return Math.min(INTRO_HOLD_MS, Math.max(0, remaining));
}

// Timestamp of the logo's first paint on `/`, shared with /onboarding via this
// module singleton (same SPA session). Re-entering onboarding later gets a
// fresh full-length intro because the marker is reset once consumed.
let introShownAt: number | null = null;

export function markIntroStart(): void {
  introShownAt = Date.now();
}

export function introElapsedMs(): number {
  return introShownAt === null ? 0 : Date.now() - introShownAt;
}

export function resetIntroStart(): void {
  introShownAt = null;
}
