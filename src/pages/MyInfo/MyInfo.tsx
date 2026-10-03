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
import { profileApi, capabilitiesApi, authApi, goalsApi } from "../../services/api";
import { useGoals } from "../../hooks/useGoals";
import type { GoalStatus } from "../../services/types";
import { useSession } from "../../context/SessionContext";

const NAV_ITEMS = [
  { icon: homeIcon, label: "홈", path: "/home" },
  { icon: chatIcon, label: "AI 커리어 챗봇", path: "/chat" },
  { icon: roadmapIcon, label: "내 로드맵", path: "/roadmap" },
  { icon: analysisIcon, label: "역량 분석", path: "/analysis" },
  { icon: progressIcon, label: "진행 상황", path: "/progress" },
  { icon: userIcon, label: "내 정보", path: "/myinfo" },
];

const SPEC_TABS = ["언어·도구", "자격증", "어학", "경력·활동"] as const;
type SpecTab = typeof SPEC_TABS[number];

const TAB_TO_CATEGORY: Record<SpecTab, string> = {
  "언어·도구": "LANGUAGE_TOOL",
  "자격증": "CERTIFICATE",
  "어학": "LANGUAGE",
  "경력·활동": "EXPERIENCE",
};

interface CapabilityItem {
  capability_id: string;
  raw_text: string;
  category: string;
}

const GRADES = ["1학년", "2학년", "3학년", "4학년"];
const GRADE_TO_YEAR: Record<string, number> = { "1학년": 1, "2학년": 2, "3학년": 3, "4학년": 4 };
const YEAR_TO_GRADE: Record<number, string> = { 1: "1학년", 2: "2학년", 3: "3학년", 4: "4학년" };

