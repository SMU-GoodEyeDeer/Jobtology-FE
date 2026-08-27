import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../Home/Home.css";
import "./MyInfo.css";
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

const GOAL_JOB_OPTIONS = ["AI 엔지니어", "백엔드 개발", "프론트엔드", "데이터 분석"];
const PRIORITY_OPTIONS = ["빠르게 취업", "대기업", "스타트업"];
const SITUATION_OPTIONS = [
  "교육비 부담이 커요",
  "학업·알바와 병행해야 해요",
  "최대한 빨리 취업하고 싶어요",
  "내세울 프로젝트·경험이 부족해요",
  "전공과 다른 직무로 가려고 해요",
];
const SPEC_TABS = ["언어·도구", "자격증", "어학", "경력·활동"] as const;
type SpecTab = typeof SPEC_TABS[number];

const JOB_MATCHES = [
  { label: "데이터 분석", pct: 71 },
  { label: "AI 엔지니어", pct: 54 },
  { label: "백엔드 개발", pct: 46 },
];

export function MyInfo() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("내 정보");
  const [goalOpen, setGoalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState("AI 엔지니어");
  const goalRef = useRef<HTMLDivElement>(null);

  const [major, setMajor] = useState("휴먼지능정보공학과");
  const [goalJobs, setGoalJobs] = useState<string[]>(["AI 엔지니어"]);
  const [priorities, setPriorities] = useState<string[]>(["빠르게 취업"]);
  const [situation, setSituation] = useState("교육비 부담이 커요");

  const [specTab, setSpecTab] = useState<SpecTab>("언어·도구");
  const [specItems, setSpecItems] = useState<Record<SpecTab, string[]>>({
    "언어·도구": ["Python", "Java", "Git"],
    "자격증": [],
    "어학": [],
    "경력·활동": [],
  });
  const [specInput, setSpecInput] = useState("");

  const [jobMatchOpen, setJobMatchOpen] = useState(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (goalRef.current && !goalRef.current.contains(e.target as Node)) {
        setGoalOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleChip(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function addSpecItem() {
    const trimmed = specInput.trim();
    if (!trimmed) return;
    setSpecItems((prev) => ({ ...prev, [specTab]: [...prev[specTab], trimmed] }));
    setSpecInput("");
  }

  function removeSpecItem(index: number) {
    setSpecItems((prev) => ({
      ...prev,
      [specTab]: prev[specTab].filter((_, i) => i !== index),
    }));
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
          <h2 className="main-title">내 정보</h2>
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
          <div className="mi-two-col">

            {/* 내 프로필 */}
            <div className="mi-profile-card">
              <div className="mi-card-header">
                <p className="mi-card-title">내 프로필</p>
                <button className="mi-save-btn">저장</button>
              </div>

              <div className="mi-field">
                <label className="mi-label">학과</label>
                <input
                  className="mi-input"
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                />
              </div>

              <div className="mi-field">
                <label className="mi-label">현재 상태</label>
                <input className="mi-input mi-input--disabled" value="학부 4학년" readOnly />
              </div>

              <div className="mi-field">
                <label className="mi-label">목표 직무</label>
                <div className="mi-chip-row">
                  {GOAL_JOB_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      className={`mi-chip ${goalJobs.includes(opt) ? "mi-chip--active" : ""}`}
                      onClick={() => toggleChip(goalJobs, setGoalJobs, opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mi-field">
                <label className="mi-label">무엇을 우선하나요</label>
                <div className="mi-chip-row">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      className={`mi-chip ${priorities.includes(opt) ? "mi-chip--active" : ""}`}
                      onClick={() => toggleChip(priorities, setPriorities, opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mi-field">
                <label className="mi-label">지금 내 상황</label>
                <div className="mi-radio-grid">
                  {SITUATION_OPTIONS.map((opt) => (
                    <label key={opt} className="mi-radio-item" onClick={() => setSituation(opt)}>
                      <span className={`mi-radio-dot ${situation === opt ? "mi-radio-dot--active" : ""}`} />
                      <span className="mi-radio-label">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button className="mi-roadmap-btn" onClick={() => navigate("/roadmap")}>
                내 로드맵 보기
              </button>
            </div>

            {/* 내 스펙 */}
            <div className="mi-spec-card">
              <p className="mi-card-title">내 스펙</p>
              <p className="mi-spec-sub">추가한 항목은 경로 추천에 함께 반영돼요</p>

              <div className="mi-spec-tab-row">
                {SPEC_TABS.map((tab) => (
                  <button
                    key={tab}
                    className={`mi-spec-tab ${specTab === tab ? "mi-spec-tab--active" : ""}`}
                    onClick={() => setSpecTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <ul className="mi-spec-list">
                {specItems[specTab].map((item, i) => (
                  <li key={i} className="mi-spec-item">
                    <span className="mi-spec-item-label">{item}</span>
                    <button className="mi-spec-remove" onClick={() => removeSpecItem(i)}>×</button>
                  </li>
                ))}
              </ul>

              <div className="mi-spec-input-row">
                <input
                  className="mi-input mi-spec-input"
                  placeholder={`${specTab} 추가 (예: TensorFlow)`}
                  value={specInput}
                  onChange={(e) => setSpecInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addSpecItem(); }}
                />
                <button className="mi-add-btn" onClick={addSpecItem}>추가</button>
              </div>
            </div>

          </div>

          {/* 적합 직무 찾기 */}
          <section className="mi-job-match-card">
            <div className="mi-job-match-header">
              <p className="mi-job-match-title">어떤 직무가 맞을지 모르겠다면</p>
              <button
                className="mi-job-match-btn"
                onClick={() => setJobMatchOpen((v) => !v)}
              >
                {jobMatchOpen ? "닫기" : "적합 직무 찾기"}
              </button>
            </div>

            {jobMatchOpen && (
              <div className="mi-job-match-results">
                {JOB_MATCHES.map(({ label, pct }) => (
                  <div key={label} className="mi-job-match-item">
                    <div className="mi-job-match-row">
                      <span className="mi-job-match-label">{label}</span>
                      <span className="mi-job-match-pct">{pct}%</span>
                    </div>
                    <div className="progress-bar mi-match-bar">
                      <div className="progress-fill progress-fill--blue" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </main>
      </div>
    </div>
  );
}
