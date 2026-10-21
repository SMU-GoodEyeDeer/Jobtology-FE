import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion } from "motion/react";
import "./OnboardingChat.css";
import { BrandLogo, BrandWordmark } from "../../components/BrandLogo";
import { useSession } from "../../context/SessionContext";
import { useOccupations } from "../../context/OccupationsContext";
import { saveProfile, startGoal } from "../../services/onboardingSave";
import { SpecManager } from "../../components/specs/SpecManager";
import { ThemeToggle } from "../../components/ThemeToggle";
import { progressIndex, progressSteps } from "./progress";
import { Chip, EASE_OUT, Outro, BrandMark, ProgressTrail, SPRING } from "./parts";
import { INTRO_FADE_S, OUTRO_MIN_MS, introElapsedMs, introHoldMs, resetIntroStart } from "./timings";

export type Step = "occupation" | "major" | "grade" | "specs";
type Message = { role: "ai" | "user"; text: string };
const DISCOVERY = "아직 모르겠어요";
const SKIP = "건너뛰기";
const GRADES = [1, 2, 3, 4];
const SCRIPTED_TYPING_MS = 500;
export const QUESTIONS: Record<Step, string> = {
  occupation: "어떤 IT 직무를 목표로 하세요?",
  major: "전공(학과)이 무엇인가요? 직접 입력해 주세요.",
  grade: "몇 학년이세요?",
  specs: "지금까지의 스펙을 정리해 볼까요? 직무를 아직 정하지 않아도 추가할 수 있고, 나중에 내 정보에서 수정할 수 있어요.",
};
function wait(ms: number) { return new Promise<void>(resolve => setTimeout(resolve, ms)); }

