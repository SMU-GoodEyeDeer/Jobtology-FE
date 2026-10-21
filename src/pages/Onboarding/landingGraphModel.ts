export const LANDING_ROLES = [
  { id: "ai", label: "AI 엔지니어", skills: ["Python", "데이터 분석", "머신러닝"], activity: "모델 구현 프로젝트" },
  { id: "backend", label: "백엔드 개발자", skills: ["프로그래밍", "데이터베이스", "API 설계"], activity: "서비스 구현 프로젝트" },
  { id: "frontend", label: "프런트엔드 개발자", skills: ["JavaScript", "UI 구현", "웹 접근성"], activity: "웹 인터페이스 만들기" },
  { id: "data", label: "데이터 분석가", skills: ["SQL", "통계", "데이터 시각화"], activity: "데이터 분석 프로젝트" },
] as const;
export type LandingRole = typeof LANDING_ROLES[number];
export type NodeId = "me" | "project" | "skill1" | "skill2" | "skill3" | "activity" | "postings" | "catalog" | "goal";
export interface Point { x: number; y: number }
export type Positions = Record<NodeId, Point>;
export const INITIAL_POSITIONS: Positions = {
  me: { x: 13, y: 56 }, project: { x: 23, y: 19 },
  skill1: { x: 37, y: 39 }, skill2: { x: 39, y: 79 }, skill3: { x: 58, y: 30 },
  activity: { x: 63, y: 70 }, postings: { x: 81, y: 13 },
  catalog: { x: 52, y: 5 }, goal: { x: 86, y: 53 },
};
export const COMPACT_POSITIONS: Positions = {
  me: { x: 14, y: 61 }, project: { x: 18, y: 12 },
  skill1: { x: 34, y: 34 }, skill2: { x: 32, y: 86 }, skill3: { x: 69, y: 34 },
  activity: { x: 70, y: 86 }, postings: { x: 83, y: 12 },
  catalog: { x: 49, y: 7 }, goal: { x: 84, y: 61 },
};
export const CONNECTIONS: readonly (readonly [NodeId, NodeId])[] = [
  ["me", "project"], ["me", "skill1"], ["me", "skill2"], ["project", "skill1"],
  ["skill1", "skill3"], ["skill2", "activity"], ["skill3", "activity"],
  ["activity", "goal"], ["skill3", "goal"], ["postings", "goal"], ["catalog", "skill3"],
];
export const NODE_IDS = Object.keys(INITIAL_POSITIONS) as NodeId[];
export function connectionPath(from: Point, to: Point): string {
  const middle = (from.x + to.x) / 2;
  return `M ${from.x} ${from.y} C ${middle} ${from.y}, ${middle} ${to.y}, ${to.x} ${to.y}`;
}
