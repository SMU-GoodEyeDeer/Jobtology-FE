import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../Home/Home.css";
import "./Analysis.css";
import { AppSidebar } from "../../components/AppSidebar";
import { GoalDropdown } from "../../components/GoalDropdown";
import { LoadingContent } from "../../components/LoadingContent";
import chevronDownIcon from "../../assets/Chevron down.svg";
import { analysisApi, profileApi, dashboardApi } from "../../services/api";
import { isAnalyzableGoal, requiresActiveTargetedGoal } from "../../services/analysisGoal";
import { useGoals } from "../../hooks/useGoals";
import { useSession } from "../../context/SessionContext";
import type { AnalysisResponse } from "../../services/types";
import { SkillList } from "./SkillList";
import { AnalysisPublications } from "./AnalysisPublications";

type PollState = "idle" | "pending" | "running" | "completed" | "failed" | "goal_required";

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 100;

export function Analysis() {
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();

  useEffect(() => {
    if (!sessionLoading && !session) navigate("/");
  }, [session, sessionLoading, navigate]);
  const [goalOpen, setGoalOpen] = useState(false);
  const goalRef = useRef<HTMLDivElement>(null);

  const { goals, selectedGoal, selectedGoalId, setSelectedGoalId, selectedGoalName, getGoalName, loading: goalsLoading, error: goalsError, refresh: refreshGoals } = useGoals();
  const analyzableGoalId = isAnalyzableGoal(selectedGoal) ? selectedGoalId : null;
  const activeTargetedGoal = goals.find(isAnalyzableGoal);
  const [publicationsLoading, setPublicationsLoading] = useState(true);

  const [pollState, setPollState] = useState<PollState>("idle");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysisRun = useRef(0);

  // Trigger analysis for selected goal
  const triggerAnalysis = useCallback(async (run = analysisRun.current) => {
    if (goalsLoading || goalsError) return;
    if (!analyzableGoalId) { setPollState("goal_required"); return; }
    setPollState("pending");
    try {
      const profile = await profileApi.get();
      if (run !== analysisRun.current) return;
      const res = await analysisApi.create({
        goal_id: analyzableGoalId,
        expected_profile_version: profile.version,
        basis_type: "EDITORIAL",
      });
      if (run === analysisRun.current) pollForResult(res.recompute_request_id, run);
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      // 409 = version/idempotency conflict; a stored or running analysis may still exist
      if (run !== analysisRun.current) return;
      if (requiresActiveTargetedGoal(err)) { setAnalysisResult(null); setPollState("goal_required"); return; }
      const shown = status === 409 && await showStoredAnalysis(analyzableGoalId, run).catch(() => false);
      if (!shown && run === analysisRun.current) setPollState("failed");
    }
  }, [analyzableGoalId, goalsLoading, goalsError]);

  function pollForResult(recomputeId: string, run: number) {
    setPollState("running");
    let attempts = 0;
    const poll = async () => {
      if (run !== analysisRun.current) return;
      attempts += 1;
      try {
        const res = await analysisApi.poll(recomputeId);
        if (run !== analysisRun.current) return;
        if (res.state === "COMPLETED" && res.analysis_id) {
          const result = await analysisApi.get(res.analysis_id);
          if (run !== analysisRun.current) return;
          setAnalysisResult(result);
          setPollState("completed");
        } else if (res.state === "FAILED" || attempts >= POLL_MAX_ATTEMPTS) {
          setPollState("failed");
        } else {
          pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch {
        if (run === analysisRun.current) setPollState("failed");
      }
    };
    poll();
  }

  async function showStoredAnalysis(goalId: string, run: number): Promise<boolean> {
    const dashboard = await dashboardApi.get(goalId);
    if (run !== analysisRun.current) return true;
    if (dashboard.state === "READY" && dashboard.analysis_id) {
      const result = await analysisApi.get(dashboard.analysis_id);
      if (run !== analysisRun.current) return true;
      setAnalysisResult(result);
      setPollState("completed");
      return true;
    }
    if (dashboard.state === "RECOMPUTING" && dashboard.recompute_request_id) {
      pollForResult(dashboard.recompute_request_id, run);
      return true;
    }
    return false;
  }

  // Show the stored analysis first; only compute when none exists yet. Profile,
  // capability, and preference changes already trigger a recompute on the server.
  const loadAnalysis = useCallback(async () => {
    if (goalsLoading || goalsError) { setPollState("idle"); return; }
    if (!analyzableGoalId) { setPollState("goal_required"); return; }
    const run = analysisRun.current;
    setPollState("pending");
    try {
      if (await showStoredAnalysis(analyzableGoalId, run)) return;
    } catch (err) {
      console.warn("Stored analysis lookup failed:", err);
    }
    if (run === analysisRun.current) await triggerAnalysis(run);
  }, [analyzableGoalId, goalsLoading, goalsError, triggerAnalysis]);

  useEffect(() => {
    analysisRun.current += 1;
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setAnalysisResult(null);
    loadAnalysis();
    return () => { analysisRun.current += 1; if (pollTimerRef.current) clearTimeout(pollTimerRef.current); };
  }, [loadAnalysis]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (goalRef.current && !goalRef.current.contains(e.target as Node)) {
        setGoalOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const skills = analysisResult?.result?.skills ?? [];
  const required_pct = analysisResult?.result?.required_pct ?? null;
  const preferred_pct = analysisResult?.result?.preferred_pct ?? null;
  const showGoalSetup = !goalsLoading && !goalsError && (!analyzableGoalId || pollState === "goal_required");

  return (
    <div className="home-layout analysis-page">
      {/* Sidebar */}
      <AppSidebar>
        <div className="satisfaction-card">
          <p className="satisfaction-title">{selectedGoalName} 충족률</p>
          <div className="satisfaction-row">
            <span className="satisfaction-label">필수 역량</span>
            <span className="satisfaction-pct">{required_pct != null ? `${required_pct}%` : "—"}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill progress-fill--blue" style={{ width: `${required_pct ?? 0}%` }} />
          </div>
          <div className="satisfaction-row" style={{ marginTop: "10px" }}>
            <span className="satisfaction-label">우대 역량</span>
            <span className="satisfaction-pct">{preferred_pct != null ? `${preferred_pct}%` : "—"}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill progress-fill--green" style={{ width: `${preferred_pct ?? 0}%` }} />
          </div>
        </div>
      </AppSidebar>

      {/* Main area */}
      <div className="main-area">
        <header className="main-header">
          <h2 className="main-title">역량 분석</h2>
          <button
            className="an-reanalyze-btn"
            onClick={() => void triggerAnalysis()}
            disabled={!analyzableGoalId || !!goalsError || goalsLoading || pollState === "goal_required" || pollState === "pending" || pollState === "running"}
          >
            다시 분석하기
          </button>
          <div className="goal-wrapper" ref={goalRef}>
            <button className="goal-button" aria-expanded={goalOpen} aria-controls="goal-dropdown" onClick={() => setGoalOpen((v) => !v)}>
              {selectedGoalName}
              <img src={chevronDownIcon} alt="▾" className="goal-arrow" />
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
          {goalsError && <section className="an-error-banner" role="alert">{goalsError}<button className="an-retry-btn" onClick={() => void refreshGoals().catch(() => {})}>목표 목록 다시 불러오기</button></section>}
          {showGoalSetup && <section className="an-goal-setup" aria-labelledby="an-goal-setup-title">
            <h3 id="an-goal-setup-title">분석할 목표 직무를 설정해 주세요</h3>
            <p>역량 분석에는 직무가 정해진 활성 목표가 필요해요. 목표를 추가하거나 탐색 중인 목표의 직무를 정한 뒤 활성화해 주세요.</p>
            <div className="an-goal-setup-actions"><Link className="an-goto-roadmap-btn" to="/myinfo#goals">목표 설정하기 →</Link>
              {activeTargetedGoal && activeTargetedGoal.goal_id !== selectedGoalId && <button className="an-retry-btn" onClick={() => setSelectedGoalId(activeTargetedGoal.goal_id)}>활성 목표 선택</button>}
              <button className="an-retry-btn" onClick={() => void refreshGoals().catch(() => {})}>목표 목록 새로고침</button>
            </div>
          </section>}
          <LoadingContent loading={goalsLoading || (!showGoalSetup && !goalsError && (publicationsLoading || (analyzableGoalId !== null && ["idle", "pending", "running"].includes(pollState))))}
            label="역량 분석 정보를 불러오는 중이에요">
          {!showGoalSetup && !goalsError && <>
          {/* 분석 상태 배너 */}
          {pollState === "pending" || pollState === "running" ? (
            <div className="an-loading-banner">
              역량 분석 중이에요... 잠시만 기다려주세요.
            </div>
          ) : pollState === "failed" ? (
            <div className="an-error-banner">
              분석 중 오류가 발생했어요.
              <button className="an-retry-btn" onClick={() => void triggerAnalysis()}>다시 시도</button>
            </div>
          ) : null}

          {/* 충족률 card */}
          <section className="an-fulfillment-card">
            <p className="an-fulfillment-title">{selectedGoalName} 충족률</p>
            <div className="an-fulfillment-body">
              <div className="an-fulfillment-half">
                <p className="an-half-label">필수 역량</p>
                <p className="an-fulfillment-pct">{required_pct != null ? `${required_pct}%` : "—"}</p>
                <p className="an-fulfillment-sub">거의 모든 공고가 요구하는 역량</p>
                <div className="progress-bar">
                  <div className="progress-fill progress-fill--blue" style={{ width: `${required_pct ?? 0}%` }} />
                </div>
              </div>
              <div className="an-fulfillment-divider" />
              <div className="an-fulfillment-half">
                <p className="an-half-label">우대 역량</p>
                <p className="an-fulfillment-pct an-fulfillment-pct--green">{preferred_pct != null ? `${preferred_pct}%` : "—"}</p>
                <p className="an-fulfillment-sub">있으면 유리한 역량</p>
                <div className="progress-bar">
                  <div className="progress-fill progress-fill--green" style={{ width: `${preferred_pct ?? 0}%` }} />
                </div>
              </div>
            </div>
          </section>

          <SkillList key={selectedGoalId ?? "no-goal"} skills={skills} goalId={selectedGoalId}
            emptyMessage={pollState === "completed"
                  ? "분석 결과가 없어요. 역량을 먼저 등록해보세요."
                  : pollState === "idle"
                  ? "목표를 선택하면 분석이 시작돼요."
                  : pollState === "failed"
                  ? "분석 결과를 불러오지 못했어요. 위의 '다시 시도'를 눌러주세요."
                  : "분석 결과를 가져오는 중이에요..."} />
          <AnalysisPublications onLoadingChange={setPublicationsLoading} />

          <div className="an-bottom-actions">
            <button className="an-goto-roadmap-btn" onClick={() => navigate("/roadmap")}>
              로드맵으로
            </button>
          </div>
          </>}
          </LoadingContent>
        </main>
      </div>
    </div>
  );
}
