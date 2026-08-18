import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Survey.css";
import logoIcon from "../../assets/logo.svg";

const OPTIONS = [
  "AI 엔지니어",
  "백엔드 개발자",
  "프론트엔드 개발자",
  "데이터 분석",
  "기획 설계",
  "아직 모르겠어요",
];

export function Survey1() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);

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

        <div className="option-grid">
          {OPTIONS.map((opt) => (
            <button
              key={opt}
              className={`option-btn${selected === opt ? " selected" : ""}`}
              onClick={() => setSelected(opt)}
            >
              {opt}
            </button>
          ))}
        </div>

        <button
          className="btn-next full-width"
          disabled={selected === null}
          onClick={() => navigate("/survey/2")}
        >
          다음
        </button>
      </div>
    </div>
  );
}