export function MyInfo() {
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();
  const [activeNav, setActiveNav] = useState("내 정보");

  useEffect(() => {
    if (!sessionLoading && !session) navigate("/");
  }, [session, sessionLoading, navigate]);
  const [goalOpen, setGoalOpen] = useState(false);
  const goalRef = useRef<HTMLDivElement>(null);
  const gradeDropdownRef = useRef<HTMLDivElement>(null);

  const { goals, selectedGoalId, setSelectedGoalId, selectedGoalName, getGoalName } = useGoals();

  // Profile state
  const [major, setMajor] = useState("");
  const [grade, setGrade] = useState<string | null>(null);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [profileVersion, setProfileVersion] = useState(1);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Goal edit state
  const [updatingGoalId, setUpdatingGoalId] = useState<string | null>(null);

  async function handleGoalStatusChange(goalId: string, newStatus: GoalStatus) {
    const goal = goals.find((g) => g.goal_id === goalId);
    if (!goal) return;
    setUpdatingGoalId(goalId);
    try {
      const profile = await profileApi.get();
      await goalsApi.update(goalId, {
        expected_profile_version: profile.version,
        goal_mode: goal.goal_mode,
        target_by: goal.target_by,
        timezone: goal.timezone,
        original_time_phrase: goal.original_time_phrase,
        ...(goal.occupation_id ? { occupation_id: goal.occupation_id } : {}),
        status: newStatus,
      });
      // goals는 useGoals hook이 관리 — 페이지 새로고침으로 반영
      window.location.reload();
    } catch (err) {
      console.error("Goal update failed:", err);
    } finally {
      setUpdatingGoalId(null);
    }
  }

  // Capabilities state
  const [capabilities, setCapabilities] = useState<CapabilityItem[]>([]);
  const [specTab, setSpecTab] = useState<SpecTab>("언어·도구");
  const [specInput, setSpecInput] = useState("");
  const [addingSpec, setAddingSpec] = useState(false);

  // Load profile on mount
  useEffect(() => {
    profileApi.get().then((p) => {
      setMajor(p.major_raw ?? "");
      setGrade(p.year ? YEAR_TO_GRADE[p.year] ?? null : null);
      setProfileVersion(p.version);
    }).catch(console.error);
  }, []);

  // Load capabilities on mount
  useEffect(() => {
    capabilitiesApi.list().then((res) => {
      setCapabilities(res.items as CapabilityItem[]);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (goalRef.current && !goalRef.current.contains(e.target as Node)) {
        setGoalOpen(false);
      }
      if (gradeDropdownRef.current && !gradeDropdownRef.current.contains(e.target as Node)) {
        setGradeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSaveProfile() {
    setSavingProfile(true);
    try {
      const updated = await profileApi.update({
        expected_profile_version: profileVersion,
        major_raw: major || "미입력",
        ...(grade ? { year: GRADE_TO_YEAR[grade] } : {}),
      });
      setProfileVersion(updated.version);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (err) {
      console.error("Profile save failed:", err);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAddSpec() {
    const trimmed = specInput.trim();
    if (!trimmed) return;
    setAddingSpec(true);
    try {
      const profile = await profileApi.get();
      setProfileVersion(profile.version);
      const created = await capabilitiesApi.create({
        expected_profile_version: profile.version,
        category: TAB_TO_CATEGORY[specTab],
        raw_text: trimmed,
      }) as CapabilityItem;
      setCapabilities((prev) => [...prev, created]);
      setSpecInput("");
    } catch (err) {
      console.error("Add capability failed:", err);
    } finally {
      setAddingSpec(false);
    }
  }

  async function handleRemoveSpec(capabilityId: string) {
    try {
      const profile = await profileApi.get();
      setProfileVersion(profile.version);
      await capabilitiesApi.delete(capabilityId, { expected_profile_version: profile.version });
      setCapabilities((prev) => prev.filter((c) => c.capability_id !== capabilityId));
    } catch (err) {
      console.error("Remove capability failed:", err);
    }
  }

  const filteredCaps = capabilities.filter(
    (c) => c.category === TAB_TO_CATEGORY[specTab]
  );

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
              <span className="satisfaction-label">역량</span>
              <span className="satisfaction-pct">{capabilities.length}개 등록됨</span>
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
          <h2 className="main-title">내 정보</h2>
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
          {/* 목표 관리 */}
          {goals.length > 0 && (
            <div className="mi-goals-card">
              <p className="mi-card-title">내 목표</p>
              {goals.map((goal) => (
                <div key={goal.goal_id} className="mi-goal-item">
                  <div className="mi-goal-info">
                    <span className="mi-goal-name">{getGoalName(goal)}</span>
                    <span className={`mi-goal-badge mi-goal-badge--${goal.status.toLowerCase()}`}>
                      {goal.status === "ACTIVE" ? "활성" : goal.status === "ARCHIVED" ? "보관됨" : "임시저장"}
                    </span>
                  </div>
                  <div className="mi-goal-actions">
                    {goal.status === "ACTIVE" && (
                      <button
                        className="mi-goal-archive-btn"
                        disabled={updatingGoalId === goal.goal_id}
                        onClick={() => handleGoalStatusChange(goal.goal_id, "ARCHIVED")}
                      >
                        {updatingGoalId === goal.goal_id ? "..." : "보관"}
                      </button>
                    )}
                    {goal.status === "ARCHIVED" && (
                      <button
                        className="mi-goal-archive-btn"
                        disabled={updatingGoalId === goal.goal_id}
                        onClick={() => handleGoalStatusChange(goal.goal_id, "ACTIVE")}
                      >
                        {updatingGoalId === goal.goal_id ? "..." : "활성화"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mi-two-col">

            {/* 내 프로필 */}
            <div className="mi-profile-card">
              <div className="mi-card-header">
                <p className="mi-card-title">내 프로필</p>
                <button
                  className="mi-save-btn"
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? "저장 중..." : profileSaved ? "저장됨!" : "저장"}
                </button>
              </div>

              <div className="mi-field">
                <label className="mi-label">학과</label>
                <input
                  className="mi-input"
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  placeholder="학과를 입력해주세요"
                />
              </div>

              <div className="mi-field">
                <label className="mi-label">학년</label>
                <div className="custom-select" ref={gradeDropdownRef}>
                  <button
                    className={`custom-select-trigger${gradeOpen ? " open" : ""}`}
                    onClick={() => setGradeOpen((v) => !v)}
                    type="button"
                    style={{ width: "100%" }}
                  >
                    <span className={grade ? "" : "placeholder"}>{grade ?? "학년 선택"}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {gradeOpen && (
                    <ul className="custom-select-list">
                      {GRADES.map((g) => (
                        <li
                          key={g}
                          className={`custom-select-option${grade === g ? " selected" : ""}`}
                          onClick={() => { setGrade(g); setGradeOpen(false); }}
                        >
                          {g}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <button className="mi-roadmap-btn" onClick={() => navigate("/roadmap")}>
                내 로드맵 보기
              </button>
            </div>

            {/* 내 스펙 (Capabilities) */}
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
                {filteredCaps.map((cap) => (
                  <li key={cap.capability_id} className="mi-spec-item">
                    <span className="mi-spec-item-label">{cap.raw_text}</span>
                    <button className="mi-spec-remove" onClick={() => handleRemoveSpec(cap.capability_id)}>×</button>
                  </li>
                ))}
              </ul>

              <div className="mi-spec-input-row">
                <input
                  className="mi-input mi-spec-input"
                  placeholder={`${specTab} 추가 (예: TensorFlow)`}
                  value={specInput}
                  onChange={(e) => setSpecInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddSpec(); }}
                  disabled={addingSpec}
                />
                <button className="mi-add-btn" onClick={handleAddSpec} disabled={addingSpec}>
                  {addingSpec ? "..." : "추가"}
                </button>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
