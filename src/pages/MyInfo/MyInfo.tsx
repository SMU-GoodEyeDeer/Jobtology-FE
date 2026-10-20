import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "../Home/Home.css";
import "./MyInfo.css";
import { AppSidebar } from "../../components/AppSidebar";
import { GoalDropdown } from "../../components/GoalDropdown";
import { LoadingContent } from "../../components/LoadingContent";
import chevronDownIcon from "../../assets/Chevron down.svg";
import { analysisApi, profileApi } from "../../services/api";
import type { ChatCapabilityCandidate, ProfileDetailResponse } from "../../services/types";
import { SpecManager } from "../../components/specs/SpecManager";
import type { SpecMutationNotice } from "../../components/specs/SpecManager";
import { isAnalyzableGoal, requiresActiveTargetedGoal } from "../../services/analysisGoal";
import { useGoals } from "../../hooks/useGoals";
import { useSession } from "../../context/SessionContext";
import { AccountSettings } from "./AccountSettings";
import { GoalManagement } from "./GoalManagement";
import { graduationDate, graduationSemester } from "./graduation";

const GRADES = ["1학년", "2학년", "3학년", "4학년"];
const ENROLLMENT_OPTIONS = [
  { value: "ENROLLED", label: "재학" },
  { value: "ON_LEAVE", label: "휴학" },
  { value: "GRADUATED", label: "졸업" },
];

export function MyInfo() {
  const navigate = useNavigate();
  const location = useLocation();
  const [specCandidate] = useState(() => (location.state as { specCandidate?: ChatCapabilityCandidate } | null)?.specCandidate);
  const { session, loading: sessionLoading } = useSession();

  useEffect(() => {
    if (specCandidate && location.state) {
      navigate({ pathname: location.pathname, hash: location.hash }, { replace: true, state: null });
    }
  }, [specCandidate, location.state, location.pathname, location.hash, navigate]);

  useEffect(() => {
    if (!sessionLoading && !session) navigate("/");
  }, [session, sessionLoading, navigate]);
  const [goalOpen, setGoalOpen] = useState(false);
  const goalRef = useRef<HTMLDivElement>(null);

  const { goals, selectedGoalId, setSelectedGoalId, selectedGoalName, getGoalName, loading: goalsLoading, error: goalsError, refresh: refreshGoals } = useGoals();
  const [profileLoading, setProfileLoading] = useState(true);

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

  const [capabilityCount, setCapabilityCount] = useState(0);
  const [specBusy, setSpecBusy] = useState(false);
  const [mutationNotice, setMutationNotice] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const mutationInFlight = useRef(false);
  const mutationPending = savingProfile || specBusy || reanalyzing;

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

  // Load profile on mount
  useEffect(() => {
    void loadProfile();
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
      if (status === 409) {
        try {
          const latest = await profileApi.get();
          setProfileVersion(latest.profile_version ?? latest.version);
        } catch { /* Keep the conflict message and local edits if refreshing fails. */ }
      }
      setProfileError(status === 409 ? "다른 정보가 먼저 변경됐어요. 입력 내용은 유지했어요. 저장을 다시 눌러 주세요." : status === 422 ? "프로필 입력값을 확인해 주세요. 입력 내용은 유지했어요." : "프로필을 저장하지 못했어요. 입력 내용은 유지했어요. 연결을 확인한 뒤 다시 저장해 주세요.");
    } finally {
      mutationInFlight.current = false;
      setSavingProfile(false);
    }
  }

  const handleSpecMutation = useCallback(({ requestVersion, profileVersion: version, message }: SpecMutationNotice) => {
    // Advance known versions only for our own sequential writes. An unrelated
    // profile change must still be detected before replacing local form fields.
    setProfileVersionValue(previous => previous === requestVersion ? Math.max(previous, version) : previous);
    setMutationNotice(message); setAnalysisError(null); setProfileSaved(false);
  }, []);

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

  const graduationYears = [...new Set([...(graduationYear ? [Number(graduationYear)] : []), ...Array.from({ length: 86 }, (_, index) => new Date().getFullYear() + 15 - index)])].sort((a, b) => b - a);

  return (
    <div className="home-layout">
      {/* Sidebar */}
      <AppSidebar>
        <div className="satisfaction-card">
          <p className="satisfaction-title">{selectedGoalName} 충족률</p>
          <div className="satisfaction-row">
            <span className="satisfaction-label">역량</span>
            <span className="satisfaction-pct">{capabilityCount}개 등록됨</span>
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
          <LoadingContent loading={goalsLoading || profileLoading}>
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

            <div className="mi-spec-card">
              <SpecManager occupationId={goals.find(goal => goal.status === "ACTIVE")?.occupation_id} candidate={specCandidate}
                disabled={savingProfile || reanalyzing} mutationLock={mutationInFlight} onBusyChange={setSpecBusy}
                onCountChange={setCapabilityCount} onMutation={handleSpecMutation} />
            </div>

          </div>
          </LoadingContent>
          <AccountSettings />
        </main>
      </div>
    </div>
  );
}
