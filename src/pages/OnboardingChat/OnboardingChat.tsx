import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutGroup, MotionConfig, motion, useReducedMotion } from "motion/react";
import "./OnboardingChat.css";
import logoIcon from "../../assets/logo.svg";
import { useSession } from "../../context/SessionContext";
import { useOccupations } from "../../context/OccupationsContext";
import { capabilitiesApi, chatApi } from "../../services/api";
import { saveChatCapability, saveChecklist, saveProfile, startGoal } from "../../services/onboardingSave";
import type { CapabilityChecklistGroup, ChatCapabilityCandidate, ChatMessagePayload } from "../../services/types";
import { progressIndex, progressSteps } from "./progress";
import { Chip, EASE_OUT, ProgressTrail, SPRING } from "./parts";

export type Step = "occupation" | "major" | "grade" | "checklist" | "chat";

type Message =
  | { role: "ai"; text: string; candidates?: ChatCapabilityCandidate[] }
  | { role: "user"; text: string };

type CandidateStatus = "saving" | "saved" | "dismissed" | "error";

const DISCOVERY = "아직 모르겠어요";
const SKIP = "건너뛰기";
const GRADES = [1, 2, 3, 4];
const MAX_HISTORY = 20;
// Scripted questions get a short typing beat before they appear. Network waits
// already show the busy indicator; LLM replies reveal as soon as they arrive.
const SCRIPTED_TYPING_MS = 500;

export const QUESTIONS: Record<Step, string> = {
  occupation:
    "안녕하세요! 몇 가지를 대화로 여쭤볼게요. 언제든 위의 '그만하고 시작하기'를 누르면 지금까지 답한 것만 저장하고 넘어가요.\n먼저, 어떤 IT 직무를 목표로 하세요?",
  major: "전공(학과)이 무엇인가요? 직접 입력해 주세요.",
  grade: "몇 학년이세요?",
  checklist: "이미 해본 것을 모두 골라주세요. 없으면 '해본 게 없어요'를 눌러주세요.",
  chat: "좋아요! 체크한 것 말고도 해본 프로젝트나 경험이 있으면 편하게 말해 주세요.\n예: \"Spring으로 게시판 API를 만들어 봤어요\"",
};

