import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Chat.css";
import { AppSidebar } from "../../components/AppSidebar";
import { GoalDropdown } from "../../components/GoalDropdown";
import chevronDownIcon from "../../assets/Chevron down.svg";
import { capabilitiesApi, chatApi, roleEvidenceGraphApi } from "../../services/api";
import type { ChatCapabilityCandidate, ChatMessagePayload, RoleEvidenceGraph } from "../../services/types";
import { EvidenceGraph } from "./EvidenceGraph";
import { ReplyText } from "./ReplyText";
import { usePanelResize } from "../../hooks/usePanelResize";
import type { CSSProperties } from "react";
import { ROUTE_SUGGESTION, initialSuggestions, withRouteSuggestion } from "./chatSuggestions";
import { useGoals } from "../../hooks/useGoals";
import { useRoadmap } from "../../hooks/useRoadmap";
import { useSession } from "../../context/SessionContext";

type CandidateStatus = "dismissed";

const MAX_HISTORY = 20;

function toHistory(messages: Message[]): ChatMessagePayload[] {
  return messages
    .flatMap((msg): ChatMessagePayload[] =>
      msg.role === "user" ? [{ role: "user", text: msg.text }]
        : msg.role === "ai" ? [{ role: "assistant", text: msg.text }]
        : []
    )
    .slice(-MAX_HISTORY);
}

type Message =
  | { role: "ai"; text: string; chips?: string[]; candidates?: ChatCapabilityCandidate[]; animate?: boolean }
  | { role: "ai-route" }
  | { role: "user"; text: string };

function makeInitialMessages(goalName: string): Message[] {
  return [
    {
      role: "ai",
      text: `안녕하세요! **${goalName}**를 목표로 하시는군요. 채용공고 데이터를 분석해서 지금 무엇부터 하면 좋을지 알려드릴게요. 아래 질문을 눌러보거나 직접 물어보세요.`,
      chips: [`${goalName} 보기`],
    },
  ];
}

function AiIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v3M9 3h6M4 11H2m20 0h-2" />
      <rect x="4" y="6" width="16" height="14" rx="5" />
      <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
      <path d="M9 16h6" />
    </svg>
  );
}

