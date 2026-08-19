import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../Home/Home.css";
import "./Roadmap.css";
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

const CONDITION_CHIPS = [
  "교육비 부담이 커요",
  "학업·알바와 병행해야 해요",
  "최대한 빨리 취업하고 싶어요",
  "내세울 프로젝트·경험이 부족해요",
  "전공과 다른 직무로 가려고 해요",
];

export function Roadmap() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("내 로드맵");
  const [goalOpen, setGoalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState("AI 엔지니어");
  const [activeChips, setActiveChips] = useState<Set<string>>(new Set(["교육비 부담이 커요"]));
  const [savedEditing, setSavedEditing] = useState(false);
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

  function toggleChip(chip: string) {
    setActiveChips((prev) => {
      const next = new Set(prev);
      if (next.has(chip)) next.delete(chip);
      else next.add(chip);
      return next;
    });
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
          <h2 className="main-title">내 로드맵</h2>
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
          {/* 내 로드맵 조건 */}
          <section className="rm-section">
            <div className="rm-section-header">
              <p className="rm-section-title">내 로드맵 조건</p>
              <p className="rm-section-sub">아래 조건을 바꾸면 경로가 다시 계산돼요.</p>
            </div>
            <div className="rm-chips">
              {CONDITION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  className={`rm-chip ${activeChips.has(chip) ? "rm-chip--active" : ""}`}
                  onClick={() => toggleChip(chip)}
                >
                  <span className="rm-chip-dot" />
                  {chip}
                </button>
              ))}
            </div>
          </section>

          {/* AI 엔지니어 · 실무 교육 경로 */}
          <section className="rm-card">
            <div className="rm-card-header">
              <div className="rm-card-title-row">
                <span className="rm-card-title">AI 엔지니어 · 실무 교육 경로</span>
                <span className="rm-badge rm-badge--profile">프로필 기반</span>
              </div>
              <button className="rm-save-btn">이 경로 저장</button>
            </div>
            <p className="rm-card-sub">
              내 프로필 정보로 자동 계산한 기본 경로예요 · 약 6개월~ · 공고 500건이 근거 · 1/6단계 완료
            </p>

            {/* Python - 완료 */}
            <div className="rm-step-item">
              <div className="rm-step-top">
                <div className="rm-step-left">
                  <span className="rm-step-name">Python</span>
                  <span className="rm-badge rm-badge--done">완료</span>
                </div>
                <button className="rm-why-btn">왜 필요한가요?</button>
              </div>
              <p className="rm-step-desc">
                AI 엔지니어 공고의 96%가 요구해요 · 이미 보유 · <span className="rm-link">공고 보기</span>
              </p>
              <span className="rm-completed-badge">✓ 완료함</span>
            </div>

            {/* 실무 교육 과정 - 현재 진행 중 */}
            <div className="rm-step-item rm-step-item--current">
              <div className="rm-step-top">
                <div className="rm-step-left">
                  <span className="rm-step-name">실무 교육 과정</span>
                  <span className="rm-badge rm-badge--now">지금 할 것</span>
                </div>
                <button className="rm-why-btn">왜 필요한가요?</button>
              </div>
              <p className="rm-step-desc">
                연결된 과정 3건 · 평균 840시간 · <span className="rm-link">공고 보기</span>
              </p>
              <button className="rm-complete-btn">완료했어요</button>
            </div>

            {/* PyTorch - 완료 */}
            <div className="rm-step-item">
              <div className="rm-step-top">
                <div className="rm-step-left">
                  <span className="rm-step-name">PyTorch</span>
                </div>
                <button className="rm-why-btn">왜 필요한가요?</button>
              </div>
              <p className="rm-step-desc">
                공고의 82%가 요구해요 · 412건이 근거에요 · <span className="rm-link">공고 보기</span>
              </p>
              <button className="rm-complete-btn">완료했어요</button>
            </div>
          </section>

          {/* 지금 가장 먼저 할 일 */}
          <section className="rm-priority-section">
            <div className="rm-priority-header">
              <p className="rm-priority-title">지금 가장 먼저 할 일</p>
              <p className="rm-priority-sub">현재 단계 기준으로 추천해요.</p>
            </div>
            <div className="rm-priority-cards">
              <div className="rm-priority-card">
                <span className="rm-priority-num">①</span>
                <p className="rm-priority-name">실무 교육 과정 3건 비교하기</p>
                <p className="rm-priority-desc">840시간 과정</p>
              </div>
              <div className="rm-priority-card">
                <span className="rm-priority-num">②</span>
                <p className="rm-priority-name">PyTorch 요구 공고 412건 보기</p>
                <p className="rm-priority-desc">공고 원문</p>
              </div>
              <div className="rm-priority-card">
                <span className="rm-priority-num">③</span>
                <p className="rm-priority-name">TensorFlow로 대체 가능한지 보기</p>
                <p className="rm-priority-desc">연결 61%</p>
              </div>
            </div>
          </section>

          {/* 저장한 커리어 경로 */}
          <section className="rm-card">
            <div className="rm-saved-header">
              <p className="rm-section-title">저장한 커리어 경로</p>
              <p className="rm-section-sub">
                내 로드맵에서 '이 경로 저장'으로 남긴 로드맵이에요. 다시 불러오거나 정리할 수 있어요.
              </p>
            </div>
            <div className="rm-saved-card">
              <div className="rm-saved-top">
                <div>
                  <span className="rm-badge rm-badge--profile">프로필 기반</span>
                  <div className="rm-saved-title-row">
                    <p className="rm-saved-title">AI 엔지니어 · 8. 3.</p>
                    <button className="rm-edit-btn" onClick={() => setSavedEditing((v) => !v)}>
                      {savedEditing ? "완료" : "편집"}
                    </button>
                  </div>
                  <p className="rm-saved-sub">AI 엔지니어 · 1/6단계 · 필수 54% 우대 24%</p>
                </div>
              </div>
              <div className="progress-bar" style={{ margin: "12px 0" }}>
                <div className="progress-fill progress-fill--blue" style={{ width: "70%" }} />
              </div>
              {savedEditing && (
                <div className="rm-saved-actions">
                  <button className="rm-saved-btn">불러오기</button>
                  <button className="rm-saved-btn">이름 변경</button>
                  <button className="rm-saved-btn rm-saved-btn--delete">삭제</button>
                </div>
              )}
            </div>
          </section>

          {/* 하단 버튼 */}
          <div className="rm-bottom-btns">
            <button className="rm-bottom-btn">부족한 역량 보기</button>
            <button className="rm-bottom-btn">내 진행 상황</button>
          </div>
        </main>
      </div>
    </div>
  );
}
