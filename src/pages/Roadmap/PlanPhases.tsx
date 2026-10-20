import { useEffect, useRef, useState } from "react";
import type { WeeklyPlanResponse, WeeklyPlanStep } from "../../services/types";
import { basisLabels, phaseLabels, prerequisiteWarning, stateLabels, stepTitle } from "../../services/weeklyPlan";
import { NcsLevel } from "../../components/NcsLevel";

interface Props {
  readonly plan: WeeklyPlanResponse;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}

export function PlanPhases({ plan, selectedId, onSelect }: Props) {
  const current = plan.steps.find(s => s.state !== "COMPLETED")?.phase ?? plan.steps[0]?.phase;
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set(current ? [current] : []));
  const selectedPhase = plan.steps.find(step => step.step_id === selectedId)?.phase;
  useEffect(() => {
    if (selectedPhase) setExpanded(previous => new Set([...previous, selectedPhase]));
  }, [selectedPhase]);
  const phases = (["BASIC", "CORE", "ADVANCED"] as const).flatMap(phase => {
    const steps = plan.steps.filter(s => s.phase === phase);
    if (!steps.length) return [];
    const levels = steps.flatMap(s => s.ncs_level === null ? [] : [s.ncs_level]);
    return [{ phase, steps, hours: steps.reduce((n, s) => n + s.hours, 0),
      done: steps.filter(s => s.state === "COMPLETED").length,
      span: `${Math.min(...steps.map(s => s.start_week))}–${Math.max(...steps.map(s => s.end_week))}주차`,
      level: levels.length ? `${Math.min(...levels)}${Math.min(...levels) === Math.max(...levels) ? "" : `–${Math.max(...levels)}`}수준` : "수준 미제공" }];
  });
  function toggle(phase: string) {
    setExpanded(previous => { const next = new Set(previous); if (next.has(phase)) next.delete(phase); else next.add(phase); return next; });
  }
  return <section className="wp-phases wp-card" aria-label="단계 묶음">
    <header className="wp-phases-heading"><h2>단계 묶음</h2><p>NCS 수준으로 묶었어요 · 묶음 안의 번호와 학습 우선순위는 달라요</p><NcsLevel compact />
      <div className="wp-phase-progress">{phases.map(p => <div key={p.phase} style={{ flex: p.hours }}>
        <div className="wp-progress-track"><span style={{ width: `${p.done / p.steps.length * 100}%` }} /></div>
        <small><b>{phaseLabels[p.phase]}</b> · {p.span}</small>
      </div>)}</div>
    </header>
    <div className="wp-phase-list">{phases.map((p, index) => <section key={p.phase} className={`wp-phase ${p.phase === current ? "wp-phase--current" : ""}`}>
      <button className="wp-phase-header" aria-expanded={expanded.has(p.phase)} aria-controls={`phase-${p.phase}`} onClick={() => toggle(p.phase)}>
        <span className={`wp-phase-number ${p.done === p.steps.length ? "done" : ""}`}>{p.done === p.steps.length ? "✓" : index + 1}</span>
        <span className="wp-phase-info"><strong>{phaseLabels[p.phase]}</strong> <span className="wp-chip">NCS {p.level}</span>
          {p.phase === current && <span className="wp-chip wp-chip--indigo">지금 여기</span>}
          <small>{p.span} · 총 {p.hours}시간</small></span>
        <span className="wp-phase-count"><b>{p.done}/{p.steps.length} 완료</b><small>{p.steps.length}단계</small></span>
        <svg className="wp-phase-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <div className="wp-phase-fold" id={`phase-${p.phase}`} data-expanded={expanded.has(p.phase)}
        aria-hidden={!expanded.has(p.phase)} inert={!expanded.has(p.phase)}>
        <div className="wp-phase-fold-inner"><div className="wp-phase-steps">{p.steps.map((step, index) => <PhaseRow key={step.step_id} step={step} groupNumber={index + 1} steps={plan.steps} selected={step.step_id === selectedId} onSelect={() => onSelect(step.step_id)} />)}</div></div>
      </div>
    </section>)}</div>
  </section>;
}

function PhaseRow({ step, groupNumber, steps, selected, onSelect }: { readonly step: WeeklyPlanStep; readonly groupNumber: number; readonly steps: readonly WeeklyPlanStep[]; readonly selected: boolean; readonly onSelect: () => void }) {
  const warning = prerequisiteWarning(step, steps);
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => { if (selected) row.current?.scrollIntoView?.({ block: "nearest", behavior: "instant" }); }, [selected]);
  return <div ref={row} className="wp-phase-row">
    <span className={`wp-node wp-node--${step.state}`} aria-hidden="true">{step.state === "COMPLETED" ? "✓" : ""}</span>
    <button className="wp-step" aria-pressed={selected} onClick={onSelect}>
      <span className="wp-step-number">{phaseLabels[step.phase]} {groupNumber}</span>
      <span className="wp-step-copy"><strong>{stepTitle(step)}</strong>{stepTitle(step) !== step.name && <small>관련 역량 · {step.name}</small>}<small>학습 우선순위 {step.number} · {step.start_week}–{step.end_week}주차 · {step.hours}시간 {basisLabels[step.hours_basis]}</small>
        {step.moved && <span className="wp-chip wp-chip--indigo">직접 바꾼 순서</span>}
        {warning && <span className="wp-warning">{warning}</span>}
      </span>
      {step.demand_pct !== null && <span className="wp-chip">공고 {step.demand_pct}%</span>}
      <span className={`wp-pill wp-pill--${step.state}`}>{stateLabels[step.state]}</span><span aria-hidden="true">›</span>
    </button>
  </div>;
}
