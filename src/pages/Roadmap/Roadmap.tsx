import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../Home/Home.css";
import "./Roadmap.css";
import { AppSidebar } from "../../components/AppSidebar";
import { LoadingContent } from "../../components/LoadingContent";
import chevronDownIcon from "../../assets/Chevron down.svg";
import { routePrefsApi, profileApi, roadmapsApi, catalogV2Api } from "../../services/api";
import { useGoals } from "../../hooks/useGoals";
import { useRoadmap } from "../../hooks/useRoadmap";
import { PARTIAL_ROUTE_NOTICE, usePartialRoute } from "./usePartialRoute";
import { useSession } from "../../context/SessionContext";
import { RoadmapPlan } from "./RoadmapPlan";
import { LegacyRoadmap } from "./LegacyRoadmap";
import { RoadmapExtras } from "./RoadmapExtras";
import type { StepState, Neo4jPublicationResponse } from "../../services/types";

const CONDITION_CHIP_KEYS = [
  { label: "교육비 부담이 커요", field: "budget_mode" as const },
  { label: "학업·알바와 병행해야 해요", field: "limited_hours" as const },
  { label: "최대한 빨리 취업하고 싶어요", field: "fastest_path" as const },
  { label: "내세울 프로젝트·경험이 부족해요", field: "needs_portfolio" as const },
  { label: "전공과 다른 직무로 가려고 해요", field: "career_switch" as const },
];

