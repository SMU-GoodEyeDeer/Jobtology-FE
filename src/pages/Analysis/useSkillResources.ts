import { useEffect, useState } from "react";
import { liveApi, roadmapsApi } from "../../services/api";
import type { ExamSessionsResponse, NcsUnitResponse, RoadmapDetailResponse, Skill } from "../../services/types";
import { localToday, yearStart } from "../../services/skillDetail";

export type Resource<T> =
  | { readonly state: "loading" }
  | { readonly state: "ready"; readonly data: T }
  | { readonly state: "missing" }
  | { readonly state: "error" };

interface CachedResource<T> { promise: Promise<Resource<T>>; value?: Resource<T> }
const definitions = new Map<string, CachedResource<NcsUnitResponse>>();
const exams = new Map<string, CachedResource<ExamSessionsResponse>>();

async function resolveResource<T>(load: () => Promise<T>): Promise<Resource<T>> {
  try {
    return { state: "ready", data: await load() };
  } catch (error) {
    return { state: error instanceof Error && "status" in error && error.status === 404 ? "missing" : "error" };
  }
}

function cached<T>(cache: Map<string, CachedResource<T>>, key: string, load: () => Promise<T>) {
  const existing = cache.get(key);
  if (existing) return existing.promise;
  const entry: CachedResource<T> = { promise: resolveResource(load).then(result => {
    entry.value = result;
    if (result.state === "error") cache.delete(key);
    return result;
  }) };
  cache.set(key, entry);
  return entry.promise;
}

export function prefetchSkillResources(skill: Skill) {
  const from = yearStart(localToday());
  return Promise.all([
    ...(skill.ncs_base_code ? [cached(definitions, skill.ncs_base_code, () => liveApi.ncsUnit(skill.ncs_base_code!))] : []),
    ...(skill.qualifications ?? []).map(qualification => cached(exams, `${qualification.code}:${from}`, () => liveApi.examSessions(qualification.code, from))),
  ]);
}

export function useSkillEvidenceReady(skill: Skill): boolean {
  const from = yearStart(localToday());
  const key = JSON.stringify([skill.ncs_base_code, (skill.qualifications ?? []).map(qualification => qualification.code), from]);
  const cachedReady = (!skill.ncs_base_code || !!definitions.get(skill.ncs_base_code)?.value)
    && (skill.qualifications ?? []).every(qualification => !!exams.get(`${qualification.code}:${from}`)?.value);
  const [readyKey, setReadyKey] = useState<string | null>(() => cachedReady ? key : null);
  useEffect(() => {
    let active = true;
    prefetchSkillResources(skill).then(() => { if (active) setReadyKey(key); });
    return () => { active = false; };
  }, [skill, key]);
  return readyKey === key || cachedReady;
}

export function useDefinition(code: string | null | undefined): Resource<NcsUnitResponse> {
  const [result, setResult] = useState<{ code: typeof code; resource: Resource<NcsUnitResponse> } | null>(null);
  useEffect(() => {
    let active = true;
    if (!code) return;
    cached(definitions, code, () => liveApi.ncsUnit(code)).then(value => { if (active) setResult({ code, resource: value }); });
    return () => { active = false; };
  }, [code]);
  return !code ? { state: "error" } : result?.code === code ? result.resource : definitions.get(code)?.value ?? { state: "loading" };
}

export function useExamSessions(code: string, from: string): Resource<ExamSessionsResponse> {
  const key = `${code}:${from}`;
  const [result, setResult] = useState<{ key: string; resource: Resource<ExamSessionsResponse> } | null>(null);
  useEffect(() => {
    let active = true;
    cached(exams, key, () => liveApi.examSessions(code, from)).then(value => { if (active) setResult({ key, resource: value }); });
    return () => { active = false; };
  }, [code, from, key]);
  return result?.key === key ? result.resource : exams.get(key)?.value ?? { state: "loading" };
}

export function useActiveSkillRoadmap(goalId: string | null): Resource<RoadmapDetailResponse | null> {
  const [result, setResult] = useState<{ goalId: string | null; resource: Resource<RoadmapDetailResponse | null> } | null>(null);
  useEffect(() => {
    let active = true;
    resolveResource(async () => {
      if (!goalId) return null;
      const list = await roadmapsApi.list();
      const roadmap = list.items.find(item => item.goal_id === goalId && item.status === "ACTIVE");
      return roadmap ? roadmapsApi.get(roadmap.roadmap_id) : null;
    }).then(value => { if (active) setResult({ goalId, resource: value }); });
    return () => { active = false; };
  }, [goalId]);
  return result?.goalId === goalId ? result.resource : { state: "loading" };
}
