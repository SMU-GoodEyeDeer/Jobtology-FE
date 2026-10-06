import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SessionProvider } from "./context/SessionContext";
import { OccupationsProvider } from "./context/OccupationsContext";
import { Onboarding } from "./pages/Onboarding/Onboarding";
import { OnboardingChat } from "./pages/OnboardingChat/OnboardingChat";
import { Home } from "./pages/Home/Home";
import { HomeFirst } from "./pages/Home/HomeFirst";
import { Chat } from "./pages/Chat/Chat";
import { Roadmap } from "./pages/Roadmap/Roadmap";
import { Analysis } from "./pages/Analysis/Analysis";
import { Progress } from "./pages/Progress/Progress";
import { MyInfo } from "./pages/MyInfo/MyInfo";
import "./App.css";

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <OccupationsProvider>
          <Routes>
            <Route path="/" element={<Onboarding />} />
            <Route path="/onboarding" element={<OnboardingChat />} />
            <Route path="/survey/*" element={<Navigate to="/onboarding" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/home/first" element={<HomeFirst />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/roadmap" element={<Roadmap />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/myinfo" element={<MyInfo />} />
          </Routes>
        </OccupationsProvider>
      </SessionProvider>
    </BrowserRouter>
  );
}
