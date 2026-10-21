import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { NcsLevel } from "../../components/NcsLevel";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ComponentProps } from "react";
import type { Skill } from "../../services/types";
import { formatDemand, formatHours, skillIdentity } from "../../services/skillDetail";
import { SkillBadge } from "./SkillBadge";
import { SkillDetailPanel } from "./SkillDetailPanel";
import { prefetchSkillResources, useActiveSkillRoadmap } from "./useSkillResources";

interface SkillListProps {
  readonly skills: readonly Skill[];
  readonly goalId: string | null;
  readonly emptyMessage: string;
  readonly linksReady?: boolean;
}

function SelectedSkillPanel(props: ComponentProps<typeof SkillDetailPanel>) {
  const reducedMotion = useReducedMotion();
  const panel = <SkillDetailPanel {...props} />;
  return props.overlay ? createPortal(<div className="sd-drawer-layer">
    <motion.div className="sd-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : .2 }} onClick={props.onClose} aria-hidden="true" />
    {panel}
  </div>, document.body) : panel;
}

export function SkillList({ skills, goalId, emptyMessage, linksReady = true }: SkillListProps) {
  const [params] = useSearchParams();
  const requirement = params.get("requirement");
  const ncsBase = params.get("ncs");
  const linkTarget = requirement || ncsBase;
  const linkedSkill = requirement ? skills.find(skill => skill.requirement_key === requirement)
    : ncsBase && /^[0-9]{10}$/.test(ncsBase) ? skills.find(skill => skill.ncs_base_code === ncsBase) : undefined;
  const linkedIdentity = linkedSkill ? skillIdentity(linkedSkill) : null;
  const appliedLink = useRef<string | null>(null);
  const reducedMotion = useReducedMotion();
  const [filter, setFilter] = useState<"전체" | Skill["type"]>("전체");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState(() => window.matchMedia("(max-width: 1099px)").matches);
  const triggerId = useRef<string | null>(null);
  const rowButtons = useRef(new Map<string, HTMLButtonElement>());
  const [panelMounted, setPanelMounted] = useState(false);
  const restoreFocus = useRef(false);
  const roadmap = useActiveSkillRoadmap(goalId);
  useEffect(() => { skills.slice(0, 3).forEach(skill => { void prefetchSkillResources(skill); }); }, [skills]);
  const visible = skills.filter(skill => filter === "전체" || skill.type === filter);
  const selected = visible.find(skill => skillIdentity(skill) === selectedId);
  const selection = useRef(selected);
  selection.current = selected;
  const close = useCallback(() => {
    restoreFocus.current = true;
    setSelectedId(null);
  }, []);

  useEffect(() => {
    if (!linksReady || !linkedIdentity || !linkTarget) return;
    const signature = `${goalId}:${linkTarget}:${linkedIdentity}`;
    if (appliedLink.current === signature) return;
    appliedLink.current = signature;
    setFilter("전체");
    triggerId.current = linkedIdentity;
    restoreFocus.current = false;
    setPanelMounted(true);
    setSelectedId(linkedIdentity);
    const frame = requestAnimationFrame(() => rowButtons.current.get(linkedIdentity)?.scrollIntoView?.({ behavior: reducedMotion ? "auto" : "smooth", block: "center" }));
    return () => {
      cancelAnimationFrame(frame);
      if (appliedLink.current === signature) appliedLink.current = null;
    };
  }, [goalId, linkTarget, linkedIdentity, linksReady, reducedMotion]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1099px)");
    const update = () => setOverlay(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return <div className={`sd-layout${(selected || panelMounted) && !overlay ? " sd-layout--selected" : ""}`}>
    <section className="sd-list" aria-labelledby="skill-list-heading">
      <div className="sd-list-heading">
        <div><h2 id="skill-list-heading">부족한 역량 <span>{skills.length}</span></h2><NcsLevel compact /></div>
        <div className="sd-filters" role="group" aria-label="역량 유형">
          <motion.span className="sd-filter-indicator" aria-hidden="true" initial={false}
            animate={{ x: ["전체", "필수", "우대"].indexOf(filter) * 68 }}
            transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 38 }} />
          {(["전체", "필수", "우대"] as const).map(value => <button key={value} type="button" aria-pressed={filter === value}
            onClick={() => {
              setFilter(value);
              if (selected && value !== "전체" && selected.type !== value) {
                restoreFocus.current = false;
                setSelectedId(null);
              }
            }}>{value}</button>)}
        </div>
      </div>
      {linksReady && linkTarget && !linkedIdentity && <p className="sd-link-notice" role="status">선택한 항목이 현재 목표의 부족한 역량 목록에 없어요. 이미 충족했거나 현재 분석에 포함되지 않은 항목일 수 있어요.</p>}
      <div className="sd-columns" aria-hidden="true"><span>역량</span><span>공고 요구</span><span className="sd-hours">예상 시간</span><span /></div>
      <AnimatePresence initial={false} mode="wait">
      <motion.div key={filter} className="sd-rows"
        initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
        transition={{ duration: reducedMotion ? 0 : .12 }}>
        {visible.map(skill => {
          const identity = skillIdentity(skill);
          const subline = [skill.status === "PARTIAL" ? `부분 반영${skill.credit != null ? ` · 모델 ${Math.round(skill.credit * 100)}%` : ""}` : "", skill.ncs_level != null ? `NCS 수준 ${skill.ncs_level}` : "",
            skill.qualifications?.length ? `관련 자격증 ${skill.qualifications.length}개` : ""].filter(Boolean).join(" · ");
          return <button type="button" className={`sd-row${linkedIdentity === identity ? " sd-row--linked" : ""}`} data-requirement={skill.requirement_key} key={identity} aria-pressed={selectedId === identity}
            ref={button => { if (button) rowButtons.current.set(identity, button); else rowButtons.current.delete(identity); }}
            onPointerEnter={() => void prefetchSkillResources(skill)} onFocus={() => void prefetchSkillResources(skill)}
            aria-controls={selectedId === identity ? "skill-panel-heading" : undefined}
            onClick={() => {
              triggerId.current = identity;
              if (selectedId === identity) close(); else {
                restoreFocus.current = false;
                setPanelMounted(true);
                setSelectedId(identity);
              }
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
      </motion.div>
      </AnimatePresence>
    </section>
    <AnimatePresence mode="wait" onExitComplete={() => {
      if (selection.current) return;
      setPanelMounted(false);
      if (restoreFocus.current) requestAnimationFrame(() => {
        if (triggerId.current) rowButtons.current.get(triggerId.current)?.focus({ preventScroll: true });
      });
    }}>
      {selected && <SelectedSkillPanel key={skillIdentity(selected)} skill={selected}
        roadmap={roadmap} overlay={overlay} onClose={close} />}
    </AnimatePresence>
  </div>;
}
