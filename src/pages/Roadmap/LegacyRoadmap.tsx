import { useState } from "react";
import type { RoadmapDetailResponse, StepState } from "../../services/types";

export function LegacyRoadmap({ roadmap, onComplete }: {
  readonly roadmap: RoadmapDetailResponse;
  readonly onComplete: (id: string, state: StepState) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function complete(id: string, state: StepState) {
    setBusy(true); setError(null);
    try { await onComplete(id, state); }
    catch (cause) { setError(cause instanceof Error ? "완료 상태를 저장하지 못했어요. 다시 시도해 주세요." : "요청을 처리하지 못했어요."); }
    finally { setBusy(false); }
  }
  return <section className="rm-card">
    <div className="rm-card-header"><div className="rm-card-title-row"><span className="rm-card-title">{roadmap.title}</span><span className="rm-badge rm-badge--profile">활성</span></div></div>
    <p className="rm-card-sub">{roadmap.steps.filter(s => s.state === "COMPLETED").length}/{roadmap.steps.length}단계 완료</p>
    {error && <p role="alert">{error}</p>}
    {roadmap.steps.map(step => <div key={step.step_id} className={`rm-step-item ${step.state === "IN_PROGRESS" ? "rm-step-item--current" : ""}`}>
      <div className="rm-step-top"><div className="rm-step-left"><span className="rm-step-name">{step.title}</span>{step.state !== "TODO" && <span className={`rm-badge ${step.state === "COMPLETED" ? "rm-badge--done" : "rm-badge--now"}`}>{step.state === "COMPLETED" ? "완료" : "진행 중"}</span>}</div></div>
      {step.description && <p className="rm-step-desc">{step.description}</p>}
      <button className="rm-complete-btn" disabled={busy} onClick={() => void complete(step.step_id, step.state)}>{step.state === "COMPLETED" ? "완료 취소" : "완료했어요"}</button>
    </div>)}
  </section>;
}
