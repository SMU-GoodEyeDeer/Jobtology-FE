import { useEffect, useState } from "react";
import { liveApi, roadmapsApi } from "../../services/api";
import type { ExamSessionsResponse, NcsUnitResponse, RoadmapDetailResponse } from "../../services/types";

type Resource<T> =
  | { readonly state: "loading" }
  | { readonly state: "ready"; readonly data: T }
  | { readonly state: "missing" }
  | { readonly state: "error" };

const definitions = new Map<string, Promise<Resource<NcsUnitResponse>>>();
const exams = new Map<string, Promise<Resource<ExamSessionsResponse>>>();

async function resolveResource<T>(load: () => Promise<T>): Promise<Resource<T>> {
  try {
    return { state: "ready", data: await load() };
  } catch (error) {
    return { state: error instanceof Error && "status" in error && error.status === 404 ? "missing" : "error" };
  }
}

function cached<T>(cache: Map<string, Promise<Resource<T>>>, key: string, load: () => Promise<T>) {
  const existing = cache.get(key);
  if (existing) return existing;
  const pending = resolveResource(load).then(result => {
    if (result.state === "error") cache.delete(key);
    return result;
  });
  cache.set(key, pending);
  return pending;
}

export function useDefinition(code: string | null | undefined): Resource<NcsUnitResponse> {
  const [result, setResult] = useState<Resource<NcsUnitResponse>>({ state: "loading" });
  useEffect(() => {
    let active = true;
    if (!code) return;
    cached(definitions, code, () => liveApi.ncsUnit(code)).then(value => { if (active) setResult(value); });
    return () => { active = false; };
  }, [code]);
  return code ? result : { state: "error" };
}

export function useExamSessions(code: string, from: string): Resource<ExamSessionsResponse> {
  const [result, setResult] = useState<Resource<ExamSessionsResponse>>({ state: "loading" });
  useEffect(() => {
    let active = true;
    cached(exams, `${code}:${from}`, () => liveApi.examSessions(code, from)).then(value => { if (active) setResult(value); });
    return () => { active = false; };
  }, [code, from]);
  return result;
}

export function useActiveSkillRoadmap(goalId: string | null): Resource<RoadmapDetailResponse | null> {
  const [result, setResult] = useState<Resource<RoadmapDetailResponse | null>>({ state: "loading" });
  useEffect(() => {
    let active = true;
    resolveResource(async () => {
      if (!goalId) return null;
      const list = await roadmapsApi.list();
      const roadmap = list.items.find(item => item.goal_id === goalId && item.status === "ACTIVE");
      return roadmap ? roadmapsApi.get(roadmap.roadmap_id) : null;
    }).then(value => { if (active) setResult(value); });
    return () => { active = false; };
  }, [goalId]);
  return result;
}
