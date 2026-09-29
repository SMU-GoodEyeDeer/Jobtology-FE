import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../Home/Home.css";
import "./Progress.css";
import logoIcon from "../../assets/logo1.svg";
import homeIcon from "../../assets/Home .svg";
import chatIcon from "../../assets/Message circle.svg";
import roadmapIcon from "../../assets/Trending up.svg";
import analysisIcon from "../../assets/Bar chart.svg";
import progressIcon from "../../assets/today.svg";
import userIcon from "../../assets/User.svg";
import chevronDownIcon from "../../assets/Chevron down.svg";
import { useGoals } from "../../hooks/useGoals";
import { useRoadmap } from "../../hooks/useRoadmap";

const NAV_ITEMS = [
  { icon: homeIcon, label: "홈", path: "/home" },
  { icon: chatIcon, label: "AI 커리어 챗봇", path: "/chat" },
  { icon: roadmapIcon, label: "내 로드맵", path: "/roadmap" },
  { icon: analysisIcon, label: "역량 분석", path: "/analysis" },
  { icon: progressIcon, label: "진행 상황", path: "/progress" },
  { icon: userIcon, label: "내 정보", path: "/myinfo" },
];

const SUMMARY_TABS = ["이력서·포트폴리오", "자기소개서"] as const;
type SummaryTab = typeof SUMMARY_TABS[number];

export function Progress() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("진행 상황");
  const [goalOpen, setGoalOpen] = useState(false);
  const [fulfillmentExpanded, setFulfillmentExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<SummaryTab>("이력서·포트폴리오");
  const goalRef = useRef<HTMLDivElement>(null);

  const { goals, selectedGoalId, setSelectedGoalId, selectedGoal, selectedGoalName, getGoalName } = useGoals();
  const { activeRoadmap, progressPct } = useRoadmap(selectedGoalId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (goalRef.current && !goalRef.current.contains(e.target as Node)) {
        setGoalOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const completedSteps = activeRoadmap?.steps.filter((s) => s.state === "COMPLETED") ?? [];
  const totalSteps = activeRoadmap?.steps.length ?? 0;

  // Build summary from completed steps
  const resumeLines = completedSteps.map((s) => s.title);
  const coverLines = completedSteps.map(
    (s) => `${s.title}${s.description ? ` — ${s.description}` : ""} 단계를 완료했습니다.`
  );

  const summaryContent: Record<SummaryTab, string[]> = {
    "이력서·포트폴리오": resumeLines.length > 0 ? resumeLines : ["아직 완료한 단계가 없어요."],
    "자기소개서": coverLines.length > 0 ? coverLines : ["아직 완료한 단계가 없어요."],
  };

  function handleCopy() {
    const text = summaryContent[activeTab].join("\n");
    navigator.clipboard.writeText(text).catch(console.error);
  }

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
              <span className="satisfaction-label">로드맵</span>
              <span className="satisfaction-pct">{progressPct}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill progress-fill--blue" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="main-area">
        <header className="main-header">
          <h2 className="main-title">진행 상황</h2>
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

          {/* 목표 달성률 card */}
          <section className="pg-goal-card">
            <div className="pg-goal-header">
              <p className="pg-goal-title">목표 달성률</p>
              <button
                className="pg-expand-btn"
                onClick={() => setFulfillmentExpanded((v) => !v)}
                aria-label="역량 상세 펼치기"
              >
                <img
                  src={chevronDownIcon}
                  alt=""
                  className={`pg-expand-icon ${fulfillmentExpanded ? "pg-expand-icon--open" : ""}`}
                />
              </button>
            </div>

            <div className="pg-goal-progress-row">
              <span className="pg-goal-label">
                {selectedGoalName}
                {totalSteps > 0 && (
                  <span className="pg-goal-stage"> {completedSteps.length}/{totalSteps}단계</span>
                )}
              </span>
              <span className="pg-goal-pct">{progressPct}%</span>
            </div>
            <div className="progress-bar pg-goal-bar">
              <div className="progress-fill pg-goal-fill" style={{ width: `${progressPct}%` }} />
            </div>

            {fulfillmentExpanded && activeRoadmap && (
              <div className="pg-fulfillment-body">
                {activeRoadmap.steps.map((step) => (
                  <div key={step.step_id} className="pg-fulfillment-step">
                    <span className={`pg-step-dot pg-step-dot--${step.state.toLowerCase()}`} />
                    <span className="pg-step-name">{step.title}</span>
                    <span className="pg-step-state">{step.state === "COMPLETED" ? "완료" : step.state === "IN_PROGRESS" ? "진행 중" : "예정"}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 완료한 단계 요약 */}
          <div className="card-row">
            <div className="info-card pg-changes-card">
              <p className="pg-section-title">완료한 단계</p>
              <ul className="pg-changes-list">
                {completedSteps.length > 0 ? (
                  completedSteps.map((step) => (
                    <li key={step.step_id} className="pg-change-item">
                      <span className="pg-change-label">+ {step.title}</span>
                      <span className="pg-change-status pg-change-status--done">완료</span>
                    </li>
                  ))
                ) : (
                  <li className="pg-change-item">
                    <span style={{ color: "#9ca3af" }}>아직 완료한 단계가 없어요</span>
                  </li>
                )}
              </ul>
            </div>

            <div className="info-card pg-schedule-card">
              <p className="pg-section-title">목표 정보</p>
              {selectedGoal ? (
                <ul className="pg-schedule-list">
                  <li className="pg-schedule-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                    <span style={{ fontWeight: 600, color: "#374151" }}>
                      {selectedGoalName}
                    </span>
                    <span style={{ fontSize: 13, color: "#6b7280" }}>
                      목표일: {new Date(selectedGoal.target_by).toLocaleDateString("ko-KR")}
                    </span>
                    <span style={{ fontSize: 13, color: "#6b7280" }}>
                      상태: {selectedGoal.status}
                    </span>
                  </li>
                </ul>
              ) : (
                <p style={{ color: "#9ca3af", fontSize: 14 }}>목표를 선택해주세요</p>
              )}
            </div>
          </div>

          {/* 지금까지 해온 것 정리 */}
          <section className="pg-summary-card">
            <div className="pg-summary-header">
              <div>
                <p className="pg-section-title">지금까지 해온 것 정리</p>
                <p className="pg-summary-sub">완료한 단계를 용도에 맞게 문장으로 정리했어요.</p>
              </div>
              <button className="pg-copy-btn" onClick={handleCopy}>복사</button>
            </div>
            <div className="pg-tab-row">
              {SUMMARY_TABS.map((tab) => (
                <button
                  key={tab}
                  className={`pg-tab ${activeTab === tab ? "pg-tab--active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
            <ul className="pg-summary-list">
              {summaryContent[activeTab].map((line, i) => (
                <li key={i} className="pg-summary-item">· {line}</li>
              ))}
            </ul>
            <p className="pg-summary-footer">
              {activeTab === "이력서·포트폴리오"
                ? "이력서·포트폴리오에 붙여 넣을 수 있는 항목형 정리에요."
                : "자기소개서에 활용할 수 있는 문장형 정리에요."}
            </p>
          </section>

          <div className="an-bottom-actions">
            <button className="an-goto-roadmap-btn" onClick={() => navigate("/roadmap")}>
              로드맵 다시 보기
            </button>
          </div>

        </main>
      </div>
    </div>
  );
}
