import { describe, expect, it } from "vitest";
import type { EvidenceNode, RoleEvidenceGraph } from "../../services/types";
import { ROUTE_SUGGESTION, initialSuggestions, withRouteSuggestion } from "./chatSuggestions";

const node = (id: string, kind: EvidenceNode["kind"], label: string): EvidenceNode =>
  ({ id, kind, label, detail: null, weight: null });

const graph: RoleEvidenceGraph = {
  occupation_id: "BACKEND_DEVELOPER",
  name: "백엔드 개발자",
  nodes: [
    node("role", "role", "백엔드 개발자"),
    node("py", "technology", "Python"),
    node("linux", "technology", "Linux"),
    node("q", "qualification", "정보처리산업기사"),
  ],
  edges: [],
};

describe("initialSuggestions", () => {
  it("builds questions from the goal and the first unowned technology and qualification", () => {
    // Given
    const owned = new Set(["python"]);

    // When
    const result = initialSuggestions("백엔드 개발자", graph, owned);

    // Then
    expect(result).toEqual([
      "나는 뭐부터 준비해야 해?",
      "백엔드 개발자가 되려면 뭐가 부족해?",
      "Linux 어떻게 시작하면 돼?",
      "정보처리산업기사 따는 게 도움 돼?",
      ROUTE_SUGGESTION,
    ]);
  });

  it("uses the 이 particle after a final consonant and falls back without graph data", () => {
    // Given / When
    const result = initialSuggestions("데이터 분석", null, new Set());

    // Then
    expect(result[1]).toBe("데이터 분석이 되려면 뭐가 부족해?");
    expect(result.at(-1)).toBe(ROUTE_SUGGESTION);
  });
});

describe("withRouteSuggestion", () => {
  it("dedupes AI questions, caps them at four and always ends with the route action", () => {
    // Given
    const questions = [" A? ", "A?", "B?", ROUTE_SUGGESTION, "C?", "D?", "E?"];

    // When / Then
    expect(withRouteSuggestion(questions)).toEqual(["A?", "B?", "C?", "D?", ROUTE_SUGGESTION]);
  });
});
