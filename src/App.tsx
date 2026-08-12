import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Onboarding } from "./pages/Onboarding/Onboarding";
import "./App.css";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Onboarding />} />
      </Routes>
    </BrowserRouter>
  );
}
