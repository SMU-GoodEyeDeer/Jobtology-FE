import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useIsPresent, useReducedMotion } from "motion/react";
import { SkillDefinition, SkillQualifications } from "../Analysis/SkillEvidence";
import type { Skill, WeeklyPlanResponse, WeeklyPlanStep } from "../../services/types";
import { basisLabels, phaseLabels, shortDate, stateLabels, stepReason, prerequisiteWarning } from "../../services/weeklyPlan";

interface Props {
  readonly plan: WeeklyPlanResponse;
  readonly step: WeeklyPlanStep;
  readonly skill?: Skill;
  readonly busy: boolean;
  readonly onComplete: () => void;
  readonly onClose?: () => void;
}

export function PlanStepDetail({ plan, step, skill, busy, onComplete, onClose }: Props) {
  const navigate = useNavigate();
  const present = useIsPresent();
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);
  const done = step.state === "COMPLETED";
  const started = step.state === "IN_PROGRESS";
  const warning = prerequisiteWarning(step, plan.steps);
  const content = <>
    <header className="wp-detail-header">
      <p className="wp-eyebrow">STEP {step.number} · {phaseLabels[step.phase]} 단계</p>
      <h2 id="plan-step-title">{step.name}</h2>
      <span className={`wp-pill wp-pill--${step.state}`}>{stateLabels[step.state]}</span>
      {onClose && <button className="sd-close" onClick={onClose} aria-label="상세 닫기">×</button>}
    </header>
    <div className="wp-detail-body">
      <dl className="wp-stats">
        <div><dt>학습 시간</dt><dd>{step.hours}시간 <small>{basisLabels[step.hours_basis]}</small></dd><small>주 {plan.weekly_hours}시간 기준 약 {Math.ceil(step.hours / plan.weekly_hours * 10) / 10}주</small></div>
        <div><dt>NCS 수준</dt><dd>{step.ncs_level === null ? "—" : `${step.ncs_level}수준`}</dd><small>{step.field_name ?? "분야 정보 없음"}</small></div>
        <div><dt>공고 요구</dt><dd>{step.demand_pct === null ? "—" : `${step.demand_pct}%`}</dd><small>채용 공고 기준</small></div>
      </dl>
      <div className="wp-schedule"><strong>일정</strong><span>{step.start_week}–{step.end_week}주차 · {shortDate(step.start_date)}–{shortDate(step.end_date)}<small>주 {plan.weekly_hours}시간 기준</small></span></div>
      <section className="wp-reason"><h3>왜 이 순서?</h3><p>{stepReason(step)}</p></section>
      {warning && <p className="wp-warning">{warning}</p>}
      {skill && <SkillDefinition skill={skill} />}
      <section className="wp-tasks">
        <h3>이번 단계에서 할 일 <small>{done ? 3 : started ? 1 : 0}/3 완료</small></h3>
        <ol>
          <li className={done || started ? "done" : ""}><span>{done || started ? "✓" : "①"}</span><div>NCS 정의 읽고 핵심 용어 정리<small>30분</small></div></li>
          <li className={done ? "done" : started ? "current" : ""} aria-current={started ? "step" : undefined}><span>{done ? "✓" : "②"}</span><div>학습 {step.hours}시간<small>주 {plan.weekly_hours}시간 기준 약 {Math.ceil(step.hours / plan.weekly_hours * 10) / 10}주</small></div></li>
          <li className={done ? "done" : ""}><span>{done ? "✓" : "③"}</span><div>배운 내용을 적용한 결과물 1건 정리</div></li>
        </ol>
      </section>
      {skill && <SkillQualifications skill={skill} />}
    </div>
    <footer className="wp-detail-footer">
      <button className="wp-button wp-button--primary" disabled={busy} onClick={onComplete}>{done ? "완료 취소" : "완료로 표시"}</button>
      <button className="wp-button" onClick={() => navigate("/analysis")}>역량 분석에서 보기</button>
    </footer>
  </>;
  return onClose ? <motion.dialog ref={dialogRef} className="wp-detail wp-dialog" aria-labelledby="plan-step-title" data-exiting={!present}
    initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
    transition={{ duration: reduceMotion ? 0 : .22, ease: [.22, 1, .36, 1] }}
    onCancel={event => { event.preventDefault(); closeRef.current?.(); }}
    onClick={event => { if (event.target === event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    } }}>{content}</motion.dialog> : <aside className="wp-detail" aria-labelledby="plan-step-title">{content}</aside>;
}
