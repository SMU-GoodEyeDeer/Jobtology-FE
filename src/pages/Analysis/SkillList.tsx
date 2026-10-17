import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Skill } from "../../services/types";
import { formatDemand, formatHours, skillIdentity } from "../../services/skillDetail";
import { SkillBadge } from "./SkillBadge";
import { SkillDetailPanel } from "./SkillDetailPanel";

interface SkillListProps {
  readonly skills: readonly Skill[];
  readonly goalId: string | null;
  readonly emptyMessage: string;
}

export function SkillList({ skills, goalId, emptyMessage }: SkillListProps) {
  const [filter, setFilter] = useState<"전체" | Skill["type"]>("전체");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState(() => window.matchMedia("(max-width: 1099px)").matches);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const visible = skills.filter(skill => filter === "전체" || skill.type === filter);
  const selected = visible.find(skill => skillIdentity(skill) === selectedId);
  const close = useCallback(() => {
    setSelectedId(null);
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1099px)");
    const update = () => setOverlay(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const panel = selected ? <SkillDetailPanel key={skillIdentity(selected)} skill={selected}
    goalId={goalId} overlay={overlay} onClose={close} /> : null;

  return <div className={`sd-layout${selected && !overlay ? " sd-layout--selected" : ""}`}>
    <section className="sd-list" aria-labelledby="skill-list-heading">
      <div className="sd-list-heading">
        <div><h2 id="skill-list-heading">부족한 역량 <span>{skills.length}</span></h2>
          <p>역량을 누르면 무엇을 해야 하는지 풀어서 보여드려요</p></div>
        <div className="sd-filters" role="group" aria-label="역량 유형">
          {(["전체", "필수", "우대"] as const).map(value => <button key={value} type="button" aria-pressed={filter === value}
            onClick={() => {
              setFilter(value);
              if (selected && value !== "전체" && selected.type !== value) setSelectedId(null);
            }}>{value}</button>)}
        </div>
      </div>
      <div className="sd-columns" aria-hidden="true"><span>역량</span><span>공고 요구</span><span className="sd-hours">예상 시간</span><span /></div>
      <div className="sd-rows">
        {visible.map(skill => {
          const identity = skillIdentity(skill);
          const subline = [skill.ncs_level != null ? `NCS 수준 ${skill.ncs_level}` : "",
            skill.qualifications?.length ? `관련 자격증 ${skill.qualifications.length}개` : ""].filter(Boolean).join(" · ");
          return <button type="button" className="sd-row" key={identity} aria-pressed={selectedId === identity}
            aria-controls={selectedId === identity ? "skill-panel-heading" : undefined}
            onClick={event => {
              trigger.current = event.currentTarget;
              if (selectedId === identity) close(); else setSelectedId(identity);
            }}>
            <span className="sd-identity"><span className="sd-name"><strong>{skill.name}</strong><SkillBadge type={skill.type} /></span>
              {subline && <span className="sd-subline">{subline}</span>}</span>
            <span className="sd-demand">
              {skill.demand_pct != null && <span className="sd-demand-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, skill.demand_pct))}%` }} /></span>}
              <span>{formatDemand(skill)}</span>
            </span>
            <span className="sd-hours">{formatHours(skill)}</span>
            <svg className="sd-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>;
        })}
        {visible.length === 0 && <p className="an-empty-state">{skills.length ? "해당 유형의 부족한 역량이 없어요." : emptyMessage}</p>}
      </div>
    </section>
    {overlay && panel ? createPortal(<div className="sd-drawer-layer"><div className="sd-backdrop" onClick={close} aria-hidden="true" />{panel}</div>, document.body) : panel}
  </div>;
}
