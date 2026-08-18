import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Survey.css";
import logoIcon from "../../assets/logo.svg";

const CONDITIONS = [
  "교육비 부담이 커요",
  "학업·알바와 병행해야 해요",
  "최대한 빨리 취업하고 싶어요",
  "내세울 프로젝트·경험이 부족해요",
  "전공과 다른 직무로 가려고 해요",
];

export function Survey3() {
  const navigate = useNavigate();
  const [toggles, setToggles] = useState<boolean[]>(CONDITIONS.map(() => true));

  const toggle = (i: number) =>
    setToggles((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

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
          {CONDITIONS.map((label, i) => (
            <div className="toggle-item" key={label}>
              <span className="toggle-label">{label}</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={toggles[i]}
                  onChange={() => toggle(i)}
                />
                <span className="toggle-track" />
              </label>
            </div>
          ))}
        </div>

        <div className="survey-actions">
          <button className="btn-prev" onClick={() => navigate("/survey/2")}>
            이전
          </button>
          <button className="btn-next" onClick={() => navigate("/home/first")}>
            시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
