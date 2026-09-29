import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";
import logoIcon from "../../assets/logo1.svg";
import homeIcon from "../../assets/Home .svg";
import chatIcon from "../../assets/Message circle.svg";
import roadmapIcon from "../../assets/Trending up.svg";
import analysisIcon from "../../assets/Bar chart.svg";
import progressIcon from "../../assets/today.svg";
import userIcon from "../../assets/User.svg";
import arrowIcon from "../../assets/→.svg";
import chevronDownIcon from "../../assets/Chevron down.svg";
import notificationsIcon from "../../assets/notifications.svg";
import clockIcon from "../../assets/Clock.svg";
import checkIcon from "../../assets/check.svg";
import { dashboardApi } from "../../services/api";
import type { DashboardResponse } from "../../services/types";
import { useSession } from "../../context/SessionContext";
import { useGoals } from "../../hooks/useGoals";

const NAV_ITEMS = [
  { icon: homeIcon, label: "홈", path: "/home" },
  { icon: chatIcon, label: "AI 커리어 챗봇", path: "/chat" },
  { icon: roadmapIcon, label: "내 로드맵", path: "/roadmap" },
  { icon: analysisIcon, label: "역량 분석", path: "/analysis" },
  { icon: progressIcon, label: "진행 상황", path: "/progress" },
  { icon: userIcon, label: "내 정보", path: "/myinfo" },
];

export function Home() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [activeNav, setActiveNav] = useState("홈");
  const [goalOpen, setGoalOpen] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const goalRef = useRef<HTMLDivElement>(null);

  const { goals, selectedGoalId, setSelectedGoalId, selectedGoal, selectedGoalName, getGoalName } = useGoals();

  // Fetch dashboard whenever selected goal changes
  useEffect(() => {
    dashboardApi.get(selectedGoalId ?? undefined).then(setDashboard).catch(console.error);
  }, [selectedGoalId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (goalRef.current && !goalRef.current.contains(e.target as Node)) {
        setGoalOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const progressPct = dashboard?.roadmap_progress_pct ?? 0;
  const nextActions = dashboard?.next_actions ?? [];

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
            <p className="satisfaction-title">
              {selectedGoalName} 진행률
            </p>
            <div className="satisfaction-row">
              <span className="satisfaction-label">진행률</span>
              <span className="satisfaction-pct">{Math.round(progressPct)}%</span>
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
          <h2 className="main-title">홈</h2>
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
                    <span className="goal-dropdown-count">{goal.goal_mode}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </header>

        <main className="main-content">
          {/* Hero card */}
          <section className="hero-card">
            <div className="hero-left">
              <span className="hero-badge">MY CAREER NAVIGATOR</span>
              <h1 className="hero-name">안녕하세요{session ? ", " + session.user_id.slice(0, 8) + "님" : "!"}</h1>
              <p className="hero-role">{selectedGoalName}</p>
              <p className="hero-sub">오늘도 목표를 향해 성장하고 있어요.</p>
              <button className="hero-btn">이어서 진행하기</button>
            </div>
            <div className="hero-right">
              <div className="progress-circle">
                <svg viewBox="0 0 80 80" className="circle-svg">
                  <circle cx="40" cy="40" r="32" className="circle-bg" />
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    className="circle-fg"
                    strokeDasharray={`${2 * Math.PI * 32 * (progressPct / 100)} ${2 * Math.PI * 32 * (1 - progressPct / 100)}`}
                    strokeDashoffset={2 * Math.PI * 32 * 0.25}
                  />
                </svg>
                <div className="circle-label">
                  <span className="circle-pct">{Math.round(progressPct)}%</span>
                  <span className="circle-sub">진행률</span>
                </div>
              </div>
            </div>
          </section>

          {/* Two cards row */}
          <div className="card-row">
            {/* Next actions card */}
            <div className="info-card">
              <div className="info-card-header">
                <div className="briefing-icon-box">
                  <img src={notificationsIcon} alt="브리핑" className="briefing-icon" />
                </div>
                <div>
                  <p className="info-card-title">다음 할 일</p>
                  <p className="info-card-sub">AI가 추천하는 다음 액션</p>
                </div>
              </div>
              <ul className="check-list">
                {nextActions.length > 0 ? (
                  nextActions.map((action, i) => (
                    <li key={i} className="check-item">
                      <img src={checkIcon} alt="체크" className="check-icon" />
                      <span>{action.label}</span>
                    </li>
                  ))
                ) : (
                  <li className="check-item">
                    <img src={checkIcon} alt="체크" className="check-icon" />
                    <span>목표를 설정하면 추천이 나타나요</span>
                  </li>
                )}
              </ul>
            </div>

            {/* Goals summary card */}
            <div className="info-card">
              <div className="info-card-header">
                <div className="briefing-icon-box">
                  <img src={clockIcon} alt="목표" className="briefing-icon" />
                </div>
                <div>
                  <p className="info-card-title">내 목표</p>
                  <p className="info-card-sub">설정된 커리어 목표</p>
                </div>
              </div>
              <ul className="activity-list">
                {goals.length > 0 ? (
                  goals.slice(0, 3).map((goal) => (
                    <li key={goal.goal_id} className="activity-item">
                      <div className="activity-left">
                        <img src={checkIcon} alt="체크" className="check-icon" />
                        <span>{getGoalName(goal)}</span>
                      </div>
                      <span className="activity-date">{goal.status}</span>
                    </li>
                  ))
                ) : (
                  <li className="activity-item">
                    <span>아직 설정된 목표가 없어요</span>
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Continue section */}
          <section className="continue-section">
            <div className="continue-header">
              <p className="continue-title">이어서 진행하기</p>
              <p className="continue-sub">
                {selectedGoal ? `${selectedGoalName} 로드맵` : "로드맵 미설정"}
              </p>
            </div>
            {nextActions[0] ? (
              <div className="continue-steps">
                <div className="step-box step-box--current">
                  <p className="step-label">다음 액션</p>
                  <p className="step-name">{nextActions[0].label}</p>
                </div>
                {nextActions[1] && (
                  <>
                    <img src={arrowIcon} alt="다음" className="step-arrow" />
                    <div className="step-box step-box--next">
                      <p className="step-label">그 다음</p>
                      <p className="step-name">{nextActions[1].label}</p>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p style={{ color: "#9ca3af", fontSize: "14px" }}>로드맵을 생성하면 진행 상황이 보여요</p>
            )}
            <button className="continue-btn" onClick={() => navigate("/roadmap")}>
              로드맵 보기
            </button>
          </section>
        </main>
      </div>
    </div>
  );
}
