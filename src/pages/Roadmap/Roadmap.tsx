import { GoalArrow } from "../../components/GoalArrow";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../Home/Home.css";
import "./Roadmap.css";
import { AppSidebar } from "../../components/AppSidebar";
import { GoalDropdown } from "../../components/GoalDropdown";
import { LoadingContent } from "../../components/LoadingContent";
import { profileApi, roadmapsApi, catalogV2Api } from "../../services/api";
import { useGoals } from "../../hooks/useGoals";
import { useRoadmap } from "../../hooks/useRoadmap";
import { PARTIAL_ROUTE_NOTICE, usePartialRoute } from "./usePartialRoute";
import { useSession } from "../../context/SessionContext";
import { RoadmapPlan } from "./RoadmapPlan";
import { LegacyRoadmap } from "./LegacyRoadmap";
import { RoadmapExtras } from "./RoadmapExtras";
import { useRoutePreferences } from "./useRoutePreferences";
import type { StepState, Neo4jPublicationResponse } from "../../services/types";

const CONDITION_CHIP_KEYS = [
  { label: "교육비 부담이 커요", field: "budget_mode" as const },
  { label: "최대한 빨리 취업하고 싶어요", field: "fastest_path" as const },
  { label: "포트폴리오 프로젝트를 우선하고 싶어요", field: "needs_portfolio" as const },
  { label: "기초 학습을 우선하고 싶어요", field: "career_switch" as const },
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

  const prefs = useRoutePreferences(session?.user_id, !sessionLoading);

  // v2 publications (route_planning 가능한 것만)
  const [routePublications, setRoutePublications] = useState<Neo4jPublicationResponse[]>([]);

  useEffect(() => {
    catalogV2Api.listPublications({ limit: 100 }).then((list) => {
      setRoutePublications(list.filter((p) => p.capabilities.route_planning));
    }).catch(console.error).finally(() => setPublicationsLoading(false));
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
            <button className="goal-button" aria-expanded={goalOpen} aria-controls="goal-dropdown" onClick={() => setGoalOpen((v) => !v)}>
              {selectedGoalName}
              <GoalArrow />
            </button>
            <GoalDropdown open={goalOpen}>
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
            </GoalDropdown>
          </div>
        </header>

        <main className="main-content">
          <LoadingContent loading={goalsLoading || loading || publicationsLoading || proposalLoading || (!!activeRoadmap && readyPlanId !== activeRoadmap.roadmap_id)} label="로드맵과 주차 플랜을 불러오는 중이에요">
          {/* 내 로드맵 조건 */}
          <section className="rm-section">
            <div className="rm-section-header">
              <p className="rm-section-title">내 로드맵 조건</p>
              <span className="sr-only" role="status">{prefs.saving ? "저장 중..." : prefs.loading ? "조건을 불러오는 중..." : ""}</span>
            </div>
            <div className="rm-chips">
              {CONDITION_CHIP_KEYS.map(({ label, field }) => {
                const active = field === "budget_mode" ? prefs.preferences?.budget_mode === "LOW_COST" : !!prefs.preferences?.[field];
                return (
                <button
                  key={label}
                  className={`rm-chip ${active ? "rm-chip--active" : ""}`}
                  onClick={() => void prefs.toggle(field)}
                  disabled={prefs.saving || prefs.loading || !prefs.preferences}
                  aria-pressed={active}
                >
                  <span className="rm-chip-dot" />
                  {label}
                </button>
              ); })}
            </div>
            {prefs.preferences && <p className="rm-card-sub">추천 경로 계산 기준 주 {prefs.preferences.available_hours_per_week}시간 · 개별 주차 플랜의 시간은 ‘플랜 수정’에서 따로 조정해요.</p>}
            <p className="rm-card-sub">비용 미반영 · 기본 비용 0원으로 계산</p>
            {prefs.error && <div className="rm-card-sub" role="alert"><p>{prefs.error}</p><button className="rm-bottom-btn" disabled={prefs.loading || prefs.saving} onClick={prefs.retry}>조건 다시 불러오기</button></div>}
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
              <p style={{ color: "var(--muted)", marginBottom: 16 }}>아직 로드맵이 없어요.</p>
              <p style={{ color: "var(--tertiary)", fontSize: 14 }}>역량 분석 후 AI가 로드맵을 생성해드려요.</p>
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