export function OnboardingChat() {
  const navigate = useNavigate();
  const { session, loading: sessionLoading, refresh } = useSession();
  const { occupations } = useOccupations();
  const reduceMotion = useReducedMotion() ?? false;
  const [step, setStep] = useState<Step>("occupation");
  const [messages, setMessages] = useState<Message[]>([{ role: "ai", text: QUESTIONS.occupation }]);
  const [introVisible, setIntroVisible] = useState(!reduceMotion);
  const [outroVisible, setOutroVisible] = useState(false);
  const [occupation, setOccupation] = useState<{ id: string; name: string } | null>(null);
  const [goalStarted, setGoalStarted] = useState(false);
  const [major, setMajor] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [specBusy, setSpecBusy] = useState(false);
  const [specEditing, setSpecEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const centerStart = !messages.some(message => message.role === "user");
  useEffect(() => { if (!sessionLoading && !session) navigate("/"); }, [session, sessionLoading, navigate]);
  useEffect(() => {
    if (!introVisible) return;
    const hold = introHoldMs(introElapsedMs()); resetIntroStart();
    const timer = setTimeout(() => setIntroVisible(false), hold);
    return () => clearTimeout(timer);
  }, [introVisible]);
  useEffect(() => { endRef.current?.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth" }); }, [messages, step, busy, reduceMotion]);
  const say = (message: Message) => setMessages(previous => [...previous, message]);
  async function run(action: () => Promise<void>) {
    if (busyRef.current || specBusy) return;
    busyRef.current = true; setBusy(true); setError(null);
    try { await action(); }
    catch { setError("저장 중 문제가 생겼어요. 입력은 유지했어요. 같은 단계를 다시 시도해 주세요."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function ask(next: Step) {
    setStep(next);
    if (!reduceMotion) await wait(SCRIPTED_TYPING_MS);
    say({ role: "ai", text: QUESTIONS[next] });
  }
  function chooseOccupation(id: string | null, name: string) {
    void run(async () => {
      await startGoal(id); setGoalStarted(true); setOccupation(id ? { id, name } : null);
      say({ role: "user", text: name }); await ask("major");
    });
  }
  function answerMajor(value: string | null) {
    void run(async () => { setMajor(value); say({ role: "user", text: value ?? SKIP }); await ask("grade"); });
  }
  function answerGrade(year: number | null) {
    void run(async () => {
      await saveProfile(major, year); say({ role: "user", text: year ? `${year}학년` : SKIP }); await ask("specs");
    });
  }
  async function finish() {
    if (specEditing && !window.confirm("저장하지 않은 스펙 내용은 남지 않아요. 지금 시작할까요?")) return;
    setOutroVisible(true);
    try {
      const saves = async () => {
        if (!goalStarted) await startGoal(occupation?.id ?? null);
        if (step === "grade" && major) await saveProfile(major, null);
        await refresh();
      };
      if (reduceMotion) await saves(); else await Promise.all([saves(), wait(OUTRO_MIN_MS)]);
      navigate("/home/first");
    } catch (cause) { setOutroVisible(false); throw cause; }
  }
  function submitInput() {
    const text = input.trim();
    if (!text || busy || step !== "major") return;
    setInput(""); answerMajor(text);
  }
  return <MotionConfig reducedMotion="user"><LayoutGroup>
    <div className={`ob-page${centerStart ? " ob-page--center" : ""}`}>
      <div className="ob-bg" aria-hidden="true"><div className="ob-blob ob-blob--a" /><div className="ob-blob ob-blob--b" /><div className="ob-blob ob-blob--c" /></div>
      <AnimatePresence>{introVisible && <motion.div className="ob-intro" role="status" aria-label="잡톨로지" exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : INTRO_FADE_S, ease: EASE_OUT }}><motion.div className="ob-intro-stack" exit={{ scale: .96, filter: "blur(8px)" }} transition={{ duration: reduceMotion ? 0 : INTRO_FADE_S, ease: EASE_OUT }}><BrandMark /><BrandWordmark className="ob-intro-word" /></motion.div></motion.div>}</AnimatePresence>
      <AnimatePresence>{outroVisible && <Outro reduceMotion={reduceMotion} />}</AnimatePresence>
      <header className="ob-header"><div className="ob-header-inner"><div className="ob-brand"><BrandLogo /></div><ProgressTrail steps={progressSteps()} current={progressIndex(step)} /><div className="ob-header-actions"><ThemeToggle compact /><button className="ob-stop" disabled={busy || specBusy} onClick={() => void run(finish)}>그만하고 시작하기</button></div></div></header>
      <main className={`ob-chat${centerStart ? " ob-chat--center" : ""}`}>
        {messages.map((message, index) => message.role === "user"
          ? <motion.div key={index} className="ob-user" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : .24, ease: EASE_OUT }}>{message.text}</motion.div>
          : <motion.div key={index} className="ob-ai-wrap" layout={index === 0 ? true : undefined} transition={index === 0 ? SPRING : { duration: reduceMotion ? 0 : .24, ease: EASE_OUT }} initial={index === 0 ? false : { opacity: 0, y: 12 }} animate={index === 0 ? undefined : { opacity: 1, y: 0 }}><div className={`ob-ai${index === 0 && centerStart ? " ob-ai--hero" : ""}`}>{message.text}</div></motion.div>)}
        {!busy && step === "occupation" && <motion.div layout className="ob-row ob-options" transition={SPRING}>{[...occupations.map(item => ({ id: item.occupation_id, name: item.name })), { id: null, name: DISCOVERY }].map((choice, index) => <Chip key={choice.id ?? "discovery"} className="ob-chip" delay={.12 + index * .04} reduceMotion={reduceMotion} onClick={() => chooseOccupation(choice.id, choice.name)}>{choice.name}</Chip>)}</motion.div>}
        {!busy && step === "major" && <motion.div layout className="ob-row ob-options" transition={SPRING}><Chip className="ob-chip" reduceMotion={reduceMotion} onClick={() => answerMajor(null)}>{SKIP}</Chip></motion.div>}
        {!busy && step === "grade" && <motion.div layout className="ob-row ob-options" transition={SPRING}>{GRADES.map(year => <Chip key={year} className="ob-chip" reduceMotion={reduceMotion} onClick={() => answerGrade(year)}>{year}학년</Chip>)}<Chip className="ob-chip" reduceMotion={reduceMotion} onClick={() => answerGrade(null)}>{SKIP}</Chip></motion.div>}
        {step === "specs" && <section className="ob-specs"><SpecManager occupationId={occupation?.id} disabled={busy} onBusyChange={setSpecBusy} onEditingChange={setSpecEditing} /><div className="ob-row ob-specs-finish"><button className="ob-chip ob-chip--primary" disabled={busy || specBusy} onClick={() => void run(finish)}>정리 완료, 시작하기</button><button className="ob-chip" disabled={busy || specBusy} onClick={() => void run(finish)}>스펙은 나중에 추가하기</button></div></section>}
        {busy && <motion.div className="ob-ai ob-typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><span /><span /><span /></motion.div>}
        {error && <p className="ob-error" role="alert">{error}</p>}<div ref={endRef} />
      </main>
      {step !== "specs" && <footer className="ob-input-bar"><input className="ob-input" aria-label="학과 입력" maxLength={500} placeholder={step === "major" ? "예: 컴퓨터공학과" : "위의 버튼으로 답해주세요"} value={input} disabled={busy || step !== "major"} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) submitInput(); }} /><button className="ob-send" disabled={busy || step !== "major" || !input.trim()} onClick={submitInput}>보내기</button></footer>}
    </div>
  </LayoutGroup></MotionConfig>;
}
