import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Onboarding.css";
import UsersIcon from "../../assets/Users.svg";
import CheckCircleIcon from "../../assets/Check circle.svg";
import RefreshCcwIcon from "../../assets/Refresh ccw.svg";
import { useSession } from "../../context/SessionContext";
import { GOOGLE_LOGIN_URL, goalsApi } from "../../services/api";
import { BrandMark } from "../OnboardingChat/parts";
import { markIntroStart } from "../OnboardingChat/timings";
import { ThemeToggle } from "../../components/ThemeToggle";

export function Onboarding() {
  const navigate = useNavigate();
  const { session, loading, error, refresh } = useSession();

  useEffect(() => {
    if (loading || session) markIntroStart();
    if (loading || !session) return;
    goalsApi.list().then(({ items }) => {
      navigate(items.some((goal) => goal.status === "ACTIVE") ? "/home" : "/onboarding");
    }).catch(() => navigate("/onboarding"));
  }, [session, loading, navigate]);

  // Logo-only splash using the same .ob-intro styles as the chat intro overlay,
  // so the `/` → `/onboarding` handoff is pixel-identical and invisible.
  if (loading || session) {
    return (
      <div className="ob-intro" role="status" aria-label="잡톨로지 로딩 중">
        <div className="ob-intro-stack">
          <BrandMark />
          <span className="ob-intro-word">Jobtology</span>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding">
      <div className="onboarding-theme"><ThemeToggle compact /></div>
      <div className="hero">
        <h1>
          진로 설계, 뭐부터
          <br />
          해야 할지 <span className="highlight">막막하다면</span>
        </h1>
        <p className="subtitle">
          목표 직무에 필요한 역량과 학습 경로를 찾아보세요.
        </p>
        {error ? (
          <>
            <p className="caption" role="alert">{error}</p>
            <button className="cta-btn" onClick={() => { void refresh(); }}>다시 시도</button>
          </>
        ) : (
          <>
            <a className="cta-btn" href={GOOGLE_LOGIN_URL}>Google로 시작하기</a>
          </>
        )}
      </div>

      <div className="cards">
        <div className="card">
          <img src={UsersIcon} alt="" width={22} height={22} />
          <p className="card-title">내 상황에 맞는 경로</p>
          <p className="card-desc">
            목표·역량·학습 시간 반영
          </p>
        </div>
        <div className="card">
          <img src={CheckCircleIcon} alt="" width={22} height={22} />
          <p className="card-title">데이터 기반 역량 분석</p>
          <p className="card-desc">채용공고와 NCS 역량 참고</p>
        </div>
        <div className="card">
          <img src={RefreshCcwIcon} alt="" width={22} height={22} />
          <p className="card-title">경험에 따른 계획 조정</p>
          <p className="card-desc">스펙 변경 후 다시 분석</p>
        </div>
      </div>
    </div>
  );
}
