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

const NAV_ITEMS = [
  { icon: homeIcon, label: "홈", path: "/home" },
  { icon: chatIcon, label: "AI 커리어 챗봇", path: "/chat" },
  { icon: roadmapIcon, label: "내 로드맵", path: "/roadmap" },
  { icon: analysisIcon, label: "역량 분석", path: "/analysis" },
  { icon: progressIcon, label: "진행 상황", path: "/progress" },
  { icon: userIcon, label: "내 정보", path: "/myinfo" },
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

const CHANGES = [
  { label: "프로필 작성", status: "시작" },
  { label: "Python 등록", status: "완료" },
];

const SCHEDULES = [
  { month: "8월", day: "8", title: "정보처리기사 실기 점수 마감", sub: "큐넷 · 온라인 접수", category: "자격증", dDay: 5, urgent: true },
  { month: "8월", day: "12", title: "네이버 AI 신입 공채 서류 마감", sub: "채용 홈페이지", category: "공고", dDay: 9, urgent: false },
  { month: "8월", day: "17", title: "AI 실무 교육 과정 모집 마감", sub: "HRD-Net · 840시간", category: "교육", dDay: 14, urgent: false },
];

const SUMMARY_TABS = ["이력서·포트폴리오", "자기소개서"] as const;
type SummaryTab = typeof SUMMARY_TABS[number];

const SUMMARY_CONTENT: Record<SummaryTab, string[]> = {
  "이력서·포트폴리오": [
    "프로그래밍 언어: Python, SQL, Git (활용 가능)",
    "진행 중: AI 엔지니어 커리어 로드맵 (1/6단계)",
    "자격증: 정보처리기사",
  ],
  "자기소개서": [
    "저는 AI 엔지니어를 목표로 Python, SQL, Git을 활용한 프로젝트 경험을 쌓고 있습니다.",
    "현재 AI 엔지니어 커리어 로드맵 1/6단계를 진행 중이며, 정보처리기사 자격증을 보유하고 있습니다.",
  ],
};

export function Progress() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("진행 상황");
  const [goalOpen, setGoalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState("AI 엔지니어");
  const [fulfillmentExpanded, setFulfillmentExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<SummaryTab>("이력서·포트폴리오");
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
          <h2 className="main-title">진행 상황</h2>
          <div className="goal-wrapper" ref={goalRef}>
            <button className="goal-button" onClick={() => setGoalOpen((v) => !v)}>
              {selectedGoal} <img src={chevronDownIcon} alt="▾" className="goal-arrow" />
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
                AI 엔지니어 <span className="pg-goal-stage">1/6단계</span>
              </span>
              <span className="pg-goal-pct">17%</span>
            </div>
            <div className="progress-bar pg-goal-bar">
              <div className="progress-fill pg-goal-fill" style={{ width: "17%" }} />
            </div>

            {fulfillmentExpanded && (
              <div className="pg-fulfillment-body">
                <div className="pg-fulfillment-half">
                  <p className="pg-half-label">필수 역량</p>
                  <p className="pg-fulfillment-pct">54%</p>
                  <div className="progress-bar">
                    <div className="progress-fill progress-fill--blue" style={{ width: "54%" }} />
                  </div>
                </div>
                <div className="pg-fulfillment-half">
                  <p className="pg-half-label">우대 역량</p>
                  <p className="pg-fulfillment-pct pg-fulfillment-pct--green">24%</p>
                  <div className="progress-bar">
                    <div className="progress-fill progress-fill--green" style={{ width: "24%" }} />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* 이번 달 달라진 점 + 다가오는 일정 */}
          <div className="card-row">

            {/* 이번 달 달라진 점 */}
            <div className="info-card pg-changes-card">
              <p className="pg-section-title">이번 달 달라진 점</p>
              <ul className="pg-changes-list">
                {CHANGES.map(({ label, status }) => (
                  <li key={label} className="pg-change-item">
                    <span className="pg-change-label">+ {label}</span>
                    <span className={`pg-change-status ${status === "시작" ? "pg-change-status--start" : "pg-change-status--done"}`}>
                      {status}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="pg-update-box">
                <p className="pg-update-title">로드맵이 업데이트됐어요</p>
                <p className="pg-update-sub">다음 단계도 열심히 진행해 보아요!</p>
              </div>
            </div>

            {/* 다가오는 일정 */}
            <div className="info-card pg-schedule-card">
              <p className="pg-section-title">다가오는 일정</p>
              <p className="pg-schedule-sub">나에게 필요한 일정을 관리해요!</p>
              <ul className="pg-schedule-list">
                {SCHEDULES.map((s) => (
                  <li key={s.title} className="pg-schedule-item">
                    <div className="pg-schedule-date">
                      <span className="pg-schedule-month">{s.month}</span>
                      <span className="pg-schedule-day">{s.day}</span>
                    </div>
                    <div className="pg-schedule-info">
                      <div className="pg-schedule-title-row">
                        <span className="pg-schedule-title">{s.title}</span>
                        <span className={`pg-category-badge pg-category-badge--${s.category === "자격증" ? "cert" : s.category === "공고" ? "job" : "edu"}`}>
                          {s.category}
                        </span>
                      </div>
                      <span className="pg-schedule-sub-text">{s.sub}</span>
                    </div>
                    <span className={`pg-dday ${s.urgent ? "pg-dday--urgent" : ""}`}>
                      D-{s.dDay}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* 지금까지 해온 것 정리 */}
          <section className="pg-summary-card">
            <div className="pg-summary-header">
              <div>
                <p className="pg-section-title">지금까지 해온 것 정리</p>
                <p className="pg-summary-sub">완료한 단계를 용도에 맞게 문장으로 정리했어요.</p>
              </div>
              <button className="pg-copy-btn">복사</button>
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
              {SUMMARY_CONTENT[activeTab].map((line) => (
                <li key={line} className="pg-summary-item">· {line}</li>
              ))}
            </ul>
            <p className="pg-summary-footer">
              {activeTab === "이력서·포트폴리오"
                ? "이력서·포트폴리오에 붙여 넣을 수 있는 항목형 정리에요."
                : "자기소개서에 활용할 수 있는 문장형 정리에요."}
            </p>
          </section>

          {/* 로드맵 다시 보기 */}
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
