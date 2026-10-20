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
              <span className="hero-badge">WELCOME TO CAREER NAVIGATOR</span>
              <h1 className="hero-name">반가워요! 첫 커리어 여정을 시작해볼까요?</h1>
              <p className="hero-sub">나에게 딱 맞는 AI 기반 커리어 로드맵과 필요한 역량을 지금 진단해 보세요.</p>
              <Link className="hero-btn hero-btn--filled" to="/myinfo#goals">목표 설정하기 →</Link>
            </div>
          </section>

          {/* Empty roadmap card */}
          <div className="empty-roadmap-card">
            <p className="empty-roadmap-title">나만의 맞춤 로드맵이 아직 없어요</p>
            <p className="empty-roadmap-sub">
              목표 직무와 역량을 등록하면 부족한 스킬을 채워줄 1:1 맞춤형 로드맵이 생성됩니다.<br />
              아래 바로가기로 시작해보세요!
            </p>
          </div>

          {/* Action cards */}
          <div className="card-row">
            <div className="action-card">
              <div className="action-icon">≡</div>
              <p className="info-card-title">AI 커리어 추천받기</p>
              <p className="action-card-sub">
                어떤 직무가 나에게 어울릴지 고민이신가요?<br />
                채용 공고 데이터 기반 AI 추천을 받아보세요.
              </p>
              <button className="action-btn" onClick={() => navigate("/chat")}>상담 시작하기</button>
            </div>

            <div className="action-card">
              <div className="action-icon">≡</div>
              <p className="info-card-title">내 역량 및 프로필 등록</p>
              <p className="action-card-sub">
                보유한 기술 스택이나 프로젝트를 입력하면<br />
                현재 나의 목표 직무 적합도를 바로 계산해 드려요.
              </p>
              <button className="action-btn" onClick={() => navigate("/myinfo")}>내 정보 입력하기</button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
