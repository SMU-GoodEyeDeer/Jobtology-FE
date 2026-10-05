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
  const { data, update } = useSurvey();
  const hasChecklistStep = data.occupationId !== null;

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

  const missing = [
    ...(major.trim() ? [] : ["학과"]),
    ...(grade ? [] : ["학년"]),
  ];

  function handleNext() {
    if (missing.length > 0 || !grade) return;
    update({
      majorRaw: major.trim(),
      year: GRADE_TO_YEAR[grade],
    });
    navigate("/survey/4");
  }

  return (
    <div className="survey-page">
      <header className="survey-header">
        <img src={logoIcon} alt="로고" />
        <h1>잡톨로지</h1>
      </header>

      <div className="survey-card">
        <p className="survey-step">{hasChecklistStep ? "STEP 3 / 4" : "STEP 2 / 3"}</p>
        <p className="survey-title">현재 상황을 알려주세요 <span className="required-badge">필수</span></p>
        <p className="survey-subtitle">경로를 계산할 때 쓰여요</p>

        <div className="form-group">
          <label className="form-label">학과 <span className="required-mark">*</span></label>
          <input
            className="form-input"
            type="text"
            placeholder="휴먼AI공학과"
            value={major}
            onChange={(e) => setMajor(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">학년 <span className="required-mark">*</span></label>
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

        {missing.length > 0 && (
          <p className="required-hint">{missing.join("·")}을(를) 입력해야 다음으로 넘어갈 수 있어요.</p>
        )}

        <div className="survey-actions">
          <button className="btn-prev" onClick={() => navigate(hasChecklistStep ? "/survey/2" : "/survey/1")}>
            이전
          </button>
          <button className="btn-next" onClick={handleNext} disabled={missing.length > 0}>
            다음
          </button>
        </div>
      </div>
    </div>
  );
}
