import { useState, useRef, useEffect } from "react";
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

type SkillType = "필수" | "우대";
type Difficulty = "높음" | "보통";

interface Skill {
  name: string;
  type: SkillType;
  demandPct: number;
  barColor: string;
  difficulty: Difficulty;
  experiencedPct: number;
  achievement: string;
}

const SKILLS: Skill[] = [
  { name: "PyTorch", type: "필수", demandPct: 82, barColor: "#ef4444", difficulty: "높음", experiencedPct: 34, achievement: "840시간 과정" },
  { name: "Docker", type: "필수", demandPct: 72, barColor: "#f59e0b", difficulty: "보통", experiencedPct: 51, achievement: "120시간 과정" },
  { name: "AWS", type: "우대", demandPct: 64, barColor: "#4f46e5", difficulty: "보통", experiencedPct: 63, achievement: "자격증 평균 3개월" },
  { name: "MLOps", type: "우대", demandPct: 38, barColor: "#9ca3af", difficulty: "높음", experiencedPct: 78, achievement: "연결된 과정 없음" },
  { name: "Kubernetes", type: "필수", demandPct: 55, barColor: "#ef4444", difficulty: "보통", experiencedPct: 47, achievement: "200시간 과정" },
  { name: "TensorFlow", type: "우대", demandPct: 45, barColor: "#f59e0b", difficulty: "높음", experiencedPct: 60, achievement: "500시간 과정" },
];

export function Analysis() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("역량 분석");
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
          <h2 className="main-title">역량 분석</h2>
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
          {/* 충족률 card */}
          <section className="an-fulfillment-card">
            <p className="an-fulfillment-title">AI 엔지니어 충족률</p>
            <div className="an-fulfillment-body">
              <div className="an-fulfillment-half">
                <p className="an-half-label">필수 역량</p>
                <p className="an-fulfillment-pct">54%</p>
                <p className="an-fulfillment-sub">거의 모든 공고가 요구하는 역량</p>
                <p className="an-fulfillment-count">7개 중 4개</p>
                <div className="progress-bar">
                  <div className="progress-fill progress-fill--blue" style={{ width: "54%" }} />
                </div>
              </div>
              <div className="an-fulfillment-divider" />
              <div className="an-fulfillment-half">
                <p className="an-half-label">우대 역량</p>
                <p className="an-fulfillment-pct an-fulfillment-pct--green">24%</p>
                <p className="an-fulfillment-sub">있으면 유리한 역량</p>
                <p className="an-fulfillment-count">5개 중 1개</p>
                <div className="progress-bar">
                  <div className="progress-fill progress-fill--green" style={{ width: "24%" }} />
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
            {SKILLS.map((skill) => (
              <div key={skill.name} className="an-skill-row">
                <div className="an-col an-col--name">
                  <div className="an-skill-name-wrap">
                    <span className="an-skill-name">{skill.name}</span>
                    <span className={`an-skill-badge ${skill.type === "필수" ? "an-skill-badge--required" : "an-skill-badge--preferred"}`}>
                      {skill.type}
                    </span>
                  </div>
                </div>
                <div className="an-col an-col--demand">
                  <div className="an-demand-bar-wrap">
                    <div className="progress-bar an-demand-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${skill.demandPct}%`, background: skill.barColor }}
                      />
                    </div>
                    <span className="an-demand-label">공고 {skill.demandPct}%가 요구</span>
                  </div>
                </div>
                <div className="an-col an-col--diff">
                  <span className="an-difficulty">{skill.difficulty}</span>
                  <span className="an-experienced-sub">경력자 요구 {skill.experiencedPct}%</span>
                </div>
                <div className="an-col an-col--achieve">
                  <span className="an-achievement">{skill.achievement}</span>
                  <button className="an-roadmap-btn" onClick={() => navigate("/roadmap")}>
                    로드맵 보기
                  </button>
                </div>
              </div>
            ))}
          </section>

          {/* Bottom action */}
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
