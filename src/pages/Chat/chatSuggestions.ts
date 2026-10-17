import type { RoleEvidenceGraph } from "../../services/types";
import { isOwned } from "./evidenceGraphLayout";

export const ROUTE_SUGGESTION = "내 경로 추천해줘";
const MAX_QUESTIONS = 4;

function subjectParticle(word: string): string {
  const last = word.charCodeAt(word.length - 1);
  const isHangul = last >= 0xac00 && last <= 0xd7a3;
  return isHangul && (last - 0xac00) % 28 !== 0 ? "이" : "가";
}

export function withRouteSuggestion(questions: readonly string[]): string[] {
  const unique = [...new Set(questions.map((q) => q.trim()).filter((q) => q && q !== ROUTE_SUGGESTION))];
  return [...unique.slice(0, MAX_QUESTIONS), ROUTE_SUGGESTION];
}

export function initialSuggestions(
  goalName: string | null,
  graph: RoleEvidenceGraph | null,
  owned: ReadonlySet<string>,
): string[] {
  const questions = ["나는 뭐부터 준비해야 해?"];
  if (goalName) questions.push(`${goalName}${subjectParticle(goalName)} 되려면 뭐가 부족해?`);
  const missingTech = graph?.nodes.find((n) => n.kind === "technology" && !isOwned(n.label, owned));
  if (missingTech) questions.push(`${missingTech.label} 어떻게 시작하면 돼?`);
  const qualification = graph?.nodes.find((n) => n.kind === "qualification");
  if (qualification) questions.push(`${qualification.label} 따는 게 도움 돼?`);
  if (questions.length < MAX_QUESTIONS) questions.push("비전공인데 가능할까?");
  return withRouteSuggestion(questions);
}
