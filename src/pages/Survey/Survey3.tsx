import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Survey.css";
import logoIcon from "../../assets/logo.svg";
import { useSurvey } from "../../context/SurveyContext";
import { profileApi, goalsApi, routePrefsApi, capabilitiesApi } from "../../services/api";
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

  // Every condition must be answered explicitly; nothing is pre-selected.
  const [answers, setAnswers] = useState<Record<string, boolean | null>>(
    Object.fromEntries(CONDITIONS.map((c) => [c.key, null]))
  );
  const unanswered = CONDITIONS.filter((c) => answers[c.key] === null).length;
  const toggles = Object.fromEntries(CONDITIONS.map((c) => [c.key, answers[c.key] === true]));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { loading: sessionLoading } = useSession();
  useEffect(() => {
    if (!sessionLoading && !session) navigate("/");
  }, [session, sessionLoading, navigate]);

  const answer = (key: string, value: boolean) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit() {
    if (unanswered > 0) return;
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
      let versionForGoal = afterPrefs.version;

      // Save the checklist answers in one request. A failure here must not
      // block onboarding; answers can still be added later from 내 정보.
      if (data.occupationId && data.capabilityAnswered) {
        try {
          const saved = await capabilitiesApi.replaceOnboarding(
            {
              expected_profile_version: versionForGoal,
              occupation_id: data.occupationId,
              item_ids: data.capabilityItemIds,
            },
            `onboarding-${data.occupationId}-v${versionForGoal}`
          );
          versionForGoal = saved.profile_version;
        } catch (capabilityError) {
          console.warn("Onboarding capability save skipped:", capabilityError);
          versionForGoal = (await profileApi.get()).version;
        }
      }

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
        <p className="survey-step">{data.occupationId ? "STEP 4 / 4" : "STEP 3 / 3"}</p>
        <p className="survey-title">원하는 조건을 알려주세요 <span className="required-badge">필수</span></p>
        <p className="survey-subtitle">모든 조건에 예/아니오로 답해주세요. 답에 맞춰 경로를 만들어요.</p>

        <p className="toggle-section-label">조건</p>
        <div className="toggle-list">
          {CONDITIONS.map(({ label, key }) => (
            <div className="toggle-item" key={key}>
              <span className="toggle-label">{label}</span>
              <div className="yesno" role="radiogroup" aria-label={label}>
                {([true, false] as const).map((value) => (
                  <button
                    key={String(value)}
                    type="button"
                    role="radio"
                    aria-checked={answers[key] === value}
                    className={`yesno-btn${answers[key] === value ? " selected" : ""}`}
                    onClick={() => answer(key, value)}
                  >
                    {value ? "예" : "아니오"}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {unanswered > 0 && (
          <p className="required-hint">답하지 않은 조건이 {unanswered}개 있어요. 모두 답해야 시작할 수 있어요.</p>
        )}

        {error && <p className="survey-error">{error}</p>}

        <div className="survey-actions">
          <button className="btn-prev" onClick={() => navigate("/survey/3")} disabled={submitting}>
            이전
          </button>
          <button className="btn-next" onClick={handleSubmit} disabled={submitting || unanswered > 0}>
            {submitting ? "저장 중..." : "시작하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
