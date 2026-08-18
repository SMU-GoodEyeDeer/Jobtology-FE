import { useState } from "react";
import "./Home.css";
import logoIcon from "../../assets/logo1.svg";
import homeIcon from "../../assets/Home .svg";
import chatIcon from "../../assets/Message circle.svg";
import roadmapIcon from "../../assets/Trending up.svg";
import analysisIcon from "../../assets/Bar chart.svg";
import progressIcon from "../../assets/today.svg";
import userIcon from "../../assets/User.svg";
import arrowIcon from "../../assets/→.svg";
import refreshIcon from "../../assets/Refresh ccw.svg";
import checkIcon from "../../assets/Check circle.svg";

const NAV_ITEMS = [
  { icon: homeIcon, label: "홈" },
  { icon: chatIcon, label: "AI 커리어 챗봇" },
  { icon: roadmapIcon, label: "내 로드맵" },
  { icon: analysisIcon, label: "역량 분석" },
  { icon: progressIcon, label: "진행 상황" },
  { icon: userIcon, label: "내 정보" },
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
  const [activeNav, setActiveNav] = useState("홈");

  return (
    <div className="home-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src={logoIcon} alt="로고" className="sidebar-logo-icon" />
          <span className="sidebar-logo-text">커리어 내비게이션</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ icon, label }) => (
            <button
              key={label}
              className={`nav-item ${activeNav === label ? "nav-item--active" : ""}`}
              onClick={() => setActiveNav(label)}
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
          <button className="goal-button">
            목표 AI 엔지니어 <span className="goal-arrow">∨</span>
          </button>
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
                <img src={refreshIcon} alt="브리핑" className="info-card-icon" />
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
                <img src={progressIcon} alt="활동" className="info-card-icon" />
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
