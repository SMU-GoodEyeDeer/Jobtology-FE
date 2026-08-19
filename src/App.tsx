import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Onboarding } from "./pages/Onboarding/Onboarding";
import { Survey1 } from "./pages/Survey/Survey1";
import { Survey2 } from "./pages/Survey/Survey2";
import { Survey3 } from "./pages/Survey/Survey3";
import { Home } from "./pages/Home/Home";
import { HomeFirst } from "./pages/Home/HomeFirst";
import { Chat } from "./pages/Chat/Chat";
import { Roadmap } from "./pages/Roadmap/Roadmap";
import "./App.css";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Onboarding />} />
        <Route path="/survey/1" element={<Survey1 />} />
        <Route path="/survey/2" element={<Survey2 />} />
        <Route path="/survey/3" element={<Survey3 />} />
        <Route path="/home" element={<Home />} />
        <Route path="/home/first" element={<HomeFirst />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/roadmap" element={<Roadmap />} />
      </Routes>
    </BrowserRouter>
  );
}
