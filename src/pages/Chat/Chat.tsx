import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Chat.css";
import logoIcon from "../../assets/logo1.svg";
import homeIcon from "../../assets/Home .svg";
import chatIcon from "../../assets/Message circle.svg";
import roadmapIcon from "../../assets/Trending up.svg";
import analysisIcon from "../../assets/Bar chart.svg";
import progressIcon from "../../assets/today.svg";
import userIcon from "../../assets/User.svg";
import chevronDownIcon from "../../assets/Chevron down.svg";

const NAV_ITEMS = [
  { icon: homeIcon, label: "홈", path: "/home" },
  { icon: chatIcon, label: "AI 커리어 챗봇", path: "/chat" },
  { icon: roadmapIcon, label: "내 로드맵", path: "/roadmap" },
  { icon: analysisIcon, label: "역량 분석", path: "" },
  { icon: progressIcon, label: "진행 상황", path: "" },
  { icon: userIcon, label: "내 정보", path: "" },
];

const GOAL_GROUPS = [
  {
    label: "AI·데이터",
    items: [
      { name: "AI 엔지니어", count: "500" },
      { name: "데이터 분석", count: "680" },
      { name: "데이터 엔지니어", count: "430" },
      { name: "ML 엔지니어", count: "310" },
    ],
  },
  {
    label: "개발",
    items: [
      { name: "백엔드 개발", count: "1,240" },
      { name: "프론트엔드", count: "720" },
      { name: "풀스택 개발", count: "540" },
      { name: "안드로이드", count: "290" },
    ],
  },
  {
    label: "인프라·보안",
    items: [
      { name: "DevOps", count: "388" },
      { name: "클라우드 엔지니어", count: "260" },
      { name: "정보보안", count: "248" },
    ],
  },
];

const SUGGESTIONS = [
  "나는 뭐부터 준비해야 해?",
  "AI 엔지니어가 되려면 뭐가 부족해?",
  "부트캠프 꼭 들어야 해?",
  "비전공인데 가능할까?",
  "내 경로 추천해줘",
];

const GRAPH_NODES = [
  { id: "me", label: "나", sub: "현재 위치", cx: 210, cy: 460, r: 44, type: "me" },
  { id: "goal", label: "AI 엔지니어", sub: "목표", cx: 270, cy: 290, r: 56, type: "goal" },
  { id: "edu", label: "실무 교육", sub: "840시간", cx: 120, cy: 370, r: 42, type: "edu" },
  { id: "pytorch", label: "PyTorch", sub: "중요", cx: 80, cy: 250, r: 38, type: "need" },
  { id: "docker", label: "Docker", sub: "필요", cx: 155, cy: 110, r: 36, type: "need" },
  { id: "aws", label: "AWS", sub: "우대", cx: 370, cy: 120, r: 36, type: "need" },
  { id: "project", label: "프로젝트", sub: "포트폴리오", cx: 420, cy: 245, r: 38, type: "edu" },
  { id: "sql", label: "SQL", sub: "보유", cx: 390, cy: 375, r: 36, type: "have" },
  { id: "python", label: "Python", sub: "보유", cx: 355, cy: 470, r: 40, type: "have" },
  { id: "git", label: "Git", sub: "보유", cx: 95, cy: 490, r: 36, type: "have" },
];

const EDGES = [
  ["me", "goal"],
  ["goal", "edu"],
  ["goal", "pytorch"],
  ["goal", "docker"],
  ["goal", "aws"],
  ["goal", "project"],
  ["goal", "sql"],
  ["goal", "python"],
  ["goal", "git"],
  ["me", "python"],
  ["me", "git"],
];

const NODE_COLORS: Record<string, { bg: string; text: string }> = {
  me:   { bg: "#111827", text: "#ffffff" },
  goal: { bg: "#1e1b4b", text: "#ffffff" },
  edu:  { bg: "#4f46e5", text: "#ffffff" },
  need: { bg: "#9ca3af", text: "#ffffff" },
  have: { bg: "#16a34a", text: "#ffffff" },
};