export function Chat() {
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();
  const { goals, selectedGoalId, setSelectedGoalId, selectedGoal, selectedGoalName, getGoalName } = useGoals();

  useEffect(() => {
    if (!sessionLoading && !session) navigate("/");
  }, [session, sessionLoading, navigate]);
  const { activeRoadmap, progressPct } = useRoadmap(selectedGoalId);

  const [goalOpen, setGoalOpen] = useState(false);
  const [input, setInput] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[] | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [candidateStatus, setCandidateStatus] = useState<Record<string, CandidateStatus>>({});
  const [graph, setGraph] = useState<RoleEvidenceGraph | null>(null);
  const [graphStatus, setGraphStatus] = useState<"idle" | "loading" | "error" | "ready">("idle");

  // Capabilities → mark "have" nodes dynamically
  const [ownedSkills, setOwnedSkills] = useState<Set<string>>(new Set());

  const goalRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const replyRequest = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyWidth, setBodyWidth] = useState(1000);
  const { size: graphWidth, resizing, separatorProps } = usePanelResize({
    storageKey: "jobtology.chat.graphWidth", initial: 420, min: 280, max: Math.max(280, Math.min(900, bodyWidth - 316)), direction: -1,
  });
  useEffect(() => {
    if (!bodyRef.current) return;
    const observer = new ResizeObserver(([entry]) => setBodyWidth(entry.contentRect.width));
    observer.observe(bodyRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    chatApi.status().then((res) => setAiAvailable(res.available)).catch(() => setAiAvailable(false));
  }, []);

  // Load capabilities to mark owned skills in graph
  useEffect(() => {
    capabilitiesApi.list().then((res) => {
      const names = new Set(res.items.filter(item => item.lifecycle === "ACTIVE" && item.matching.status === "MATCHED" && item.matching.credit === 1)
        .flatMap(item => item.matching.competencies.filter(value => value.requirement_keys.length).map(value => value.label.toLowerCase())));
      setOwnedSkills(names);
    }).catch(console.error);
  }, []);

  // Update initial message when goal changes
  useEffect(() => {
    const goalName = selectedGoalName;
    setMessages(makeInitialMessages(goalName));
    setAiSuggestions(null);
    setCandidateStatus({});
    setIsTyping(false);
    replyRequest.current += 1;
    return () => { replyRequest.current += 1; };
  }, [selectedGoal]);

  // Load the role's recommendation-evidence graph from Neo4j
  const occupationId = selectedGoal?.occupation_id ?? null;
  useEffect(() => {
    if (occupationId === null) {
      setGraph(null);
      setGraphStatus("idle");
      return;
    }
    let cancelled = false;
    setGraphStatus("loading");
    roleEvidenceGraphApi.get(occupationId)
      .then((res) => { if (!cancelled) { setGraph(res); setGraphStatus("ready"); } })
      .catch(() => { if (!cancelled) { setGraph(null); setGraphStatus("error"); } });
    return () => { cancelled = true; };
  }, [occupationId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (goalRef.current && !goalRef.current.contains(e.target as Node)) setGoalOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  async function handleSend() {
    if (!input.trim() || isTyping) return;
    const sentText = input.trim();
    const next: Message[] = [...messages, { role: "user", text: sentText }];
    setMessages(next);
    setInput("");
    setSelectedSuggestion(null);
    setIsTyping(true);
    const request = ++replyRequest.current;
    if (aiAvailable && sentText !== ROUTE_SUGGESTION) {
      try {
        const res = await chatApi.send(toHistory(next));
        if (request !== replyRequest.current) return;
        setMessages((prev) => [...prev, { role: "ai", text: res.reply, candidates: res.candidates, animate: true }]);
        if (res.suggestions?.length) setAiSuggestions(withRouteSuggestion(res.suggestions));
      } catch {
        if (request !== replyRequest.current) return;
        setMessages((prev) => [...prev, { role: "ai", text: "지금은 AI 답변을 받을 수 없어요. 잠시 후 다시 시도해주세요." }]);
      } finally {
        if (request === replyRequest.current) setIsTyping(false);
      }
      return;
    }
    setIsTyping(false);
    setMessages((prev) => [...prev, sentText === ROUTE_SUGGESTION ? { role: "ai-route" } : { role: "ai", text: "지금은 AI 상담을 연결할 수 없어요. 잠시 후 다시 시도해주세요." }]);
  }

  const suggestions = aiSuggestions
    ?? initialSuggestions(selectedGoal ? selectedGoalName : null, graph, ownedSkills);

  // Route steps from actual roadmap, or fallback static
  const routeSteps = activeRoadmap?.steps.slice(0, 6).map((step, i) => ({
    icon: step.state === "COMPLETED" ? "check" : String(i + 1),
    label: step.title,
    tag: step.state === "COMPLETED" ? "완료" : step.state === "IN_PROGRESS" ? "진행 중" : null,
    tagColor: step.state === "COMPLETED" ? "#16a34a" : step.state === "IN_PROGRESS" ? "#4f46e5" : null,
  })) ?? [
    { icon: "check", label: "Python", tag: "보유", tagColor: "#16a34a" },
    { icon: "2", label: "실무 교육 과정", tag: "교육", tagColor: "#4f46e5" },
    { icon: "3", label: "PyTorch", tag: null, tagColor: null },
    { icon: "4", label: "개인 프로젝트", tag: "기간 가변", tagColor: null },
    { icon: "5", label: "AI 인턴", tag: "경력", tagColor: null },
    { icon: "star", label: selectedGoalName, tag: "목표", tagColor: "#4f46e5" },
  ];

  return (
    <div className="chat-layout">
      {/* Sidebar */}
      <AppSidebar>
        <div className="satisfaction-card">
          <p className="satisfaction-title">{selectedGoalName} 진행률</p>
          <div className="satisfaction-row">
            <span className="satisfaction-label">로드맵</span>
            <span className="satisfaction-pct">{progressPct}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill progress-fill--blue" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="satisfaction-row" style={{ marginTop: 10 }}>
            <span className="satisfaction-label">보유 역량</span>
            <span className="satisfaction-pct">{ownedSkills.size}개</span>
          </div>
        </div>
      </AppSidebar>

      {/* Main area */}
      <div className="chat-main">
        <header className="chat-header">
          <h2 className="chat-title">AI 커리어 추천</h2>
          <div className="goal-wrapper" ref={goalRef}>
            <button className="goal-button" aria-expanded={goalOpen} aria-controls="goal-dropdown" onClick={() => setGoalOpen((v) => !v)}>
              {selectedGoalName}
              <img src={chevronDownIcon} alt="▾" className="goal-arrow" />
            </button>
            <GoalDropdown open={goalOpen}>
                {goals.map((goal) => (
                  <div
                    key={goal.goal_id}
                    className={`goal-dropdown-item${selectedGoalId === goal.goal_id ? " selected" : ""}`}
                    onClick={() => { setSelectedGoalId(goal.goal_id); setGoalOpen(false); }}
                  >
                    <span>{getGoalName(goal)}</span>
                    <span className="goal-dropdown-count">{goal.status}</span>
                  </div>
                ))}
            </GoalDropdown>
          </div>
        </header>

        <div ref={bodyRef} className={`chat-body${resizing ? " chat-body--resizing" : ""}`} style={{ "--graph-width": `${graphWidth}px` } as CSSProperties}>
          {/* Left: Chat panel */}
          <div className="chat-panel">
            <div className="ai-header-card">
              <div className="ai-header-icon">
                <AiIcon size={24} />
              </div>
              <div>
                <p className="ai-header-name">커리어 추천 AI</p>
              </div>
            </div>

            <div className="chat-messages">
              {messages.map((msg, i) =>
                msg.role === "ai-route" ? (
                  <div key={i} className="msg-ai-wrap">
                    <div className="msg-ai-icon"><AiIcon /></div>
                    <div className="route-card">
                      <span className="route-card-badge">AI 추천 경로</span>
                      <p className="route-card-title">
                        {selectedGoalName}까지 {routeSteps.length}단계
                      </p>
                      <p className="route-card-sub">목표 직무 공고 분석 기반</p>
                      <div className="route-steps">
                        {routeSteps.map((step, si) => (
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
                      <button className="route-card-btn" onClick={() => navigate("/roadmap")}>로드맵에서 보기</button>
                    </div>
                  </div>
                ) : msg.role === "ai" ? (
                  <div key={i} className="msg-ai-wrap">
                    <div className="msg-ai-icon"><AiIcon /></div>
                    <div>
                      <div className="msg-ai-bubble"><ReplyText text={msg.text} animate={msg.animate} /></div>
                      {msg.chips && (
                        <div className="msg-chips">
                          {msg.chips.map((c) => (
                            <button key={c} className="msg-chip">{c}</button>
                          ))}
                        </div>
                      )}
                      {msg.candidates?.map((candidate) => {
                        const key = `${i}-${candidate.entity_id}`;
                        const status = candidateStatus[key];
                        if (status === "dismissed") return null;
                        return (
                          <div key={key} className="cap-candidate">
                            <p className="cap-candidate-title">
                              <strong>{candidate.label}</strong> 역량을 보유 역량에 추가할까요?
                            </p>
                            <p className="cap-candidate-quote">“{candidate.evidence_quote}”</p>
                            <div className="cap-candidate-actions">
                              <button className="cap-candidate-add" onClick={() => navigate("/myinfo", { state: { specCandidate: candidate } })}>검토하고 스펙에 추가</button>
                              <button className="cap-candidate-skip" onClick={() => setCandidateStatus(previous => ({ ...previous, [key]: "dismissed" }))}>아니요</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="msg-user-wrap">
                    <div className="msg-user-bubble">{msg.text}</div>
                  </div>
                )
              )}
              {isTyping && (
                <div className="msg-ai-wrap">
                  <div className="msg-ai-icon"><AiIcon /></div>
                  <div className="msg-ai-bubble msg-typing" role="status" aria-label="AI가 답변을 작성하고 있어요">
                    <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-suggestions" role="region" aria-label="추천 질문" tabIndex={0}>
              {suggestions.map((s) => (
                <button
                  key={s}
                  className={`suggestion-chip${selectedSuggestion === s ? " suggestion-chip--active" : ""}`}
                  onClick={() => { setInput(s); setSelectedSuggestion(s); }}
                >
                  {s}
                </button>
              ))}
            </div>

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
              <button className="chat-send-btn" disabled={!input.trim() || isTyping} onClick={handleSend}>보내기</button>
            </div>
          </div>

          <div className="chat-divider" {...separatorProps} aria-label="채팅과 그래프 너비 조절" title="끌어서 너비 조절 · 두 번 클릭하여 초기화"><span /></div>

          {/* Right: Graph panel */}
          <div className="graph-panel" style={{ position: "relative" }}>
            <EvidenceGraph
              graph={graph}
              status={graphStatus}
              ownedSkills={ownedSkills}
              onOpenRoadmap={() => navigate("/roadmap")}
            />
          </div>
        </div>

        <div className="chat-action-bar">
          <button className="chat-action-btn" onClick={() => navigate("/roadmap")}>이 추천으로 내 로드맵 만들기</button>
          <p className="chat-action-desc">
            그래프에서 찾은 경로를 순서대로 정리해드려요 · AI 상담 기반으로 표시돼요
          </p>
        </div>
      </div>
    </div>
  );
}
