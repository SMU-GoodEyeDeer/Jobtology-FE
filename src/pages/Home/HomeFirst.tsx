import { Link, useNavigate } from "react-router-dom";
import "./Home.css";
import { AppSidebar } from "../../components/AppSidebar";

export function HomeFirst() {
  const navigate = useNavigate();

  return (
    <div className="home-layout">
      {/* Sidebar */}
      <AppSidebar showLogout={false}>
        <div className="satisfaction-card">
          <p className="satisfaction-title">AI 엔지니어 충족률</p>
          <div className="satisfaction-row">
            <span className="satisfaction-label">필수 역량</span>
            <span className="satisfaction-pct">54%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill progress-fill--blue" style={{ width: "54%" }} />
          </div>
          <div className="satisfaction-row" style={{ marginTop: "10px" }}>
            <span className="satisfaction-label">우대 역량</span>
            <span className="satisfaction-pct">24%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill progress-fill--green" style={{ width: "24%" }} />
          </div>
        </div>
      </AppSidebar>

      {/* Main area */}
      <div className="main-area">
        <header className="main-header">
          <h2 className="main-title">홈</h2>
          <button className="goal-button" onClick={() => navigate("/home")}>
            다음 (홈으로) <span className="goal-arrow">→</span>
          </button>
        </header>

        <main className="main-content">
          {/* Hero card */}
          <section className="hero-card">
            <div className="hero-left">
              <h1 className="hero-name">내 커리어 목표를 정해 보세요</h1>
              <Link className="hero-btn hero-btn--filled" to="/myinfo#goals">목표 설정하기 →</Link>
            </div>
          </section>

          {/* Empty roadmap card */}
          <div className="empty-roadmap-card">
            <p className="empty-roadmap-title">아직 로드맵이 없어요</p>
            <p className="empty-roadmap-sub">
              목표 직무와 스펙을 등록해 학습 경로를 만들어 보세요.
            </p>
          </div>

          {/* Action cards */}
          <div className="card-row">
            <div className="action-card">
              <div className="action-icon">≡</div>
              <p className="info-card-title">AI 커리어 추천받기</p>
              <button className="action-btn" onClick={() => navigate("/chat")}>상담 시작하기</button>
            </div>

            <div className="action-card">
              <div className="action-icon">≡</div>
              <p className="info-card-title">내 역량 및 프로필 등록</p>
              <button className="action-btn" onClick={() => navigate("/myinfo")}>내 정보 입력하기</button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
