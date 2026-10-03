import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Survey.css";
import logoIcon from "../../assets/logo.svg";
import { useSurvey } from "../../context/SurveyContext";
import { useOccupations } from "../../context/OccupationsContext";
import { useSession } from "../../context/SessionContext";

const FALLBACK_OPTIONS = [
  "AI 엔지니어",
  "백엔드 개발자",
  "프론트엔드 개발자",
  "데이터 분석",
  "기획 설계",
];

const DISCOVERY_LABEL = "아직 모르겠어요";

export function Survey1() {
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();
  const { update } = useSurvey();
  const { occupations, loading: occLoading } = useOccupations();

  useEffect(() => {
    if (!sessionLoading && !session) navigate("/");
  }, [session, sessionLoading, navigate]);
  const [selected, setSelected] = useState<string | null>(null);

  // Use API occupations if available, otherwise fallback
  const options: Array<{ label: string; id: string | null }> = occLoading || occupations.length === 0
    ? FALLBACK_OPTIONS.map((label) => ({ label, id: null }))
    : occupations.map((o) => ({ label: o.name, id: o.occupation_id }));

  // Always append discovery option
  const allOptions = [...options, { label: DISCOVERY_LABEL, id: null }];

  function handleNext() {
    if (!selected) return;

    if (selected === DISCOVERY_LABEL) {
      update({ occupationId: null, occupationName: null });
    } else {
      const match = allOptions.find((o) => o.label === selected);
      update({
        occupationId: match?.id ?? null,
        occupationName: selected,
      });
    }

    navigate("/survey/2");
  }

  return (
    <div className="survey-page">
      <header className="survey-header">
        <img src={logoIcon} alt="로고" />
        <h1>잡톨로지</h1>
      </header>

      <div className="survey-card">
        <p className="survey-step">STEP 1 / 3</p>
        <p className="survey-title">어떤 IT 직무를 목표로 하세요?</p>
        <p className="survey-subtitle">
          아직 정하지 않았어도 괜찮아요. 프로필을 보고 찾아드릴게요.
        </p>

        {occLoading && (
          <p style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", margin: "8px 0" }}>
            직무 목록 불러오는 중...
          </p>
        )}

        <div className="option-grid">
          {allOptions.map(({ label }) => (
            <button
              key={label}
              className={`option-btn${selected === label ? " selected" : ""}`}
              onClick={() => setSelected(label)}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          className="btn-next full-width"
          disabled={selected === null}
          onClick={handleNext}
        >
          다음
        </button>
      </div>
    </div>
  );
}
