import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./Onboarding.css";
import { useSession } from "../../context/SessionContext";
import { goalsApi } from "../../services/api";
import { GoogleSignIn } from "../../components/GoogleSignIn";
import { BrandMark } from "../OnboardingChat/parts";
import { markIntroStart } from "../OnboardingChat/timings";
import { ThemeToggle } from "../../components/ThemeToggle";
import { LandingGraph } from "./LandingGraph";
import { BrandLogo, BrandWordmark } from "../../components/BrandLogo";
import { useMouseField } from "./useMouseField";
import { WarpText } from "./WarpText";
import { LandingParticles } from "./LandingParticles";

export function Onboarding() {
  const navigate = useNavigate();
  const { session, loading, error, refresh } = useSession();
  const page = useRef<HTMLElement>(null);
  useMouseField(page, !loading && !session);

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
          <BrandWordmark className="ob-intro-word" />
        </div>
      </div>
    );
  }

  return <main className="landing-page" ref={page}>
    <LandingParticles />
    <header className="landing-header">
      <a className="landing-brand" href="/" aria-label="Jobtology 홈"><BrandLogo /></a>
      <div className="landing-nav"><ThemeToggle compact /></div>
    </header>
    <section className="landing-hero" aria-labelledby="landing-title">
      <h1 id="landing-title"><WarpText text="나의 다음을," /> <span className="landing-title-accent"><WarpText text="연결하다." /></span></h1>
      <p><WarpText text="지금의 경험과 역량에서, 나만의 커리어 경로까지." strength={7} radius={100} /></p>
      {error ? <div className="landing-login-error"><p role="alert" data-mouse-field="10">{error}</p><button className="landing-cta" data-mouse-field="10" onClick={() => { void refresh(); }}>다시 시도<span aria-hidden="true">↗</span></button></div>
        : <GoogleSignIn />}
    </section>
    <LandingGraph />
    <footer className="landing-footer" data-mouse-field="10">© {new Date().getFullYear()} Jobtology</footer>
  </main>;
}
