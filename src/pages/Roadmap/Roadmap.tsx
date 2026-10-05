import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../Home/Home.css";
import "./Roadmap.css";
import logoIcon from "../../assets/logo1.svg";
import homeIcon from "../../assets/Home .svg";
import chatIcon from "../../assets/Message circle.svg";
import roadmapIcon from "../../assets/Trending up.svg";
import analysisIcon from "../../assets/Bar chart.svg";
import progressIcon from "../../assets/today.svg";
import userIcon from "../../assets/User.svg";
import chevronDownIcon from "../../assets/Chevron down.svg";
import { routePrefsApi, profileApi, roadmapsApi, catalogV2Api, authApi } from "../../services/api";
import { useGoals } from "../../hooks/useGoals";
import { useRoadmap } from "../../hooks/useRoadmap";
import { PARTIAL_ROUTE_NOTICE, usePartialRoute } from "./usePartialRoute";
import { useSession } from "../../context/SessionContext";
import type { StepState, Neo4jPublicationResponse } from "../../services/types";

const NAV_ITEMS = [
  { icon: homeIcon, label: "홈", path: "/home" },
  { icon: chatIcon, label: "AI 커리어 챗봇", path: "/chat" },
  { icon: roadmapIcon, label: "내 로드맵", path: "/roadmap" },
  { icon: analysisIcon, label: "역량 분석", path: "/analysis" },
  { icon: progressIcon, label: "진행 상황", path: "/progress" },
  { icon: userIcon, label: "내 정보", path: "/myinfo" },
];

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
  const [activeNav, setActiveNav] = useState("내 로드맵");

  useEffect(() => {
    if (!sessionLoading && !session) navigate("/");
  }, [session, sessionLoading, navigate]);
  const [goalOpen, setGoalOpen] = useState(false);
  const goalRef = useRef<HTMLDivElement>(null);

  const { goals, selectedGoalId, setSelectedGoalId, selectedGoalName, getGoalName } = useGoals();
  const { roadmaps, activeRoadmap, loading, updateStepState, progressPct, refetch } = useRoadmap(selectedGoalId);

  const [activeChips, setActiveChips] = useState<Set<string>>(new Set());
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [editingRoadmapId, setEditingRoadmapId] = useState<string | null>(null);

  // v2 publications (route_planning 가능한 것만)
  const [routePublications, setRoutePublications] = useState<Neo4jPublicationResponse[]>([]);

  useEffect(() => {
    catalogV2Api.listPublications({ limit: 100 }).then((list) => {
      setRoutePublications(list.filter((p) => p.capabilities.route_planning));
    }).catch(console.error);
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

  const isPartialRoute = usePartialRoute(activeRoadmap?.proposal_id ?? null);
  const completedSteps = activeRoadmap?.steps.filter((s) => s.state === "COMPLETED").length ?? 0;
  const totalSteps = activeRoadmap?.steps.length ?? 0;

  return (
    <div className="home-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src={logoIcon} alt="로고" className="sidebar-logo-icon" />
          <span className="sidebar-logo-text">커리어 내비게이션</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ icon, label, path }) => (
            <button
              key={label}
              className={`nav-item ${activeNav === label ? "nav-item--active" : ""}`}
              onClick={() => { setActiveNav(label); if (path) navigate(path); }}
            >
              <img src={icon} alt={label} className="nav-icon" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
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
          <button className="sidebar-logout-btn" onClick={async () => { await authApi.logout(); navigate("/"); }}>
            로그아웃
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="main-area">
        <header className="main-header">
          <h2 className="main-title">내 로드맵</h2>
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
          {/* 내 로드맵 조건 */}
          <section className="rm-section">
            <div className="rm-section-header">
              <p className="rm-section-title">내 로드맵 조건</p>
              <p className="rm-section-sub">
                아래 조건을 바꾸면 경로가 다시 계산돼요.
                {savingPrefs && <span style={{ color: "#6b7280", marginLeft: 8 }}>저장 중...</span>}
              </p>
            </div>
            <div className="rm-chips">
              {CONDITION_CHIP_KEYS.map(({ label }) => (
                <button
                  key={label}
                  className={`rm-chip ${activeChips.has(label) ? "rm-chip--active" : ""}`}
                  onClick={() => toggleChip(label)}
                  disabled={savingPrefs}
                >
                  <span className="rm-chip-dot" />
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* 활성 로드맵 */}
          {loading ? (
            <div className="rm-card" style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>
              로드맵을 불러오는 중...
            </div>
          ) : activeRoadmap ? (
            <section className="rm-card">
              <div className="rm-card-header">
                <div className="rm-card-title-row">
                  <span className="rm-card-title">{activeRoadmap.title}</span>
                  <span className="rm-badge rm-badge--profile">활성</span>
                </div>
              </div>
              <p className="rm-card-sub">
                {completedSteps}/{totalSteps}단계 완료 · {progressPct}% 진행
              </p>
              {isPartialRoute && <p className="rm-card-sub" role="note">{PARTIAL_ROUTE_NOTICE}</p>}

              {activeRoadmap.steps.map((step) => (
                <div
                  key={step.step_id}
                  className={`rm-step-item ${step.state === "IN_PROGRESS" ? "rm-step-item--current" : ""}`}
                >
                  <div className="rm-step-top">
                    <div className="rm-step-left">
                      <span className="rm-step-name">{step.title}</span>
                      {step.state === "COMPLETED" && (
                        <span className="rm-badge rm-badge--done">완료</span>
                      )}
                      {step.state === "IN_PROGRESS" && (
                        <span className="rm-badge rm-badge--now">진행 중</span>
                      )}
                    </div>
                  </div>
                  {step.description && (
                    <p className="rm-step-desc">{step.description}</p>
                  )}
                  {step.state !== "COMPLETED" ? (
                    <button
                      className="rm-complete-btn"
                      onClick={() => handleStepComplete(step.step_id, step.state)}
                    >
                      완료했어요
                    </button>
                  ) : (
                    <button
                      className="rm-complete-btn"
                      style={{ background: "#e5e7eb", color: "#6b7280" }}
                      onClick={() => handleStepComplete(step.step_id, step.state)}
                    >
                      완료 취소
                    </button>
                  )}
                </div>
              ))}
            </section>
          ) : (
            <section className="rm-card" style={{ padding: 32, textAlign: "center" }}>
              <p style={{ color: "#6b7280", marginBottom: 16 }}>아직 로드맵이 없어요.</p>
              <p style={{ color: "#9ca3af", fontSize: 14 }}>역량 분석 후 AI가 로드맵을 생성해드려요.</p>
            </section>
          )}

          {/* 저장한 커리어 경로 (모든 로드맵 목록) */}
          {roadmaps.length > 0 && (
            <section className="rm-card">
              <div className="rm-saved-header">
                <p className="rm-section-title">저장한 커리어 경로</p>
                <p className="rm-section-sub">저장된 모든 로드맵이에요.</p>
              </div>
              {roadmaps.map((rm) => (
                <div key={rm.roadmap_id} className="rm-saved-card">
                  <div className="rm-saved-top">
                    <div>
                      <span className={`rm-badge ${rm.status === "ACTIVE" ? "rm-badge--profile" : ""}`}>
                        {rm.status}
                      </span>
                      <div className="rm-saved-title-row">
                        <p className="rm-saved-title">{rm.title}</p>
                        <button
                          className="rm-edit-btn"
                          onClick={() =>
                            setEditingRoadmapId(editingRoadmapId === rm.roadmap_id ? null : rm.roadmap_id)
                          }
                        >
                          {editingRoadmapId === rm.roadmap_id ? "완료" : "편집"}
                        </button>
                      </div>
                    </div>
                  </div>
                  {editingRoadmapId === rm.roadmap_id && rm.status !== "ARCHIVED" && (
                    <div className="rm-saved-actions">
                      <button
                        className="rm-saved-btn rm-saved-btn--delete"
                        onClick={() => handleArchiveRoadmap(rm.roadmap_id, rm.version)}
                      >
                        보관
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* 로드맵 활용 가능한 학습 자료 */}
          {routePublications.length > 0 && (
            <section className="rm-card">
              <div className="rm-saved-header">
                <p className="rm-section-title">활용 가능한 학습 자료</p>
                <p className="rm-section-sub">로드맵 경로 계획에 활용할 수 있는 자료예요.</p>
              </div>
              {routePublications.map((pub) => (
                <div key={pub.publication_id} className="rm-saved-card">
                  <div className="rm-saved-top">
                    <div>
                      <span className={`rm-badge ${pub.source_state === "ACTIVE" ? "rm-badge--profile" : ""}`}>
                        {pub.source_state}
                      </span>
                      <div className="rm-saved-title-row">
                        <p className="rm-saved-title" style={{ fontSize: 13 }}>{pub.publication_id}</p>
                        <div style={{ display: "flex", gap: 4 }}>
                          {pub.capabilities.editorial_analysis && (
                            <span className="rm-badge" style={{ fontSize: 11 }}>역량 분석</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          <div className="rm-bottom-btns">
            <button className="rm-bottom-btn" onClick={() => navigate("/analysis")}>부족한 역량 보기</button>
            <button className="rm-bottom-btn" onClick={() => navigate("/progress")}>내 진행 상황</button>
          </div>
        </main>
      </div>
    </div>
  );
}
