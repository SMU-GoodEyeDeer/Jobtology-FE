import { describe, expect, it } from "vitest";
import { DEFAULT_QUESTIONS, followUpQuestions } from "./chatSuggestions";

describe("follow-up questions", () => {
  it("removes assistant advice while preserving questions and user requests", () => {
    expect(followUpQuestions([
      "등록한 자격·프로젝트에 구체적인 역량과 20자 이상의 경험 설명을 추가한 뒤 분석을 다시 실행하세요.",
      "먼저 데이터베이스 구현과 애플리케이션 배포를 실제 프로젝트로 보완하세요.",
      "내 프로젝트에서 어떤 근거를 더 설명하면 좋을까?", "SQL 공부 순서 알려줘",
    ])).toEqual(["내 프로젝트에서 어떤 근거를 더 설명하면 좋을까?", "SQL 공부 순서 알려줘"]);
  });

  it("trims, deduplicates and caps questions while ignoring malformed or oversized entries", () => {
    expect(followUpQuestions([null, 2, "", "x".repeat(60) + "?", " SQL  공부 알려줘 ", "SQL 공부 알려줘",
      "A?", "B？", "C?", "D?"])).toEqual(["SQL 공부 알려줘", "A?", "B？", "C?"]);
  });

  it("uses useful starter questions when no follow-up passes validation", () => {
    expect(followUpQuestions([])).toEqual(DEFAULT_QUESTIONS);
    expect(followUpQuestions(["프로젝트를 보완하세요."])).toEqual(DEFAULT_QUESTIONS);
  });

  it("keeps polite requests with optional spacing and punctuation", () => {
    expect(followUpQuestions(["SQL 공부 순서 알려주세요", "프로젝트를 설명해 주세요.", "다음 단계를 추천해줘요"]))
      .toEqual(["SQL 공부 순서 알려주세요", "프로젝트를 설명해 주세요.", "다음 단계를 추천해줘요"]);
    expect(followUpQuestions(["x".repeat(60) + " 알려주세요"])).toEqual(DEFAULT_QUESTIONS);
  });
});
