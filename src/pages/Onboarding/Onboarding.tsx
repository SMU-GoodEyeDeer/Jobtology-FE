import { useNavigate } from "react-router-dom";
import "./Onboarding.css";
import UsersIcon from "../../assets/Users.svg";
import CheckCircleIcon from "../../assets/Check circle.svg";
import RefreshCcwIcon from "../../assets/Refresh ccw.svg";

export function Onboarding() {
  const navigate = useNavigate();
  return (
    <div className="onboarding">
      <div className="hero">
        <span className="badge">● 채용공고 5,000건 · AI그래프 기반</span>
        <h1>
          진로 설계, 뭐부터
          <br />
          해야 할지 <span className="highlight">막막하다면</span>
        </h1>
        <p className="subtitle">
          채용공고 데이터를 근거로, 내 상황에 맞는 목표 직무까지의 경로를
          제시하는 AI 커리어 내비게이션이에요!
        </p>
        <button className="cta-btn" onClick={() => navigate("/survey/1")}>1분 만에 내 경로 찾기</button>
        <p className="caption">빠른 설문조사로 간편하게!</p>
      </div>

      <div className="cards">
        <div className="card">
          <img src={UsersIcon} alt="" width={22} height={22} />
          <p className="card-title">사람마다 다른 경로</p>
          <p className="card-desc">
            희망직업·상황·역량이 다르면 경로도 달라져요
          </p>
        </div>
        <div className="card">
          <img src={CheckCircleIcon} alt="" width={22} height={22} />
          <p className="card-title">모든 단계에 근거</p>
          <p className="card-desc">공고가 요구하는 확실한 데이터를 알려줘요</p>
        </div>
        <div className="card">
          <img src={RefreshCcwIcon} alt="" width={22} height={22} />
          <p className="card-title">한 번 받고 끝이 아니에요</p>
          <p className="card-desc">역량이 쌓이면 경로가 다시 계산돼요</p>
        </div>
      </div>
    </div>
  );
}
