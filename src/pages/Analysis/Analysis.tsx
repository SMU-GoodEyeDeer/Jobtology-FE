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
import { analysisApi, profileApi, catalogV2Api, authApi, dashboardApi } from "../../services/api";
import { useGoals } from "../../hooks/useGoals";
import { useSession } from "../../context/SessionContext";
import type { AnalysisResponse, Neo4jPublicationResponse, Neo4jNcsAlignmentResponse } from "../../services/types";

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
  const { session, loading: sessionLoading } = useSession();
  const [activeNav, setActiveNav] = useState("역량 분석");

  useEffect(() => {
    if (!sessionLoading && !session) navigate("/");
  }, [session, sessionLoading, navigate]);
  const [goalOpen, setGoalOpen] = useState(false);
  const goalRef = useRef<HTMLDivElement>(null);

  const { goals, selectedGoalId, setSelectedGoalId, selectedGoalName, getGoalName } = useGoals();

  const [pollState, setPollState] = useState<PollState>("idle");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // v2 publications (editorial_analysis 가능한 것만)
  const [publications, setPublications] = useState<Neo4jPublicationResponse[]>([]);
  const [selectedPubId, setSelectedPubId] = useState<string | null>(null);
  const [alignments, setAlignments] = useState<Neo4jNcsAlignmentResponse[]>([]);
  const [alignmentsLoading, setAlignmentsLoading] = useState(false);

  useEffect(() => {
    catalogV2Api.listPublications({ limit: 100 }).then((list) => {
      setPublications(list.filter((p) => p.capabilities.editorial_analysis));
    }).catch(console.error);
  }, []);

  async function loadAlignments(pubId: string) {
    if (selectedPubId === pubId) {
      setSelectedPubId(null);
      setAlignments([]);
      return;
    }
    setSelectedPubId(pubId);
    setAlignmentsLoading(true);
    try {
      const data = await catalogV2Api.listAlignments(pubId, { limit: 100 });
      setAlignments(data.filter((a) => a.accepted));
    } catch {
      setAlignments([]);
    } finally {
      setAlignmentsLoading(false);
    }
  }

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

  // Show the stored analysis first; only compute when none exists yet. Profile,
  // capability, and preference changes already trigger a recompute on the server.
  const loadAnalysis = useCallback(async () => {
    if (!selectedGoalId) return;
    setPollState("pending");
    try {
      const dashboard = await dashboardApi.get(selectedGoalId);
      if (dashboard.state === "READY" && dashboard.analysis_id) {
        setAnalysisResult(await analysisApi.get(dashboard.analysis_id));
        setPollState("completed");
        return;
      }
      if (dashboard.state === "RECOMPUTING" && dashboard.recompute_request_id) {
        pollForResult(dashboard.recompute_request_id);
        return;
      }
    } catch (err) {
      console.warn("Stored analysis lookup failed:", err);
    }
    await triggerAnalysis();
  }, [selectedGoalId, triggerAnalysis]);

  useEffect(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setAnalysisResult(null);
    loadAnalysis();
    return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); };
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
          <span className="sidebar-logo-text">Jobtology</span>
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
          <button className="sidebar-logout-btn" onClick={async () => { await authApi.logout(); navigate("/"); }}>
            로그아웃
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="main-area">
        <header className="main-header">
          <h2 className="main-title">역량 분석</h2>
          <button
            className="an-reanalyze-btn"
            onClick={triggerAnalysis}
            disabled={!selectedGoalId || pollState === "pending" || pollState === "running"}
          >
            다시 분석하기
          </button>
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

          {/* NCS 연계 학습 자료 */}
          {publications.length > 0 && (
            <section className="an-skills-card">
              <div className="an-skills-header-row" style={{ marginBottom: 8 }}>
                <span className="an-col" style={{ fontWeight: 600 }}>NCS 연계 학습 자료</span>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>항목을 클릭하면 연계 역량을 볼 수 있어요</span>
              </div>
              {publications.map((pub) => (
                <div key={pub.publication_id}>
                  <div
                    className="an-skill-row"
                    style={{ cursor: "pointer" }}
                    onClick={() => loadAlignments(pub.publication_id)}
                  >
                    <div className="an-col an-col--name">
                      <span className="an-skill-name" style={{ fontSize: 13 }}>{pub.publication_id}</span>
                      <span className={`an-skill-badge ${pub.capabilities.route_planning ? "an-skill-badge--required" : "an-skill-badge--preferred"}`}>
                        {pub.capabilities.route_planning ? "로드맵 활용 가능" : "분석용"}
                      </span>
                    </div>
                    <div className="an-col" style={{ color: "#6b7280", fontSize: 12 }}>
                      {pub.source_state}
                    </div>
                    <div className="an-col" style={{ color: "#3b82f6", fontSize: 12 }}>
                      {selectedPubId === pub.publication_id ? "▲ 접기" : "▼ 역량 보기"}
                    </div>
                  </div>
                  {selectedPubId === pub.publication_id && (
                    <div style={{ padding: "8px 16px 12px", background: "#f9fafb", borderRadius: 8, margin: "0 0 8px" }}>
                      {alignmentsLoading ? (
                        <span style={{ color: "#9ca3af", fontSize: 13 }}>불러오는 중...</span>
                      ) : alignments.length === 0 ? (
                        <span style={{ color: "#9ca3af", fontSize: 13 }}>연계된 NCS 역량이 없어요.</span>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {alignments.map((a) => (
                            <span
                              key={a.source_enrichment_id}
                              style={{
                                background: "#dbeafe",
                                color: "#1d4ed8",
                                borderRadius: 12,
                                padding: "2px 10px",
                                fontSize: 12,
                              }}
                            >
                              {a.competency.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

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
