import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../Home/Home.css";
import "./MyInfo.css";
import { AppSidebar } from "../../components/AppSidebar";
import { GoalDropdown } from "../../components/GoalDropdown";
import { LoadingContent } from "../../components/LoadingContent";
import chevronDownIcon from "../../assets/Chevron down.svg";
import { profileApi, capabilitiesApi, goalsApi } from "../../services/api";
import { useGoals } from "../../hooks/useGoals";
import type { GoalStatus } from "../../services/types";
import { useSession } from "../../context/SessionContext";

const SPEC_TABS = ["언어·도구", "자격증", "어학", "경력·활동"] as const;
type SpecTab = typeof SPEC_TABS[number];

const ONBOARDING_CATEGORY = "onboarding";
const CHAT_CATEGORY = "chat";

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
const ENROLLMENT_OPTIONS = [
  { value: "ENROLLED", label: "재학" },
  { value: "ON_LEAVE", label: "휴학" },
  { value: "GRADUATED", label: "졸업" },
];

export function MyInfo() {
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();

  useEffect(() => {
    if (!sessionLoading && !session) navigate("/");
  }, [session, sessionLoading, navigate]);
  const [goalOpen, setGoalOpen] = useState(false);
  const goalRef = useRef<HTMLDivElement>(null);

  const { goals, selectedGoalId, setSelectedGoalId, selectedGoalName, getGoalName, loading: goalsLoading } = useGoals();
  const [profileLoading, setProfileLoading] = useState(true);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);

  // Profile state
  const [major, setMajor] = useState("");
  const [majorConceptId, setMajorConceptId] = useState<string | null>(null);
  const [grade, setGrade] = useState<string | null>(null);
  const [enrollmentStatus, setEnrollmentStatus] = useState("");
  const [graduationOn, setGraduationOn] = useState("");
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
      setMajorConceptId(p.major_concept_id);
      setGrade(p.year ? YEAR_TO_GRADE[p.year] ?? null : null);
      setEnrollmentStatus(p.enrollment_status ?? "");
      setGraduationOn(p.expected_graduation_on ?? "");
      setProfileVersion(p.version);
    }).catch(console.error).finally(() => setProfileLoading(false));
  }, []);

  // Load capabilities on mount
  useEffect(() => {
    capabilitiesApi.list().then((res) => {
      setCapabilities(res.items as CapabilityItem[]);
    }).catch(console.error).finally(() => setCapabilitiesLoading(false));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (goalRef.current && !goalRef.current.contains(e.target as Node)) {
        setGoalOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSaveProfile() {
    setSavingProfile(true);
    try {
      // PUT replaces the whole profile, so every field is sent to avoid clearing it.
      const updated = await profileApi.update({
        expected_profile_version: profileVersion,
        major_raw: major || "미입력",
        ...(majorConceptId ? { major_concept_id: majorConceptId } : {}),
        ...(grade ? { year: GRADE_TO_YEAR[grade] } : {}),
        ...(enrollmentStatus ? { enrollment_status: enrollmentStatus } : {}),
        ...(graduationOn ? { expected_graduation_on: graduationOn } : {}),
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
  const onboardingCaps = capabilities.filter((c) => c.category === ONBOARDING_CATEGORY);
  const chatCaps = capabilities.filter((c) => c.category === CHAT_CATEGORY);

  return (
    <div className="home-layout">
      {/* Sidebar */}
      <AppSidebar>
        <div className="satisfaction-card">
          <p className="satisfaction-title">{selectedGoalName} 충족률</p>
          <div className="satisfaction-row">
            <span className="satisfaction-label">역량</span>
            <span className="satisfaction-pct">{capabilities.length}개 등록됨</span>
          </div>
        </div>
      </AppSidebar>

      {/* Main area */}
      <div className="main-area">
        <header className="main-header">
          <h2 className="main-title">내 정보</h2>
          <div className="goal-wrapper" ref={goalRef}>
            <button className="goal-button" aria-expanded={goalOpen} aria-controls="goal-dropdown" onClick={() => setGoalOpen((v) => !v)}>
              {selectedGoalName}
              <img src={chevronDownIcon} alt="▾" className="goal-arrow" />
            </button>
            <GoalDropdown open={goalOpen}>
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
            </GoalDropdown>
          </div>
        </header>

        <main className="main-content">
          <LoadingContent loading={goalsLoading || profileLoading || capabilitiesLoading}>
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
                <label className="mi-label" htmlFor="mi-grade">학년</label>
                <select
                  id="mi-grade"
                  className="mi-input"
                  value={grade ?? ""}
                  onChange={(e) => setGrade(e.target.value || null)}
                >
                  <option value="">학년 선택</option>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div className="mi-field">
                <label className="mi-label" htmlFor="mi-enrollment">재학 상태</label>
                <select
                  id="mi-enrollment"
                  className="mi-input"
                  value={enrollmentStatus}
                  onChange={(e) => setEnrollmentStatus(e.target.value)}
                >
                  <option value="">선택 안 함</option>
                  {ENROLLMENT_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="mi-field">
                <label className="mi-label" htmlFor="mi-graduation">졸업 (예정)일</label>
                <input
                  id="mi-graduation"
                  className="mi-input"
                  type="date"
                  value={graduationOn}
                  onChange={(e) => setGraduationOn(e.target.value)}
                />
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

              {onboardingCaps.length > 0 && (
                <>
                  <p className="mi-spec-sub">처음 설정할 때 고른 역량 · 본인 응답</p>
                  <ul className="mi-spec-list">
                    {onboardingCaps.map((cap) => (
                      <li key={cap.capability_id} className="mi-spec-item">
                        <span className="mi-spec-item-label">{cap.raw_text}</span>
                        <button className="mi-spec-remove" onClick={() => handleRemoveSpec(cap.capability_id)}>×</button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {chatCaps.length > 0 && (
                <>
                  <p className="mi-spec-sub">AI 대화에서 추가한 역량 · 본인 응답</p>
                  <ul className="mi-spec-list">
                    {chatCaps.map((cap) => (
                      <li key={cap.capability_id} className="mi-spec-item">
                        <span className="mi-spec-item-label">{cap.raw_text}</span>
                        <button className="mi-spec-remove" onClick={() => handleRemoveSpec(cap.capability_id)}>×</button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

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
          </LoadingContent>
        </main>
      </div>
    </div>
  );
}
