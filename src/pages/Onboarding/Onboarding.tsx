import "./Onboarding.css";

function PeopleIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16 11C17.66 11 18.99 9.66 18.99 8C18.99 6.34 17.66 5 16 5C14.34 5 13 6.34 13 8C13 9.66 14.34 11 16 11ZM8 11C9.66 11 10.99 9.66 10.99 8C10.99 6.34 9.66 5 8 5C6.34 5 5 6.34 5 8C5 9.66 6.34 11 8 11ZM8 13C5.67 13 1 14.17 1 16.5V19H15V16.5C15 14.17 10.33 13 8 13ZM16 13C15.71 13 15.38 13.02 15.03 13.05C16.19 13.89 17 15.02 17 16.5V19H23V16.5C23 14.17 18.33 13 16 13Z"
        fill="white"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z"
        fill="white"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M17.65 6.35C16.2 4.9 14.21 4 12 4C7.58 4 4.01 7.58 4.01 12C4.01 16.42 7.58 20 12 20C15.73 20 18.84 17.45 19.73 14H17.65C16.83 16.33 14.61 18 12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C13.66 6 15.14 6.69 16.22 7.78L13 11H20V4L17.65 6.35Z"
        fill="white"
      />
    </svg>
  );
}

export function Onboarding() {
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
        <button className="cta-btn">1분 만에 내 경로 찾기</button>
        <p className="caption">빠른 설문조사로 간편하게!</p>
      </div>

      <div className="cards">
        <div className="card">
          <PeopleIcon />
          <p className="card-title">사람마다 다른 경로</p>
          <p className="card-desc">
            희망직업·상황·역량이 다르면 경로도 달라져요
          </p>
        </div>
        <div className="card">
          <CheckIcon />
          <p className="card-title">모든 단계에 근거</p>
          <p className="card-desc">공고가 요구하는 확실한 데이터를 알려줘요</p>
        </div>
        <div className="card">
          <RefreshIcon />
          <p className="card-title">한 번 받고 끝이 아니에요</p>
          <p className="card-desc">역량이 쌓이면 경로가 다시 계산돼요</p>
        </div>
      </div>
    </div>
  );
}
