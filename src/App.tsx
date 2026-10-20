import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SessionProvider } from "./context/SessionContext";
import { OccupationsProvider } from "./context/OccupationsContext";
import { Onboarding } from "./pages/Onboarding/Onboarding";
import { OnboardingChat } from "./pages/OnboardingChat/OnboardingChat";
import { Home } from "./pages/Home/Home";
import { HomeFirst } from "./pages/Home/HomeFirst";
import { Chat } from "./pages/Chat/Chat";
import { Roadmap } from "./pages/Roadmap/Roadmap";
import { Analysis } from "./pages/Analysis/Analysis";
import { Postings } from "./pages/Postings/Postings";
import { Progress } from "./pages/Progress/Progress";
import { MyInfo } from "./pages/MyInfo/MyInfo";
import { RequireSession } from "./components/RequireSession";
import "./App.css";

const INTRO_PATHS = ["/", "/onboarding"];

function AnimatedRoutes() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  // The intro routes share one key so the `/` → `/onboarding` handoff never waits on a fade.
  const fadeKey = INTRO_PATHS.includes(location.pathname) || location.pathname.startsWith("/survey")
    ? "intro"
    : location.pathname;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={fadeKey}
        className="page-fade"
        initial={{ "--page-opacity": 0 }}
        animate={{ "--page-opacity": 1 }}
        exit={{ "--page-opacity": 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.15, ease: "easeOut" }}
      >
        <Routes location={location}>
          <Route path="/" element={<Onboarding />} />
          <Route element={<RequireSession />}>
            <Route path="/onboarding" element={<OnboardingChat />} />
            <Route path="/survey/*" element={<Navigate to="/onboarding" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/home/first" element={<HomeFirst />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/roadmap" element={<Roadmap />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/postings" element={<Postings />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/myinfo" element={<MyInfo />} />
          </Route>
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <OccupationsProvider>
          <AnimatedRoutes />
        </OccupationsProvider>
      </SessionProvider>
    </BrowserRouter>
  );
}
