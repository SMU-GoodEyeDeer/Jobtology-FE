import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../Home/Home.css";
import "./MyInfo.css";
import { AppSidebar } from "../../components/AppSidebar";
import { GoalDropdown } from "../../components/GoalDropdown";
import { LoadingContent } from "../../components/LoadingContent";
import chevronDownIcon from "../../assets/Chevron down.svg";
import { analysisApi, profileApi, capabilitiesApi } from "../../services/api";
import type { CapabilityDetailResponse, ProfileDetailResponse } from "../../services/types";
import { isAnalyzableGoal, requiresActiveTargetedGoal } from "../../services/analysisGoal";
import { useGoals } from "../../hooks/useGoals";
import { useSession } from "../../context/SessionContext";
import { AccountSettings } from "./AccountSettings";
import { GoalManagement } from "./GoalManagement";
import { graduationDate, graduationSemester } from "./graduation";

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

const GRADES = ["1학년", "2학년", "3학년", "4학년"];
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

  const { goals, selectedGoalId, setSelectedGoalId, selectedGoalName, getGoalName, loading: goalsLoading, error: goalsError, refresh: refreshGoals } = useGoals();
  const [profileLoading, setProfileLoading] = useState(true);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);

  // Profile state
  const [major, setMajor] = useState("");
  const [majorConceptId, setMajorConceptId] = useState<string | null>(null);
  const [grade, setGrade] = useState<string | null>(null);
  const [enrollmentStatus, setEnrollmentStatus] = useState("");
  const [graduationOn, setGraduationOn] = useState("");
  const [profileVersion, setProfileVersionValue] = useState(1);
  const setProfileVersion = useCallback((version: number) => {
    setProfileVersionValue(previous => Math.max(previous, version));
  }, []);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [graduationYear, setGraduationYear] = useState("");
  const [graduationTerm, setGraduationTerm] = useState("");
  const [graduationEdited, setGraduationEdited] = useState(false);

  // Capabilities state
  const [capabilities, setCapabilities] = useState<CapabilityDetailResponse[]>([]);
  const [specTab, setSpecTab] = useState<SpecTab>("언어·도구");
  const [specInput, setSpecInput] = useState("");
  const [addingSpec, setAddingSpec] = useState(false);
  const [removingSpecId, setRemovingSpecId] = useState<string | null>(null);
  const [capabilitiesReady, setCapabilitiesReady] = useState(false);
  const [capabilitiesError, setCapabilitiesError] = useState<string | null>(null);
  const [mutationNotice, setMutationNotice] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const mutationInFlight = useRef(false);
  const mutationPending = savingProfile || addingSpec || removingSpecId !== null || reanalyzing;

  function applyProfile(p: ProfileDetailResponse) {
    setMajor(p.major_raw ?? "");
    setMajorConceptId(p.major_concept_id);
    setGrade(p.year ? `${p.year}학년` : null);
    setEnrollmentStatus(p.enrollment_status ?? "");
    setGraduationOn(p.expected_graduation_on ?? "");
    setGraduationYear(p.expected_graduation_on?.slice(0, 4) ?? "");
    setGraduationTerm(graduationSemester(p.expected_graduation_on ?? ""));
    setGraduationEdited(false);
    setProfileVersion(p.profile_version ?? p.version);
  }

  async function loadProfile() {
    setProfileLoading(true); setProfileError(null);
    try { applyProfile(await profileApi.get()); setProfileReady(true); }
    catch { setProfileError("프로필을 불러오지 못했어요. 다시 불러온 뒤 수정해 주세요."); }
    finally { setProfileLoading(false); }
  }

  async function loadCapabilities() {
    setCapabilitiesLoading(true); setCapabilitiesError(null);
    try {
      const response = await capabilitiesApi.list();
      setCapabilities(response.items.filter(item => item.lifecycle === "ACTIVE"));
      setCapabilitiesReady(true);
    } catch { setCapabilitiesError("등록한 역량을 불러오지 못했어요. 다시 불러온 뒤 수정해 주세요."); }
    finally { setCapabilitiesLoading(false); }
  }

  // Load profile on mount
  useEffect(() => {
    void loadProfile();
  }, []);

  // Load capabilities on mount
  useEffect(() => {
    void loadCapabilities();
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
    if (mutationInFlight.current || !profileReady) return;
    let savedGraduation: string | null;
    try { savedGraduation = graduationEdited ? graduationDate(graduationYear, graduationTerm) : graduationOn || null; }
    catch { setProfileError("졸업 연도와 2월·8월 학기를 함께 선택하거나 둘 다 미정으로 선택해 주세요."); return; }
    mutationInFlight.current = true;
    setSavingProfile(true);
    setProfileError(null); setProfileSaved(false); setMutationNotice(null); setAnalysisError(null);
    try {
      const current = await profileApi.get();
      const currentVersion = current.profile_version ?? current.version;
      if (currentVersion !== profileVersion) {
        setProfileVersion(currentVersion);
        setProfileError("다른 정보가 먼저 변경됐어요. 입력 내용은 유지했어요. 저장을 다시 눌러 주세요.");
        return;
      }
      const majorRaw = major.trim();
      const updated = await profileApi.update({
        expected_profile_version: currentVersion,
        major_raw: majorRaw,
        major_concept_id: majorConceptId,
        year: grade ? Number.parseInt(grade, 10) : null,
        enrollment_status: enrollmentStatus || null,
        expected_graduation_on: savedGraduation,
      });
      setProfileVersion(updated.profile_version ?? updated.version);
      setMajor(majorRaw); setGraduationOn(savedGraduation ?? ""); setGraduationEdited(false);
      setProfileSaved(true);
      setMutationNotice("프로필을 저장했어요. 학적 정보는 보관되며, 역량 판정은 직무와 연결된 스펙을 기준으로 계산해요.");
    } catch (err) {
      const status = (err as { status?: number })?.status;
      setProfileError(status === 409 ? "다른 정보가 먼저 변경됐어요. 입력 내용은 유지했어요. 저장을 다시 눌러 주세요." : status === 422 ? "프로필 입력값을 확인해 주세요. 입력 내용은 유지했어요." : "프로필을 저장하지 못했어요. 입력 내용은 유지했어요. 연결을 확인한 뒤 다시 저장해 주세요.");
    } finally {
      mutationInFlight.current = false;
      setSavingProfile(false);
    }
  }

  async function handleAddSpec() {
    const trimmed = specInput.trim();
    if (!trimmed || mutationInFlight.current || !capabilitiesReady) return;
    mutationInFlight.current = true;
    setAddingSpec(true);
    setCapabilitiesError(null); setMutationNotice(null); setAnalysisError(null); setProfileSaved(false);
    try {
      const profile = await profileApi.get();
      const category = TAB_TO_CATEGORY[specTab];
      const created = await capabilitiesApi.create({
        expected_profile_version: profile.profile_version ?? profile.version,
        category,
        raw_text: trimmed,
      });
      setProfileVersion(created.profile_version);
      setCapabilities(prev => [...prev.filter(item => item.capability_id !== created.capability_id), {
        capability_id: created.capability_id, category, raw_text: trimmed, lifecycle: "ACTIVE",
      }]);
      setSpecInput("");
      setMutationNotice(`‘${trimmed}’ 역량을 추가했어요. 분석에 연결되는 항목은 다시 분석해서 확인할 수 있어요.`);
    } catch (err) {
      setCapabilitiesError((err as { status?: number })?.status === 409 ? "다른 정보가 변경됐어요. 입력 내용은 유지했어요. 추가를 다시 눌러 주세요." : "역량을 추가하지 못했어요. 입력 내용은 유지했어요. 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      mutationInFlight.current = false;
      setAddingSpec(false);
    }
  }

  async function handleRemoveSpec(capabilityId: string) {
    if (mutationInFlight.current || !capabilitiesReady) return;
    mutationInFlight.current = true; setRemovingSpecId(capabilityId);
    setCapabilitiesError(null); setMutationNotice(null); setAnalysisError(null); setProfileSaved(false);
    try {
      const profile = await profileApi.get();
      const deleted = await capabilitiesApi.delete(capabilityId, { expected_profile_version: profile.profile_version ?? profile.version });
      setProfileVersion(deleted.profile_version);
      setCapabilities((prev) => prev.filter((c) => c.capability_id !== capabilityId));
      setMutationNotice("역량을 삭제했어요. 분석 결과를 갱신하려면 다시 분석해 주세요.");
    } catch (err) {
      if ((err as { status?: number })?.status === 404) await loadCapabilities();
      else setCapabilitiesError((err as { status?: number })?.status === 409 ? "다른 정보가 변경됐어요. 역량은 삭제되지 않았어요. 삭제를 다시 눌러 주세요." : "역량을 삭제하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally { mutationInFlight.current = false; setRemovingSpecId(null); }
  }

  async function handleReanalyze() {
    const goal = goals.find(isAnalyzableGoal);
    if (!goal || mutationInFlight.current) return;
    mutationInFlight.current = true; setReanalyzing(true); setAnalysisError(null);
    try {
      const profile = await profileApi.get();
      await analysisApi.create({ goal_id: goal.goal_id, expected_profile_version: profile.profile_version ?? profile.version, basis_type: "EDITORIAL" });
      navigate("/analysis");
    } catch (cause) {
      setAnalysisError(requiresActiveTargetedGoal(cause) ? "직무가 정해진 활성 목표를 먼저 설정해 주세요." : "저장한 내용은 유지됐어요. 분석을 요청하지 못했으니 잠시 후 다시 시도해 주세요.");
    } finally { mutationInFlight.current = false; setReanalyzing(false); }
  }

  const filteredCaps = capabilities.filter(
    (c) => c.category === TAB_TO_CATEGORY[specTab]
  );
  const onboardingCaps = capabilities.filter((c) => c.category === ONBOARDING_CATEGORY);
  const chatCaps = capabilities.filter((c) => c.category === CHAT_CATEGORY);
  const otherCaps = capabilities.filter(c => !Object.values(TAB_TO_CATEGORY).includes(c.category) && ![ONBOARDING_CATEGORY, CHAT_CATEGORY].includes(c.category));
  const graduationYears = [...new Set([...(graduationYear ? [Number(graduationYear)] : []), ...Array.from({ length: 86 }, (_, index) => new Date().getFullYear() + 15 - index)])].sort((a, b) => b - a);

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
          <GoalManagement goals={goals} loading={goalsLoading} error={goalsError} refresh={refreshGoals} onProfileVersionChange={setProfileVersion} />
          {mutationNotice && <section className="mi-mutation-notice" aria-label="저장 결과">
            <p role="status">{mutationNotice}</p>
            <p className="mi-persistence-help">직무와 연결되는 역량은 경로 계산에 반영돼요. 다시 분석해 변경 결과를 확인할 수 있어요. 기존 진행 중인 로드맵은 자동으로 교체하지 않아요.</p>
            <div className="mi-persistence-actions">{goals.some(isAnalyzableGoal) ? <button className="mi-save-btn" disabled={mutationPending} onClick={() => void handleReanalyze()}>{reanalyzing ? "분석 요청 중..." : "변경 내용으로 다시 분석"}</button> : <Link to="/myinfo#goals">분석할 목표 설정하기</Link>}<Link to="/analysis">분석 화면 열기 →</Link></div>
            {analysisError && <p className="mi-persistence-error" role="alert">{analysisError} <Link to="/myinfo#goals">목표 확인</Link></p>}
          </section>}
          <LoadingContent loading={goalsLoading || profileLoading || capabilitiesLoading}>
          <div className="mi-two-col">

            {/* 내 프로필 */}
            <div className="mi-profile-card">
              <div className="mi-card-header">
                <p className="mi-card-title">내 프로필</p>
                <button
                  className="mi-save-btn"
                  onClick={handleSaveProfile}
                  disabled={mutationPending || !profileReady}
                >
                  {savingProfile ? "저장 중..." : profileSaved ? "저장됨!" : "저장"}
                </button>
              </div>
              {profileError && <div className="mi-persistence-error" role="alert"><p>{profileError}</p>{!profileReady && <button className="mi-save-btn" onClick={() => void loadProfile()} disabled={profileLoading}>프로필 다시 불러오기</button>}</div>}
              {profileSaved && <p className="mi-persistence-success" role="status">프로필을 저장했어요.</p>}

              <div className="mi-field">
                <label className="mi-label" htmlFor="mi-major">학과</label>
                <input
                  id="mi-major"
                  className="mi-input"
                  value={major}
                  maxLength={500}
                  disabled={mutationPending || !profileReady}
                  onChange={(e) => { setMajor(e.target.value); setMajorConceptId(null); setProfileSaved(false); }}
                  placeholder="학과를 입력해주세요"
                />
              </div>

              <div className="mi-field">
                <label className="mi-label" htmlFor="mi-grade">학년</label>
                <select
                  id="mi-grade"
                  className="mi-input"
                  value={grade ?? ""}
                  disabled={mutationPending || !profileReady}
                  onChange={(e) => { setGrade(e.target.value || null); setProfileSaved(false); }}
                >
                  <option value="">학년 선택</option>
                  {[...new Set([...GRADES, ...(grade ? [grade] : [])])].map((g) => (
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
                  disabled={mutationPending || !profileReady}
                  onChange={(e) => { setEnrollmentStatus(e.target.value); setProfileSaved(false); }}
                >
                  <option value="">선택 안 함</option>
                  {ENROLLMENT_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="mi-graduation-fields">
                <label className="mi-field"><span className="mi-label">졸업 (예정) 연도</span><select id="mi-graduation-year" className="mi-input" value={graduationYear} disabled={mutationPending || !profileReady} onChange={event => {
                  setGraduationYear(event.target.value); if (!event.target.value) setGraduationTerm(""); setGraduationEdited(true); setProfileSaved(false);
                }}><option value="">미정</option>{graduationYears.map(year => <option key={year} value={year}>{year}년</option>)}</select></label>
                <label className="mi-field"><span className="mi-label">졸업 학기</span><select id="mi-graduation-term" className="mi-input" value={graduationTerm} disabled={mutationPending || !profileReady} onChange={event => {
                  setGraduationTerm(event.target.value); if (!event.target.value) setGraduationYear(""); setGraduationEdited(true); setProfileSaved(false);
                }}><option value="">미정</option><option value="02">2월 졸업 (전기)</option><option value="08">8월 졸업 (후기)</option></select></label>
              </div>
              {graduationOn && !graduationEdited && <p className="mi-persistence-help">기존 졸업일 {graduationOn}은 연도나 학기를 바꾸기 전까지 유지돼요.</p>}

              <button className="mi-roadmap-btn" onClick={() => navigate("/roadmap")}>
                내 로드맵 보기
              </button>
            </div>

            {/* 내 스펙 (Capabilities) */}
            <div className="mi-spec-card">
              <p className="mi-card-title">내 스펙</p>
              <p className="mi-spec-sub">직무와 연결되는 역량을 분석과 경로 추천에 반영해요</p>
              {capabilitiesError && <div className="mi-persistence-error" role="alert"><p>{capabilitiesError}</p>{!capabilitiesReady && <button className="mi-save-btn" onClick={() => void loadCapabilities()} disabled={capabilitiesLoading}>역량 다시 불러오기</button>}</div>}

              <div className="mi-spec-tab-row">
                {SPEC_TABS.map((tab) => (
                  <button
                    key={tab}
                    className={`mi-spec-tab ${specTab === tab ? "mi-spec-tab--active" : ""}`}
                    disabled={mutationPending}
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
                        <button className="mi-spec-remove" disabled={mutationPending} aria-label={`${cap.raw_text} 삭제`} onClick={() => void handleRemoveSpec(cap.capability_id)}>{removingSpecId === cap.capability_id ? "삭제 중..." : "×"}</button>
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
                        <button className="mi-spec-remove" disabled={mutationPending} aria-label={`${cap.raw_text} 삭제`} onClick={() => void handleRemoveSpec(cap.capability_id)}>{removingSpecId === cap.capability_id ? "삭제 중..." : "×"}</button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <ul className="mi-spec-list">
                {filteredCaps.map((cap) => (
                  <li key={cap.capability_id} className="mi-spec-item">
                    <span className="mi-spec-item-label">{cap.raw_text}</span>
                    <button className="mi-spec-remove" disabled={mutationPending} aria-label={`${cap.raw_text} 삭제`} onClick={() => void handleRemoveSpec(cap.capability_id)}>{removingSpecId === cap.capability_id ? "삭제 중..." : "×"}</button>
                  </li>
                ))}
              </ul>
              {!filteredCaps.length && <p className="mi-persistence-help">등록한 {specTab} 항목이 없어요.</p>}
              {otherCaps.length > 0 && <><p className="mi-spec-sub">기타 등록 역량</p><ul className="mi-spec-list">{otherCaps.map(cap => <li key={cap.capability_id} className="mi-spec-item"><span className="mi-spec-item-label">{cap.raw_text}</span><button className="mi-spec-remove" disabled={mutationPending} aria-label={`${cap.raw_text} 삭제`} onClick={() => void handleRemoveSpec(cap.capability_id)}>{removingSpecId === cap.capability_id ? "삭제 중..." : "×"}</button></li>)}</ul></>}

              <div className="mi-spec-input-row">
                <input
                  className="mi-input mi-spec-input"
                  placeholder={`${specTab} 추가 (예: TensorFlow)`}
                  aria-label={`${specTab} 추가`}
                  maxLength={500}
                  value={specInput}
                  onChange={(e) => setSpecInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddSpec(); }}
                  disabled={mutationPending || !capabilitiesReady}
                />
                <button className="mi-add-btn" onClick={() => void handleAddSpec()} disabled={mutationPending || !capabilitiesReady || !specInput.trim()}>
                  {addingSpec ? "추가 중..." : "추가"}
                </button>
              </div>
            </div>

          </div>
          </LoadingContent>
          <AccountSettings />
        </main>
      </div>
    </div>
  );
}