// Only the free-form experience conversation is sent to the AI, not the scripted questions.
export function chatIntroIndex(messages: Message[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "ai" && m.text === QUESTIONS.chat) return i;
  }
  return 0;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function OnboardingChat() {
  const navigate = useNavigate();
  const { session, loading: sessionLoading, refresh } = useSession();
  const { occupations } = useOccupations();
  const reduceMotion = useReducedMotion() ?? false;
  const scriptedTypingMs = reduceMotion ? 0 : SCRIPTED_TYPING_MS;

  const [step, setStep] = useState<Step>("occupation");
  const [messages, setMessages] = useState<Message[]>([{ role: "ai", text: QUESTIONS.occupation }]);
  const [occupation, setOccupation] = useState<{ id: string; name: string } | null>(null);
  const [goalStarted, setGoalStarted] = useState(false);
  const [major, setMajor] = useState<string | null>(null);
  const [groups, setGroups] = useState<CapabilityChecklistGroup[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [candidateStatus, setCandidateStatus] = useState<Record<string, CandidateStatus>>({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // ChatGPT/Claude-style center start: until the first answer lands, the first
  // question sits large in the vertical middle of the screen.
  const centerStart = !messages.some((m) => m.role === "user");
  const hasTarget = !goalStarted || occupation !== null;
  const trailSteps = progressSteps(hasTarget);
  const trailCurrent = progressIndex(step);

  useEffect(() => {
    if (!sessionLoading && !session) navigate("/");
  }, [session, sessionLoading, navigate]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages, step, busy, groups, reduceMotion]);

  const say = (message: Message) => setMessages((prev) => [...prev, message]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      console.error("Onboarding save failed:", err);
      setError("저장 중 문제가 생겼어요. 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function goToChecklistOrFinish(occ: { id: string; name: string } | null) {
    if (!occ) {
      await finish();
      return;
    }
    try {
      const res = await capabilitiesApi.checklist(occ.id);
      if (res.groups.length > 0) {
        setGroups(res.groups);
        setStep("checklist");
        await wait(scriptedTypingMs);
        say({ role: "ai", text: `${occ.name} 기준으로 ${QUESTIONS.checklist}` });
        return;
      }
    } catch (err) {
      console.warn("Checklist unavailable:", err);
    }
    await goToChatOrFinish();
  }

  async function goToChatOrFinish() {
    const available = await chatApi.status().then((r) => r.available).catch(() => false);
    if (!available) {
      await finish();
      return;
    }
    await wait(scriptedTypingMs);
    say({ role: "ai", text: QUESTIONS.chat });
    setStep("chat");
  }

  async function finish(savePendingMajor = false) {
    if (!goalStarted) await startGoal(occupation?.id ?? null);
    if (savePendingMajor && step === "grade" && major) await saveProfile(major, null);
    await refresh();
    navigate("/home/first");
  }

  function chooseOccupation(id: string | null, name: string) {
    say({ role: "user", text: name });
    void run(async () => {
      await startGoal(id);
      setGoalStarted(true);
      setOccupation(id ? { id, name } : null);
      setStep("major");
      await wait(scriptedTypingMs);
      say({ role: "ai", text: QUESTIONS.major });
    });
  }

  function answerMajor(value: string | null) {
    say({ role: "user", text: value ?? SKIP });
    setMajor(value);
    setStep("grade");
    void run(async () => {
      await wait(scriptedTypingMs);
      say({ role: "ai", text: QUESTIONS.grade });
    });
  }

  function answerGrade(year: number | null) {
    say({ role: "user", text: year ? `${year}학년` : SKIP });
    void run(async () => {
      await saveProfile(major, year);
      await goToChecklistOrFinish(occupation);
    });
  }

  function submitChecklist(itemIds: string[]) {
    if (!occupation) return;
    const labels = groups.flatMap((g) => g.items).filter((i) => itemIds.includes(i.item_id)).map((i) => i.label);
    say({ role: "user", text: labels.length ? labels.join("\n") : "해본 게 없어요" });
    void run(async () => {
      await saveChecklist(occupation.id, itemIds);
      await goToChatOrFinish();
    });
  }

  function sendChat(text: string) {
    const next: Message[] = [...messages, { role: "user", text }];
    setMessages(next);
    const history: ChatMessagePayload[] = next
      .slice(chatIntroIndex(next))
      .map((m): ChatMessagePayload => ({ role: m.role === "user" ? "user" : "assistant", text: m.text }))
      .slice(-MAX_HISTORY);
    void run(async () => {
      try {
        const res = await chatApi.send(history, "onboarding");
        say({ role: "ai", text: res.reply, candidates: res.candidates });
      } catch {
        say({ role: "ai", text: "지금은 AI 답변을 받을 수 없어요. '그만하고 시작하기'로 넘어가도 돼요." });
      }
    });
  }

  async function addCandidate(key: string, candidate: ChatCapabilityCandidate) {
    setCandidateStatus((prev) => ({ ...prev, [key]: "saving" }));
    try {
      await saveChatCapability(candidate);
      setCandidateStatus((prev) => ({ ...prev, [key]: "saved" }));
    } catch {
      setCandidateStatus((prev) => ({ ...prev, [key]: "error" }));
    }
  }

  function submitInput() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    if (step === "major") answerMajor(text);
    else if (step === "chat") sendChat(text);
  }

  const inputEnabled = (step === "major" || step === "chat") && !busy;
  const occupationChoices: { id: string | null; name: string }[] = [
    ...occupations.map((o) => ({ id: o.occupation_id, name: o.name })),
    { id: null, name: DISCOVERY },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup>
        <div className={`ob-page${centerStart ? " ob-page--center" : ""}`}>
          <div className="ob-bg" aria-hidden="true">
            <div className="ob-blob ob-blob--a" />
            <div className="ob-blob ob-blob--b" />
          </div>

          <header className="ob-header">
            <div className="ob-header-inner">
              <div className="ob-brand">
                <img src={logoIcon} alt="로고" />
                <h1>잡톨로지</h1>
              </div>
              <ProgressTrail steps={trailSteps} current={trailCurrent} />
              <button className="ob-stop" disabled={busy} onClick={() => void run(() => finish(true))}>
                그만하고 시작하기
              </button>
            </div>
          </header>

          <main className={`ob-chat${centerStart ? " ob-chat--center" : ""}`}>
            {messages.map((msg, i) =>
              msg.role === "user" ? (
                <motion.div
                  key={i}
                  className="ob-user"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.24, ease: EASE_OUT }}
                >
                  {msg.text}
                </motion.div>
              ) : (
                <motion.div
                  key={i}
                  className="ob-ai-wrap"
                  layout={i === 0 ? true : undefined}
                  transition={i === 0 ? SPRING : { duration: reduceMotion ? 0 : 0.24, ease: EASE_OUT }}
                  initial={i === 0 ? false : { opacity: 0, y: 12 }}
                  animate={i === 0 ? undefined : { opacity: 1, y: 0 }}
                >
                  <div className={`ob-ai${i === 0 && centerStart ? " ob-ai--hero" : ""}`}>{msg.text}</div>
                  {msg.candidates?.map((candidate, cIdx) => {
                    const key = `${i}-${candidate.entity_id}`;
                    const status = candidateStatus[key];
                    if (status === "dismissed") return null;
                    return (
                      <motion.div
                        key={key}
                        className="ob-candidate"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: reduceMotion ? 0 : 0.25,
                          delay: reduceMotion ? 0 : 0.08 + cIdx * 0.06,
                          ease: EASE_OUT,
                        }}
                      >
                        <p><strong>{candidate.label}</strong> 역량을 보유 역량에 추가할까요?</p>
                        <p className="ob-quote">“{candidate.evidence_quote}”</p>
                        {status === "saved" ? (
                          <p className="ob-saved">추가했어요 · 본인 응답으로 저장됨</p>
                        ) : (
                          <div className="ob-row">
                            <button className="ob-chip ob-chip--primary" disabled={status === "saving"} onClick={() => addCandidate(key, candidate)}>
                              {status === "saving" ? "추가 중..." : "추가"}
                            </button>
                            <button className="ob-chip" disabled={status === "saving"} onClick={() => setCandidateStatus((prev) => ({ ...prev, [key]: "dismissed" }))}>
                              아니요
                            </button>
                            {status === "error" && <span className="ob-error">저장하지 못했어요</span>}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </motion.div>
              )
            )}

            {!busy && step === "occupation" && (
              <motion.div layout className="ob-row ob-options" transition={SPRING}>
                {occupationChoices.map((choice, idx) => (
                  <Chip
                    key={choice.id ?? "discovery"}
                    className="ob-chip"
                    delay={0.12 + idx * 0.04}
                    reduceMotion={reduceMotion}
                    onClick={() => chooseOccupation(choice.id, choice.name)}
                  >
                    {choice.name}
                  </Chip>
                ))}
              </motion.div>
            )}

            {!busy && step === "major" && (
              <motion.div layout className="ob-row ob-options" transition={SPRING}>
                <Chip className="ob-chip" delay={0.08} reduceMotion={reduceMotion} onClick={() => answerMajor(null)}>
                  {SKIP}
                </Chip>
              </motion.div>
            )}

            {!busy && step === "grade" && (
              <motion.div layout className="ob-row ob-options" transition={SPRING}>
                {GRADES.map((g, idx) => (
                  <Chip key={g} className="ob-chip" delay={0.08 + idx * 0.04} reduceMotion={reduceMotion} onClick={() => answerGrade(g)}>
                    {g}학년
                  </Chip>
                ))}
                <Chip className="ob-chip" delay={0.08 + GRADES.length * 0.04} reduceMotion={reduceMotion} onClick={() => answerGrade(null)}>
                  {SKIP}
                </Chip>
              </motion.div>
            )}

            {!busy && step === "checklist" && (
              <motion.div
                layout
                className="ob-checklist"
                transition={SPRING}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {groups.map((group, gi) => (
                  <section key={group.label}>
                    <p className="ob-group">{group.label}</p>
                    <div className="ob-row">
                      {group.items.map((item, ii) => {
                        const before = groups.slice(0, gi).reduce((n, g) => n + g.items.length, 0);
                        const stagger = Math.min(0.08 + (before + ii) * 0.035, 0.4);
                        return (
                          <Chip
                            key={item.item_id}
                            className={`ob-chip ob-chip--item${selected.has(item.item_id) ? " selected" : ""}`}
                            delay={stagger}
                            reduceMotion={reduceMotion}
                            ariaPressed={selected.has(item.item_id)}
                            onClick={() =>
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (next.has(item.item_id)) next.delete(item.item_id);
                                else next.add(item.item_id);
                                return next;
                              })
                            }
                          >
                            {item.label}
                          </Chip>
                        );
                      })}
                    </div>
                  </section>
                ))}
                <div className="ob-row">
                  <Chip
                    className="ob-chip ob-chip--primary"
                    disabled={selected.size === 0}
                    delay={0.08}
                    reduceMotion={reduceMotion}
                    onClick={() => submitChecklist([...selected])}
                  >
                    선택 완료{selected.size > 0 ? ` (${selected.size})` : ""}
                  </Chip>
                  <Chip className="ob-chip" delay={0.12} reduceMotion={reduceMotion} onClick={() => submitChecklist([])}>
                    해본 게 없어요
                  </Chip>
                </div>
              </motion.div>
            )}

            {!busy && step === "chat" && (
              <motion.div layout className="ob-row ob-options" transition={SPRING}>
                <Chip className="ob-chip ob-chip--primary" delay={0.08} reduceMotion={reduceMotion} onClick={() => void run(() => finish())}>
                  충분해요, 시작할게요
                </Chip>
              </motion.div>
            )}

            {busy && (
              <motion.div
                className="ob-ai ob-typing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.16 }}
              >
                <span /><span /><span />
              </motion.div>
            )}
            {error && <p className="ob-error">{error}</p>}
            <div ref={endRef} />
          </main>

          <footer className="ob-input-bar">
            <input
              className="ob-input"
              placeholder={step === "major" ? "예: 컴퓨터공학과" : step === "chat" ? "해본 경험을 자유롭게 적어주세요" : "위의 버튼으로 답해주세요"}
              value={input}
              disabled={!inputEnabled}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) submitInput();
              }}
            />
            <button className="ob-send" disabled={!inputEnabled || !input.trim()} onClick={submitInput}>보내기</button>
          </footer>
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
}
