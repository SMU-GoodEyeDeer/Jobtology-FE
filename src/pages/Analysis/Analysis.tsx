import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../Home/Home.css";
import "./Analysis.css";
import logoIcon from "../../assets/logo1.svg";
import homeIcon from "../../assets/Home .svg";
import chatIcon from "../../assets/Message circle.svg";
import roadmapIcon from "../../assets/Trending up.svg";
import analysisIcon from "../../assets/Bar chart.svg";
import progressIcon from "../../assets/today.svg";
import userIcon from "../../assets/User.svg";
import chevronDownIcon from "../../assets/Chevron down.svg";
import { analysisApi, profileApi } from "../../services/api";
import { useGoals } from "../../hooks/useGoals";
import type { AnalysisResponse } from "../../services/types";

const NAV_ITEMS = [
  { icon: homeIcon, label: "홈", path: "/home" },
  { icon: chatIcon, label: "AI 커리어 챗봇", path: "/chat" },
  { icon: roadmapIcon, label: "내 로드맵", path: "/roadmap" },
  { icon: analysisIcon, label: "역량 분석", path: "/analysis" },
  { icon: progressIcon, label: "진행 상황", path: "/progress" },
  { icon: userIcon, label: "내 정보", path: "/myinfo" },
];

type PollState = "idle" | "pending" | "running" | "completed" | "failed";

export function Analysis() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("역량 분석");
  const [goalOpen, setGoalOpen] = useState(false);
  const goalRef = useRef<HTMLDivElement>(null);

  const { goals, selectedGoalId, setSelectedGoalId, selectedGoalName, getGoalName } = useGoals();

  const [pollState, setPollState] = useState<PollState>("idle");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trigger analysis for selected goal
  const triggerAnalysis = useCallback(async () => {
    if (!selectedGoalId) return;
    setPollState("pending");
    try {
      const profile = await profileApi.get();
      const res = await analysisApi.create({
        goal_id: selectedGoalId,
        expected_profile_version: profile.version,
        basis_type: "EDITORIAL",
      });
      pollForResult(res.recompute_request_id);
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      // 409 = already computing or result exists — try fetching existing
      if (status === 409) {
        setPollState("completed");
      } else {
        setPollState("failed");
      }
    }
  }, [selectedGoalId]);

  function pollForResult(recomputeId: string) {
    setPollState("running");
    const poll = async () => {
      try {
        const res = await analysisApi.poll(recomputeId);
        if (res.state === "COMPLETED" && res.analysis_id) {
          const result = await analysisApi.get(res.analysis_id);
          setAnalysisResult(result);
          setPollState("completed");
        } else if (res.state === "FAILED") {
          setPollState("failed");
        } else {
          pollTimerRef.current = setTimeout(poll, 3000);
        }
      } catch {
        setPollState("failed");
      }
    };
    poll();
  }

  // Trigger analysis when goal changes
  useEffect(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    if (selectedGoalId) triggerAnalysis();
    return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); };
  }, [selectedGoalId, triggerAnalysis]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (goalRef.current && !goalRef.current.contains(e.target as Node)) {
        setGoalOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Parse skills from analysis result (best-effort — shape is unknown)
  const rawResult = analysisResult?.result as Record<string, unknown> | null;
  const skills = Array.isArray(rawResult?.skills)
    ? (rawResult!.skills as Array<{
        name: string;
        type?: string;
        demand_pct?: number;
        difficulty?: string;
        experienced_pct?: number;
        achievement?: string;
      }>)
    : null;

  const required_pct = typeof rawResult?.required_pct === "number" ? rawResult.required_pct : null;
  const preferred_pct = typeof rawResult?.preferred_pct === "number" ? rawResult.preferred_pct : null;

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
        </div>
      </aside>

      {/* Main area */}
      <div className="main-area">
        <header className="main-header">
          <h2 className="main-title">역량 분석</h2>
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
          {/* 분석 상태 배너 */}
          {pollState === "pending" || pollState === "running" ? (
            <div className="an-loading-banner">
              역량 분석 중이에요... 잠시만 기다려주세요.
            </div>
          ) : pollState === "failed" ? (
            <div className="an-error-banner">
              분석 중 오류가 발생했어요.
              <button className="an-retry-btn" onClick={triggerAnalysis}>다시 시도</button>
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

          {/* 부족한 역량 table */}
          <section className="an-skills-card">
            <div className="an-skills-header-row">
              <span className="an-col an-col--name">부족한 역량</span>
              <span className="an-col an-col--demand">공고의 요구 정도</span>
              <span className="an-col an-col--diff">난이도</span>
              <span className="an-col an-col--achieve">달성 방법</span>
            </div>

            {skills && skills.length > 0 ? (
              skills.map((skill) => (
                <div key={skill.name} className="an-skill-row">
                  <div className="an-col an-col--name">
                    <div className="an-skill-name-wrap">
                      <span className="an-skill-name">{skill.name}</span>
                      <span className={`an-skill-badge ${skill.type === "필수" ? "an-skill-badge--required" : "an-skill-badge--preferred"}`}>
                        {skill.type ?? "—"}
                      </span>
                    </div>
                  </div>
                  <div className="an-col an-col--demand">
                    <div className="an-demand-bar-wrap">
                      <div className="progress-bar an-demand-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${skill.demand_pct ?? 0}%`, background: "#ef4444" }}
                        />
                      </div>
                      <span className="an-demand-label">공고 {skill.demand_pct ?? "?"}%가 요구</span>
                    </div>
                  </div>
                  <div className="an-col an-col--diff">
                    <span className="an-difficulty">{skill.difficulty ?? "—"}</span>
                    <span className="an-experienced-sub">경력자 요구 {skill.experienced_pct ?? "?"}%</span>
                  </div>
                  <div className="an-col an-col--achieve">
                    <span className="an-achievement">{skill.achievement ?? "—"}</span>
                    <button className="an-roadmap-btn" onClick={() => navigate("/roadmap")}>
                      로드맵 보기
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="an-empty-state">
                {pollState === "completed"
                  ? "분석 결과가 없어요. 역량을 먼저 등록해보세요."
                  : pollState === "idle"
                  ? "목표를 선택하면 분석이 시작돼요."
                  : "분석 결과를 가져오는 중이에요..."}
              </div>
            )}
          </section>

          <div className="an-bottom-actions">
            <button className="an-goto-roadmap-btn" onClick={() => navigate("/roadmap")}>
              로드맵으로
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