export function Roadmap() {
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();

  useEffect(() => {
    if (!sessionLoading && !session) navigate("/");
  }, [session, sessionLoading, navigate]);
  const [goalOpen, setGoalOpen] = useState(false);
  const goalRef = useRef<HTMLDivElement>(null);

  const { goals, selectedGoalId, setSelectedGoalId, selectedGoalName, getGoalName, loading: goalsLoading } = useGoals();
  const { roadmaps, activeRoadmap, loading, error, updateStepState, progressPct, refetch } = useRoadmap(selectedGoalId, !goalsLoading);
  const [readyPlanId, setReadyPlanId] = useState<string | null>(null);
  const [publicationsLoading, setPublicationsLoading] = useState(true);

  const [activeChips, setActiveChips] = useState<Set<string>>(new Set());
  const [savingPrefs, setSavingPrefs] = useState(false);

  // v2 publications (route_planning 가능한 것만)
  const [routePublications, setRoutePublications] = useState<Neo4jPublicationResponse[]>([]);

  useEffect(() => {
    catalogV2Api.listPublications({ limit: 100 }).then((list) => {
      setRoutePublications(list.filter((p) => p.capabilities.route_planning));
    }).catch(console.error).finally(() => setPublicationsLoading(false));
  }, []);

  // Load route preferences to populate chips
  useEffect(() => {
    routePrefsApi.get().then((prefs) => {
      const active = new Set<string>();
      if (prefs.budget_mode === "LOW_COST") active.add("교육비 부담이 커요");
      if (prefs.available_hours_per_week <= 15) active.add("학업·알바와 병행해야 해요");
      if (prefs.fastest_path) active.add("최대한 빨리 취업하고 싶어요");
      if (prefs.needs_portfolio) active.add("내세울 프로젝트·경험이 부족해요");
      if (prefs.career_switch) active.add("전공과 다른 직무로 가려고 해요");
      setActiveChips(active);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (goalRef.current && !goalRef.current.contains(e.target as Node)) {
        setGoalOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function toggleChip(chip: string) {
    const next = new Set(activeChips);
    if (next.has(chip)) next.delete(chip);
    else next.add(chip);
    setActiveChips(next);

    // Save immediately to route-preferences
    setSavingPrefs(true);
    try {
      const profile = await profileApi.get();
      const currentPrefs = await routePrefsApi.get();
      await routePrefsApi.update({
        expected_profile_version: profile.version,
        available_hours_per_week: next.has("학업·알바와 병행해야 해요") ? 10 : currentPrefs.available_hours_per_week,
        availability_source: "roadmap_ui",
        budget_mode: next.has("교육비 부담이 커요") ? "LOW_COST" : "REGULAR",
        fastest_path: next.has("최대한 빨리 취업하고 싶어요"),
        needs_portfolio: next.has("내세울 프로젝트·경험이 부족해요"),
        career_switch: next.has("전공과 다른 직무로 가려고 해요"),
        ...(currentPrefs.max_out_of_pocket_krw != null ? { max_out_of_pocket_krw: currentPrefs.max_out_of_pocket_krw } : {}),
      });
    } catch (err) {
      console.error("Failed to save preferences:", err);
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handleStepComplete(stepId: string, currentState: StepState) {
    const nextState: StepState = currentState === "COMPLETED" ? "TODO" : "COMPLETED";
    await updateStepState(stepId, nextState);
  }

  async function handleArchiveRoadmap(roadmapId: string, version: number) {
    try {
      const profile = await profileApi.get();
      await roadmapsApi.update(roadmapId, {
        operation: "ARCHIVE",
        expected_roadmap_version: version,
        expected_profile_version: profile.version,
      });
      refetch();
    } catch (err) {
      console.error("Failed to archive roadmap:", err);
    }
  }

  const { partial: isPartialRoute, loading: proposalLoading } = usePartialRoute(activeRoadmap?.proposal_id ?? null);
  const completedSteps = activeRoadmap?.steps.filter((s) => s.state === "COMPLETED").length ?? 0;
  const totalSteps = activeRoadmap?.steps.length ?? 0;

  return (
    <div className="home-layout roadmap-page">
      {/* Sidebar */}
      <AppSidebar>
        <div className="satisfaction-card">
          <p className="satisfaction-title">{selectedGoalName} 진행률</p>
          <div className="satisfaction-row">
            <span className="satisfaction-label">로드맵 진행</span>
            <span className="satisfaction-pct">{progressPct}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill progress-fill--blue" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </AppSidebar>

      {/* Main area */}
      <div className="main-area">
        <header className="main-header">
          <div className="rm-heading"><h2 className="main-title">내 로드맵</h2>
            <p className="rm-heading-sub">{activeRoadmap ? `${activeRoadmap.title} · ${completedSteps}/${totalSteps}단계 완료` : "목표에 맞는 학습 계획을 확인하세요"}</p>
          </div>
          <div className="goal-wrapper" ref={goalRef}>
            <button className="goal-button" onClick={() => setGoalOpen((v) => !v)}>
              {selectedGoalName}
              <img src={chevronDownIcon} alt="▾" className="goal-arrow" />
            </button>
            {goalOpen && (
              <div className="goal-dropdown">
                {goals.map((goal) => (
                  <div
                    key={goal.goal_id}
                    className={`goal-dropdown-item${selectedGoalId === goal.goal_id ? " selected" : ""}`}
                    onClick={() => { setSelectedGoalId(goal.goal_id); setGoalOpen(false); }}
                  >
                    <span>{getGoalName(goal)}</span>
                    <span className="goal-dropdown-count">{goal.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </header>

        <main className="main-content">
          <LoadingContent loading={goalsLoading || loading || publicationsLoading || proposalLoading || (!!activeRoadmap && readyPlanId !== activeRoadmap.roadmap_id)} label="로드맵과 주차 플랜을 불러오는 중이에요">
          {/* 내 로드맵 조건 */}
          <section className="rm-section">
            <div className="rm-section-header">
              <p className="rm-section-title">내 로드맵 조건</p>
              {savingPrefs && <p className="rm-section-sub" role="status">저장 중...</p>}
            </div>
            <div className="rm-chips">
              {CONDITION_CHIP_KEYS.map(({ label }) => (
                <button
                  key={label}
                  className={`rm-chip ${activeChips.has(label) ? "rm-chip--active" : ""}`}
                  onClick={() => toggleChip(label)}
                  disabled={savingPrefs}
                  aria-pressed={activeChips.has(label)}
                >
                  <span className="rm-chip-dot" />
                  {label}
                </button>
              ))}
            </div>
          </section>

          {isPartialRoute && <p className="rm-card-sub" role="note">{PARTIAL_ROUTE_NOTICE}</p>}
          {error ? (
            <div className="rm-card" role="alert"><p>로드맵을 불러오지 못했어요.</p><button className="rm-bottom-btn" onClick={() => void refetch()}>다시 시도</button></div>
          ) : activeRoadmap ? (
            <RoadmapPlan key={activeRoadmap.roadmap_id} roadmapId={activeRoadmap.roadmap_id} goalId={activeRoadmap.goal_id} onComplete={handleStepComplete} onReady={setReadyPlanId}>
              <LegacyRoadmap roadmap={activeRoadmap} onComplete={handleStepComplete} />
            </RoadmapPlan>
          ) : (
            <section className="rm-card" style={{ padding: 32, textAlign: "center" }}>
              <p style={{ color: "#6b7280", marginBottom: 16 }}>아직 로드맵이 없어요.</p>
              <p style={{ color: "#9ca3af", fontSize: 14 }}>역량 분석 후 AI가 로드맵을 생성해드려요.</p>
            </section>
          )}

          <RoadmapExtras roadmaps={roadmaps} publications={routePublications} onArchive={handleArchiveRoadmap} />

          <div className="rm-bottom-btns">
            <button className="rm-bottom-btn" onClick={() => navigate("/analysis")}>부족한 역량 보기</button>
            <button className="rm-bottom-btn" onClick={() => navigate("/progress")}>내 진행 상황</button>
          </div>
          </LoadingContent>
        </main>
      </div>
    </div>
  );
}
