export const DEFAULT_QUESTIONS = ["내 목표에 뭐가 부족해?", "내 스펙은 어떻게 반영됐어?", "다음 학습 활동을 설명해줘"];

export function followUpQuestions(raw: readonly unknown[]): string[] {
  const selected = new Map<string, string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const text = item.replace(/\s+/g, " ").trim();
    if (text.length > 60 || !/(?:[?？]|(?:알려|설명해|보여|추천해|비교해|정리해)\s*줘)[.!]?$/.test(text)) continue;
    const key = text.toLocaleLowerCase();
    if (!selected.has(key)) selected.set(key, text);
    if (selected.size === 4) break;
  }
  return selected.size ? [...selected.values()] : DEFAULT_QUESTIONS;
}