const LEGEND = [
  { type: "me",   label: "나" },
  { type: "goal", label: "목표 직무" },
  { type: "have", label: "보유 역량" },
  { type: "need", label: "필요 역량" },
  { type: "edu",  label: "교육·활동" },
];

type Message =
  | { role: "ai"; text: string; chips?: string[] }
  | { role: "ai-route" }
  | { role: "user"; text: string };

const ROUTE_STEPS = [
  { icon: "check", label: "Python", tag: "보유", tagColor: "#16a34a" },
  { icon: "2", label: "실무 교육 과정", tag: "교육", tagColor: "#4f46e5" },
  { icon: "3", label: "PyTorch", tag: null, tagColor: null },
  { icon: "4", label: "개인 프로젝트", tag: "기간 가변", tagColor: null },
  { icon: "5", label: "AI 인턴", tag: "경력", tagColor: null },
  { icon: "star", label: "AI 엔지니어", tag: "목표", tagColor: "#4f46e5" },
];

const INITIAL_MESSAGES: Message[] = [
  {
    role: "ai",
    text: "안녕하세요! **AI 엔지니어**를 목표로 하시는군요. 채용공고 5,000건을 분석해서 지금 무엇부터 하면 좋을지 알려드릴게요. 아래 질문을 눌러보거나 직접 물어보세요.",
    chips: ["AI 엔지니어 보기"],
  },
  { role: "user", text: "나는 뭐 부터 준비해야해?" },
  {
    role: "ai",
    text: "프로필을 보면 Python은 이미 갖추셨어요. 지금 급한건 PyTorch예요. AI 엔지니어 공고 500건 중 412건(82%)이 요구하는데 아직 없거든요. 실무 교육 과정을 들으면 Docker까지 함께 채울 수 있어요.",
    chips: ["PyTorch 보기", "실무교육 보기"],
  },
  { role: "user", text: "그럼 그건 어떤식으로 하는게 좋아?" },
];

function renderText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p
  );
}

function AiIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="2" rx="1" fill="white"/>
      <rect x="3" y="11" width="18" height="2" rx="1" fill="white"/>
      <rect x="3" y="17" width="12" height="2" rx="1" fill="white"/>
    </svg>
  );
}

