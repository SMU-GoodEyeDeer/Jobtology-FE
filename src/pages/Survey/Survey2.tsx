import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Survey.css";
import logoIcon from "../../assets/logo.svg";
import { useSurvey } from "../../context/SurveyContext";
import { useSession } from "../../context/SessionContext";

const GRADES = ["1학년", "2학년", "3학년", "4학년"];
const GRADE_TO_YEAR: Record<string, number> = {
  "1학년": 1,
  "2학년": 2,
  "3학년": 3,
  "4학년": 4,
};

export function Survey2() {
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();
  const { update } = useSurvey();

  useEffect(() => {
    if (!sessionLoading && !session) navigate("/");
  }, [session, sessionLoading, navigate]);
  const [major, setMajor] = useState("");
  const [grade, setGrade] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleNext() {
    update({
      majorRaw: major || "미입력",
      year: grade ? GRADE_TO_YEAR[grade] : null,
    });
    navigate("/survey/3");
  }

  return (
    <div className="survey-page">
      <header className="survey-header">
        <img src={logoIcon} alt="로고" />
        <h1>잡톨로지</h1>
      </header>

      <div className="survey-card">
        <p className="survey-step">STEP 2 / 3</p>
        <p className="survey-title">현재 상황을 알려주세요</p>
        <p className="survey-subtitle">경로를 계산할 때 쓰여요</p>

        <div className="form-group">
          <label className="form-label">학과</label>
          <input
            className="form-input"
            type="text"
            placeholder="휴먼AI공학과"
            value={major}
            onChange={(e) => setMajor(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">학년</label>
          <div className="custom-select" ref={dropdownRef}>
            <button
              className={`custom-select-trigger${open ? " open" : ""}`}
              onClick={() => setOpen((v) => !v)}
              type="button"
            >
              <span className={grade ? "" : "placeholder"}>
                {grade ?? "학년 선택"}
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {open && (
              <ul className="custom-select-list">
                {GRADES.map((g) => (
                  <li
                    key={g}
                    className={`custom-select-option${grade === g ? " selected" : ""}`}
                    onClick={() => { setGrade(g); setOpen(false); }}
                  >
                    {g}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="survey-actions">
          <button className="btn-prev" onClick={() => navigate("/survey/1")}>
            이전
          </button>
          <button className="btn-next" onClick={handleNext}>
            다음
          </button>
        </div>
      </div>
    </div>
  );
}
