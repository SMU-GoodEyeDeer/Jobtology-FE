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

const NAV_ITEMS = [
  { icon: homeIcon, label: "홈", path: "/home" },
  { icon: chatIcon, label: "AI 커리어 챗봇", path: "/chat" },
  { icon: roadmapIcon, label: "내 로드맵", path: "/roadmap" },
  { icon: analysisIcon, label: "역량 분석", path: "" },
  { icon: progressIcon, label: "진행 상황", path: "" },
  { icon: userIcon, label: "내 정보", path: "" },
];

const GOAL_GROUPS = [
  {
    label: "AI·데이터",
    items: [
      { name: "AI 엔지니어", count: "500" },
      { name: "데이터 분석", count: "680" },
      { name: "데이터 엔지니어", count: "430" },
      { name: "ML 엔지니어", count: "310" },
    ],
  },
  {
    label: "개발",
    items: [
      { name: "백엔드 개발", count: "1,240" },
      { name: "프론트엔드", count: "720" },
      { name: "풀스택 개발", count: "540" },
      { name: "안드로이드", count: "290" },
    ],
  },
  {
    label: "인프라·보안",
    items: [
      { name: "DevOps", count: "388" },
      { name: "클라우드 엔지니어", count: "260" },
      { name: "정보보안", count: "248" },
    ],
  },
];

const BRIEFING_ITEMS = [
  "프로젝트 1개가 역량 분석에 반영됐어요",
  "목표 적합도가 14% → 17%로 올랐어요",
  "로드맵이 최신 상태로 업데이트됐어요",
];

const BRIEFING_TAGS = ["데이터 근거", "프로젝트 업로드", "역량 분석 결과"];

const ACTIVITY_ITEMS = [
  { label: "Python 프로젝트 등록", date: "2일 전" },
  { label: "AI 이력서 분석 완료", date: "4일 전" },
  { label: "AI 면접 2회 진행", date: "1주 전" },
];

export function Home() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("홈");
  const [goalOpen, setGoalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState("AI 엔지니어");
  const goalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (goalRef.current && !goalRef.current.contains(e.target as Node)) {
        setGoalOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
            <p className="satisfaction-title">AI 엔지니어 충족률</p>
            <div className="satisfaction-row">
              <span className="satisfaction-label">필수 역량</span>
              <span className="satisfaction-pct">54%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill progress-fill--blue" style={{ width: "54%" }} />
            </div>
            <div className="satisfaction-row" style={{ marginTop: "10px" }}>
              <span className="satisfaction-label">우대 역량</span>
              <span className="satisfaction-pct">24%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill progress-fill--green" style={{ width: "24%" }} />
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
              목표 {selectedGoal} <img src={chevronDownIcon} alt="▾" className="goal-arrow" />
            </button>
            {goalOpen && (
              <div className="goal-dropdown">
                {GOAL_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="goal-dropdown-group-label">{group.label}</p>
                    {group.items.map((item) => (
                      <div
                        key={item.name}
                        className={`goal-dropdown-item${selectedGoal === item.name ? " selected" : ""}`}
                        onClick={() => { setSelectedGoal(item.name); setGoalOpen(false); }}
                      >
                        <span>{item.name}</span>
                        <span className="goal-dropdown-count">공고 {item.count}건</span>
                      </div>
                    ))}
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
              <h1 className="hero-name">안녕하세요, 예은님</h1>
              <p className="hero-role">AI 엔지니어</p>
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
                    strokeDasharray={`${2 * Math.PI * 32 * 0.17} ${2 * Math.PI * 32 * 0.83}`}
                    strokeDashoffset={2 * Math.PI * 32 * 0.25}
                  />
                </svg>
                <div className="circle-label">
                  <span className="circle-pct">17%</span>
                  <span className="circle-sub">진행률</span>
                </div>
              </div>
            </div>
          </section>

          {/* Two cards row */}
          <div className="card-row">
            {/* Briefing card */}
            <div className="info-card">
              <div className="info-card-header">
                <div className="briefing-icon-box">
                  <img src={notificationsIcon} alt="브리핑" className="briefing-icon" />
                </div>
                <div>
                  <p className="info-card-title">오늘의 커리어 브리핑</p>
                  <p className="info-card-sub">최근 활동을 분석했어요</p>
                </div>
              </div>
              <ul className="check-list">
                {BRIEFING_ITEMS.map((item) => (
                  <li key={item} className="check-item">
                    <img src={checkIcon} alt="체크" className="check-icon" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="tag-row">
                {BRIEFING_TAGS.map((tag) => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
            </div>

            {/* Activity card */}
            <div className="info-card">
              <div className="info-card-header">
                <div className="briefing-icon-box">
                  <img src={clockIcon} alt="활동" className="briefing-icon" />
                </div>
                <div>
                  <p className="info-card-title">최근 활동</p>
                  <p className="info-card-sub">최근 학습 및 입력 히스토리</p>
                </div>
              </div>
              <ul className="activity-list">
                {ACTIVITY_ITEMS.map(({ label, date }) => (
                  <li key={label} className="activity-item">
                    <div className="activity-left">
                      <img src={checkIcon} alt="체크" className="check-icon" />
                      <span>{label}</span>
                    </div>
                    <span className="activity-date">{date}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Continue section */}
          <section className="continue-section">
            <div className="continue-header">
              <p className="continue-title">이어서 진행하기</p>
              <p className="continue-sub">AI 엔지니어 로드맵</p>
            </div>
            <div className="continue-steps">
              <div className="step-box step-box--current">
                <p className="step-label">현재</p>
                <p className="step-name">Python</p>
              </div>
              <img src={arrowIcon} alt="다음" className="step-arrow" />
              <div className="step-box step-box--next">
                <p className="step-label">다음</p>
                <p className="step-name">실무 교육 과정</p>
              </div>
            </div>
            <button className="continue-btn">이어서 학습</button>
          </section>
        </main>
      </div>
    </div>
  );
}
