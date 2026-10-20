import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import "./AppSidebar.css";
import logoIcon from "../assets/logo-mark.svg";
import homeIcon from "../assets/Home .svg";
import chatIcon from "../assets/Message circle.svg";
import roadmapIcon from "../assets/Trending up.svg";
import analysisIcon from "../assets/Bar chart.svg";
import postingsIcon from "../assets/Briefcase.svg";
import progressIcon from "../assets/today.svg";
import userIcon from "../assets/User.svg";
import { useSession } from "../context/SessionContext";
import { usePanelResize } from "../hooks/usePanelResize";
import { ThemeToggle } from "./ThemeToggle";

const NAV_ITEMS = [
  { icon: homeIcon, label: "홈", path: "/home" },
  { icon: chatIcon, label: "AI 커리어 챗봇", path: "/chat" },
  { icon: roadmapIcon, label: "내 로드맵", path: "/roadmap" },
  { icon: analysisIcon, label: "역량 분석", path: "/analysis" },
  { icon: postingsIcon, label: "채용공고", path: "/postings" },
  { icon: progressIcon, label: "진행 상황", path: "/progress" },
  { icon: userIcon, label: "내 정보", path: "/myinfo" },
];

const NARROW_QUERY = "(max-width: 1024px)";
const COLLAPSED_KEY = "jobtology.sidebar.collapsed";
// Pages mount their own sidebar; carry the highlight's last position across them.
let lastActiveIndex: number | undefined;

function preferredCollapsed(narrow: boolean): boolean {
  return narrow || localStorage.getItem(COLLAPSED_KEY) === "1";
}

export function AppSidebar({ children, showLogout = true }: { children?: ReactNode; showLogout?: boolean }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();
  const activeIndex = NAV_ITEMS.findIndex(({ path }) => pathname === path || pathname.startsWith(`${path}/`));
  const [initialActiveIndex] = useState(() => lastActiveIndex ?? activeIndex);
  useEffect(() => { lastActiveIndex = activeIndex; }, [activeIndex]);
  const { logout } = useSession();
  const [collapsed, setCollapsed] = useState(() => preferredCollapsed(window.matchMedia(NARROW_QUERY).matches));
  const { size, resizing, separatorProps } = usePanelResize({ storageKey: "jobtology.sidebar.width", initial: 260, min: 240, max: 360 });

  useEffect(() => {
    const media = window.matchMedia(NARROW_QUERY);
    const onChange = (event: MediaQueryListEvent) => setCollapsed(preferredCollapsed(event.matches));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    if (!window.matchMedia(NARROW_QUERY).matches) localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
  }

  return (
    <aside className={`sidebar${collapsed ? " sidebar--collapsed" : ""}${resizing ? " sidebar--resizing" : ""}`} style={{ "--sidebar-width": `${size}px` } as CSSProperties}>
      <div className="sidebar-logo">
        <img src={logoIcon} alt="로고" className="sidebar-logo-icon" />
        <span className="sidebar-logo-text">Jobtology</span>
        <button
          type="button"
          className="sidebar-toggle"
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          aria-expanded={!collapsed}
          onClick={toggle}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <nav className="sidebar-nav">
        {activeIndex >= 0 && <motion.div className="nav-active-indicator" aria-hidden="true"
          initial={{ y: Math.max(0, initialActiveIndex) * 46 }} animate={{ y: activeIndex * 46 }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }} />}
        {NAV_ITEMS.map(({ icon, label, path }) => (
          <button
            key={label}
            className={`nav-item ${pathname === path || pathname.startsWith(`${path}/`) ? "nav-item--active" : ""}`}
            title={collapsed ? label : undefined}
            aria-label={label}
            aria-current={pathname === path || pathname.startsWith(`${path}/`) ? "page" : undefined}
            onClick={() => navigate(path)}
          >
            <img src={icon} alt="" className="nav-icon" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        {children}
        <ThemeToggle compact={collapsed} />
        {showLogout && (
          <button
            className="sidebar-logout-btn"
            title={collapsed ? "로그아웃" : undefined}
            aria-label="로그아웃"
            onClick={async () => { await logout(); navigate("/"); }}
          >
            <svg className="sidebar-logout-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="sidebar-logout-label">로그아웃</span>
          </button>
        )}
      </div>
      {!collapsed && <div className="sidebar-resize" {...separatorProps} aria-label="사이드바 너비 조절" title="끌어서 너비 조절 · 두 번 클릭하여 초기화" />}
    </aside>
  );
}