export function Chat() {
  const navigate = useNavigate();
  const [goalOpen, setGoalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState("AI 엔지니어");
  const [input, setInput] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [pytorchPopup, setPytorchPopup] = useState(false);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [isTyping, setIsTyping] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const goalRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panningRef = useRef(false);
  const panStartRef = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });
  const hasPannedRef = useRef(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (goalRef.current && !goalRef.current.contains(e.target as Node)) {
        setGoalOpen(false);
      }
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPytorchPopup(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!panningRef.current) return;
      const dx = e.clientX - panStartRef.current.mouseX;
      const dy = e.clientY - panStartRef.current.mouseY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasPannedRef.current = true;
      setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
    }
    function handleMouseUp() {
      panningRef.current = false;
      if (svgRef.current) svgRef.current.style.cursor = "grab";
    }
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  function handleSVGMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    e.preventDefault();
    panningRef.current = true;
    hasPannedRef.current = false;
    panStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, panX: pan.x, panY: pan.y };
    if (svgRef.current) svgRef.current.style.cursor = "grabbing";
  }

  function resetPan() {
    setPan({ x: 0, y: 0 });
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  function handleSend() {
    if (!input.trim()) return;
    const sentText = input.trim();
    setMessages((prev) => [...prev, { role: "user", text: sentText }]);
    setInput("");
    setSelectedSuggestion(null);
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      if (sentText === "내 경로 추천해줘") {
        setMessages((prev) => [...prev, { role: "ai-route" }]);
      } else {
        setMessages((prev) => [...prev, { role: "ai", text: "네! 더 궁금한 게 있으면 언제든지 물어보세요." }]);
      }
    }, 1400);
  }

  return (
    <div className="chat-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src={logoIcon} alt="로고" className="sidebar-logo-icon" />
          <span className="sidebar-logo-text">커리어 내비게이션</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ icon, label, path }) => (
            <button
              key={label}
              className={`nav-item ${label === "AI 커리어 챗봇" ? "nav-item--active" : ""}`}
              onClick={() => path && navigate(path)}
            >
              <img src={icon} alt={label} className="nav-icon" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
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
        </div>
      </aside>

      {/* Main area */}
      <div className="chat-main">
        <header className="chat-header">
          <h2 className="chat-title">AI 커리어 추천</h2>
          <div className="goal-wrapper" ref={goalRef}>
            <button className="goal-button" onClick={() => setGoalOpen((v) => !v)}>
              목표 {selectedGoal}
              <img src={chevronDownIcon} alt="▾" className="goal-arrow" />
            </button>
            {goalOpen && (
              <div className="goal-dropdown">
                {GOAL_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="goal-dropdown-group-label">{group.label}</p>
                    {group.items.map((item) => (
                      <div
                        key={item.name}
                        className={`goal-dropdown-item${selectedGoal === item.name ? " selected" : ""}`}
                        onClick={() => { setSelectedGoal(item.name); setGoalOpen(false); }}
                      >
                        <span>{item.name}</span>
                        <span className="goal-dropdown-count">공고 {item.count}건</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </header>

        <div className="chat-body">
          {/* Left: Chat panel */}
          <div className="chat-panel">
            {/* AI header */}
            <div className="ai-header-card">
              <div className="ai-header-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="18" height="2" rx="1" fill="white"/>
                  <rect x="3" y="11" width="18" height="2" rx="1" fill="white"/>
                  <rect x="3" y="17" width="12" height="2" rx="1" fill="white"/>
                </svg>
              </div>
              <div>
                <p className="ai-header-name">커리어 추천 AI</p>
                <p className="ai-header-status">
                  <span className="ai-status-dot" />
                  채용공고 5,000건 · 지식그래프 연결됨
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="chat-messages">
              {messages.map((msg, i) =>
                msg.role === "ai-route" ? (
                  <div key={i} className="msg-ai-wrap">
                    <div className="msg-ai-icon"><AiIcon /></div>
                    <div className="route-card">
                      <span className="route-card-badge">AI 추천 경로</span>
                      <p className="route-card-title">AI 엔지니어까지 6단계</p>
                      <p className="route-card-sub">AI 엔지니어 공고 500건 분석 기반</p>
                      <div className="route-steps">
                        {ROUTE_STEPS.map((step, si) => (
                          <div key={si} className="route-step">
                            <div className={`route-step-icon${step.icon === "check" ? " route-step-icon--check" : step.icon === "star" ? " route-step-icon--star" : step.icon === "2" ? " route-step-icon--active" : ""}`}>
                              {step.icon === "check" ? "✓" : step.icon === "star" ? "★" : step.icon}
                            </div>
                            <span className="route-step-label">{step.label}</span>
                            {step.tag && (
                              <span className="route-step-tag" style={step.tagColor ? { color: step.tagColor, fontWeight: 700 } : undefined}>
                                {step.tag}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <button className="route-card-btn" onClick={() => navigate("/roadmap")}>이 경로로 내 로드맵 만들기</button>
                    </div>
                  </div>
                ) : msg.role === "ai" ? (
                  <div key={i} className="msg-ai-wrap">
                    <div className="msg-ai-icon"><AiIcon /></div>
                    <div>
                      <div className="msg-ai-bubble">{renderText(msg.text)}</div>
                      {msg.chips && (
                        <div className="msg-chips">
                          {msg.chips.map((c) => (
                            <button key={c} className="msg-chip">{c}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="msg-user-wrap">
                    <div className="msg-user-bubble">{msg.text}</div>
                    <div className="msg-user-avatar">나</div>
                  </div>
                )
              )}
              {isTyping && (
                <div className="msg-ai-wrap">
                  <div className="msg-ai-icon"><AiIcon /></div>
                  <div className="msg-ai-bubble msg-typing">
                    <span /><span /><span />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestion chips */}
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className={`suggestion-chip${selectedSuggestion === s ? " suggestion-chip--active" : ""}`}
                  onClick={() => { setInput(s); setSelectedSuggestion(s); }}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Input bar */}
            <div className="chat-input-bar">
              <input
                className="chat-input"
                placeholder="궁금한 걸 물어보세요"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button className="chat-send-btn" onClick={handleSend}>보내기</button>
            </div>
          </div>

          {/* Right: Graph panel */}
          <div className="graph-panel" style={{ position: "relative" }}>
            <div className="graph-panel-header">
              <div>
                <p className="graph-title">추천 근거 그래프</p>
                <p className="graph-sub">노드를 끌어 옮기고, 눌러서 상세를 보세요</p>
              </div>
              <button className="graph-center-btn" onClick={resetPan}>중앙 정렬</button>
            </div>

            <div className="graph-canvas">
              <svg
                ref={svgRef}
                viewBox="0 0 510 570"
                width="100%"
                height="100%"
                onMouseDown={handleSVGMouseDown}
                style={{ cursor: "grab" }}
              >
                <g transform={`translate(${pan.x}, ${pan.y})`}>
                  {/* Edges */}
                  {EDGES.map(([a, b], i) => {
                    const na = GRAPH_NODES.find((n) => n.id === a)!;
                    const nb = GRAPH_NODES.find((n) => n.id === b)!;
                    return (
                      <line
                        key={i}
                        x1={na.cx} y1={na.cy}
                        x2={nb.cx} y2={nb.cy}
                        stroke="#d1d5db"
                        strokeWidth="1.5"
                      />
                    );
                  })}
                  {/* Nodes */}
                  {GRAPH_NODES.map((node) => {
                    const color = NODE_COLORS[node.type];
                    return (
                      <g
                        key={node.id}
                        className={`graph-node${node.id === "goal" ? " graph-node--no-scale" : ""}`}
                        onClick={node.id === "pytorch" ? () => { if (!hasPannedRef.current) setPytorchPopup(true); } : undefined}
                        style={node.id === "pytorch" ? { cursor: "pointer" } : undefined}
                      >
                        <circle cx={node.cx} cy={node.cy} r={node.r} fill={color.bg} />
                        <text
                          x={node.cx}
                          y={node.cy - (node.sub ? 6 : 0)}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={color.text}
                          fontSize={node.r > 50 ? 13 : 11}
                          fontWeight="600"
                          fontFamily="inherit"
                        >
                          {node.label}
                        </text>
                        {node.sub && (
                          <text
                            x={node.cx}
                            y={node.cy + 12}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill={color.text}
                            fontSize={9}
                            fontFamily="inherit"
                            opacity={0.8}
                          >
                            {node.sub}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>

            {/* PyTorch popup */}
            {pytorchPopup && (
              <div className="node-popup" ref={popupRef}>
                <button className="node-popup-close" onClick={() => setPytorchPopup(false)}>✕</button>
                <span className="node-popup-badge">필요 역량</span>
                <p className="node-popup-title">PyTorch</p>
                <p className="node-popup-desc">
                  공고 82%가 요구하지만 아직 없어요.<br />
                  실무 교육이나 프로젝트로 채울 수 있어요.
                </p>
                <div className="node-popup-stats">
                  <div className="node-popup-stat">
                    <span className="node-popup-stat-label">요구 비율</span>
                    <span className="node-popup-stat-value">82%</span>
                  </div>
                  <div className="node-popup-stat">
                    <span className="node-popup-stat-label">지지 공고</span>
                    <span className="node-popup-stat-value">412건</span>
                  </div>
                  <div className="node-popup-stat">
                    <span className="node-popup-stat-label">대체 가능</span>
                    <span className="node-popup-stat-value">TensorFlow</span>
                  </div>
                </div>
                <button className="node-popup-btn">로드맵에서 보기</button>
              </div>
            )}

            {/* Legend */}
            <div className="graph-legend">
              {LEGEND.map(({ type, label }) => (
                <span key={type} className="legend-item">
                  <span className="legend-dot" style={{ background: NODE_COLORS[type].bg }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom action bar */}
        <div className="chat-action-bar">
          <button className="chat-action-btn">이 추천으로 내 로드맵 만들기</button>
          <p className="chat-action-desc">
            그래프에서 찾은 경로를 순서대로 정리해드려요 · AI 상담 기반으로 표시돼요
          </p>
        </div>
      </div>
    </div>
  );
}
