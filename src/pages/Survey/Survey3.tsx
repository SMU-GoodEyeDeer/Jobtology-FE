import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Survey.css";
import logoIcon from "../../assets/logo.svg";
import { useSurvey } from "../../context/SurveyContext";
import { profileApi, goalsApi, routePrefsApi } from "../../services/api";
import { useSession } from "../../context/SessionContext";

interface Condition {
  label: string;
  key: keyof Pick<
    ReturnType<typeof useSurvey>["data"],
    "lowCostBudget" | "limitedHours" | "fastestPath" | "needsPortfolio" | "careerSwitch"
  >;
}

const CONDITIONS: Condition[] = [
  { label: "교육비 부담이 커요", key: "lowCostBudget" },
  { label: "학업·알바와 병행해야 해요", key: "limitedHours" },
  { label: "최대한 빨리 취업하고 싶어요", key: "fastestPath" },
  { label: "내세울 프로젝트·경험이 부족해요", key: "needsPortfolio" },
  { label: "전공과 다른 직무로 가려고 해요", key: "careerSwitch" },
];

export function Survey3() {
  const navigate = useNavigate();
  const { data, update } = useSurvey();
  const { session, refresh: refreshSession } = useSession();

  // Initialize toggles from context (all true by default)
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(CONDITIONS.map((c) => [c.key, true]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { loading: sessionLoading } = useSession();
  useEffect(() => {
    if (!sessionLoading && !session) navigate("/");
  }, [session, sessionLoading, navigate]);

  const toggle = (key: string) =>
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    // Sync conditions into survey context
    update({
      lowCostBudget: toggles["lowCostBudget"],
      limitedHours: toggles["limitedHours"],
      fastestPath: toggles["fastestPath"],
      needsPortfolio: toggles["needsPortfolio"],
      careerSwitch: toggles["careerSwitch"],
    });

    try {
      // 1. Get current profile version
      let profileVersion = session?.profile_version ?? 1;
      try {
        const profile = await profileApi.get();
        profileVersion = profile.version;
      } catch {
        // If profile fetch fails, use session version
      }

      // 2. Save profile (major + year)
      await profileApi.update({
        expected_profile_version: profileVersion,
        major_raw: data.majorRaw || "미입력",
        ...(data.year ? { year: data.year } : {}),
      });

      // Re-fetch profile to get updated version
      const updatedProfile = await profileApi.get();
      const newVersion = updatedProfile.version;

      // 3. Save route preferences
      await routePrefsApi.update({
        expected_profile_version: newVersion,
        available_hours_per_week: toggles["limitedHours"] ? 10 : 20,
        availability_source: "survey",
        budget_mode: toggles["lowCostBudget"] ? "LOW_COST" : "REGULAR",
        fastest_path: toggles["fastestPath"],
        needs_portfolio: toggles["needsPortfolio"],
        career_switch: toggles["careerSwitch"],
      });

      // Re-fetch to get next version
      const afterPrefs = await profileApi.get();
      const versionForGoal = afterPrefs.version;

      // 4. Create goal
      const targetBy = new Date();
      targetBy.setMonth(targetBy.getMonth() + 6);

      await goalsApi.create({
        expected_profile_version: versionForGoal,
        goal_mode: data.occupationId ? "TARGETED" : "DISCOVERY",
        target_by: targetBy.toISOString(),
        timezone: "Asia/Seoul",
        original_time_phrase: "6개월 내",
        ...(data.occupationId ? { occupation_id: data.occupationId } : {}),
      });

      // Refresh session to get updated profile_version
      await refreshSession();

      navigate("/home/first");
    } catch (err) {
      console.error("Survey submit error:", err);
      setError("저장 중 오류가 발생했어요. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="survey-page">
      <header className="survey-header">
        <img src={logoIcon} alt="로고" />
        <h1>잡톨로지</h1>
      </header>

      <div className="survey-card">
        <p className="survey-step">STEP 3 / 3</p>
        <p className="survey-title">원하는 조건을 알려주세요</p>
        <p className="survey-subtitle">맞지 않는 조건은 빼고 경로를 만들어요.</p>

        <p className="toggle-section-label">조건</p>
        <div className="toggle-list">
          {CONDITIONS.map(({ label, key }) => (
            <div className="toggle-item" key={key}>
              <span className="toggle-label">{label}</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={toggles[key]}
                  onChange={() => toggle(key)}
                />
                <span className="toggle-track" />
              </label>
            </div>
          ))}
        </div>

        {error && <p className="survey-error">{error}</p>}

        <div className="survey-actions">
          <button className="btn-prev" onClick={() => navigate("/survey/2")} disabled={submitting}>
            이전
          </button>
          <button className="btn-next" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "저장 중..." : "시작하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
