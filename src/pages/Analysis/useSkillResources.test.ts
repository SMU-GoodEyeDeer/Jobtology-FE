import { afterEach, describe, expect, it, vi } from "vitest";
import { liveApi } from "../../services/api";
import type { NcsUnitResponse, Skill } from "../../services/types";
import { prefetchSkillResources } from "./useSkillResources";

afterEach(() => vi.restoreAllMocks());

const definition: NcsUnitResponse = { contract_version: "1", sources: [], item: { base_code: "test", code: "test", name: "역량", level: null, definition: "정의" } };

describe("skill evidence prefetch", () => {
  it("starts definitions and exam schedules together and shares in-flight requests", async () => {
    let finish!: (result: NcsUnitResponse) => void;
    const ncs = vi.spyOn(liveApi, "ncsUnit").mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const exams = vi.spyOn(liveApi, "examSessions").mockResolvedValue({ items: [], total: 0 });
    const skill: Skill = { name: "테스트", type: "필수", ncs_base_code: "parallel", qualifications: [{ code: "exam-parallel", name: null }] };
    const first = prefetchSkillResources(skill);
    const second = prefetchSkillResources(skill);
    expect(ncs).toHaveBeenCalledTimes(1);
    expect(exams).toHaveBeenCalledTimes(1);
    finish(definition);
    await Promise.all([first, second]);
    await prefetchSkillResources(skill);
    expect(ncs).toHaveBeenCalledTimes(1);
    expect(exams).toHaveBeenCalledTimes(1);
  });

  it("retries transient errors on a later visit", async () => {
    const ncs = vi.spyOn(liveApi, "ncsUnit").mockRejectedValueOnce(new Error("offline")).mockResolvedValue(definition);
    const skill: Skill = { name: "다시 시도", type: "필수", ncs_base_code: "retry" };
    await prefetchSkillResources(skill);
    await prefetchSkillResources(skill);
    expect(ncs).toHaveBeenCalledTimes(2);
  });

  it("remembers missing definitions instead of repeatedly requesting them", async () => {
    const ncs = vi.spyOn(liveApi, "ncsUnit").mockRejectedValue(Object.assign(new Error("missing"), { status: 404 }));
    const skill: Skill = { name: "정의 없음", type: "우대", ncs_base_code: "missing" };
    await prefetchSkillResources(skill);
    await prefetchSkillResources(skill);
    expect(ncs).toHaveBeenCalledTimes(1);
  });
});
