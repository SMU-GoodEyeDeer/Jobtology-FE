import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { RoadmapDetailResponse, Skill, StepState } from "../../services/types";
import { formatHours, formatPeriod, linkedRoadmapSteps } from "../../services/skillDetail";
import { SkillBadge } from "./SkillBadge";
import { DetailSkeleton, SkillDefinition, SkillQualifications } from "./SkillEvidence";
import { useSkillEvidenceReady } from "./useSkillResources";
import type { Resource } from "./useSkillResources";

interface PanelProps {
  readonly skill: Skill;
  readonly roadmap: Resource<RoadmapDetailResponse | null>;
  readonly overlay: boolean;
  readonly onClose: () => void;
}

const stepLabels: Record<StepState, string> = { TODO: "예정", IN_PROGRESS: "진행 중", COMPLETED: "완료" };

export function SkillDetailPanel({ skill, roadmap, overlay, onClose }: PanelProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const evidenceReady = useSkillEvidenceReady(skill);
  const ready = evidenceReady && roadmap.state !== "loading";
  const steps = linkedRoadmapSteps(skill, roadmap.state === "ready" ? roadmap.data?.steps ?? [] : []);

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [skill]);

  useEffect(() => {
    const root = document.getElementById("root");
    if (overlay && root) root.inert = true;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab" || !overlay) return;
      const controls = panel.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
      const first = controls?.[0];
      const last = controls?.[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      if (overlay && root) root.inert = false;
      document.removeEventListener("keydown", handleKey);
    };
  }, [overlay, onClose]);

  const evidence = [
    skill.demand_postings != null ? `${skill.demand_postings}건` : "",
    skill.demand_base != null ? `전체 ${skill.demand_base}건` : "",
  ].filter(Boolean).join(" / ");
  const demand = [evidence, skill.demand_pct != null ? `${skill.demand_pct}%` : ""].filter(Boolean).join(" · ");

  return <aside ref={panel} className={`sd-panel${overlay ? " sd-panel--overlay" : ""}`}
    role={overlay ? "dialog" : "complementary"} aria-modal={overlay || undefined} aria-labelledby="skill-panel-heading">
    <header className="sd-panel-header">
      <p className="sd-eyebrow">선택한 역량</p>
      <button className="sd-close" type="button" aria-label="패널 닫기" onClick={onClose}>×</button>
      <h2 id="skill-panel-heading" ref={heading} tabIndex={-1}>{skill.name}</h2>
      <div className="sd-badges"><SkillBadge type={skill.type} />
        {skill.demand_pct != null && <span className="sd-badge sd-badge--neutral">공고 {skill.demand_pct}%</span>}
      </div>
    </header>
    <div className="sd-panel-body" aria-busy={!ready}>
      {!ready && <div className="sd-panel-loading"><DetailSkeleton /><DetailSkeleton /><DetailSkeleton /></div>}
      <div className="sd-panel-content" hidden={!ready}>
      <SkillDefinition key={skill.ncs_base_code ?? "missing"} skill={skill} />
      <section className="sd-section">
        <h3>내 상태</h3>
        <dl className="sd-facts">
          {skill.status && <div><dt>상태</dt><dd><span className={`sd-badge sd-badge--${skill.status === "UNMET" ? "unmet" : "input"}`}>
            {skill.status === "UNMET" ? "부족" : "입력 필요"}</span></dd></div>}
          {skill.ncs_level != null && <div><dt>NCS 수준</dt><dd>{skill.ncs_level}수준</dd></div>}
          <div><dt>예상 학습 시간</dt><dd>{formatHours(skill, true)}</dd></div>
          {demand && <div><dt>공고 근거</dt><dd>{demand}<small>검토된 과거 공고 기준</small></dd></div>}
        </dl>
      </section>
      <SkillQualifications skill={skill} />
      <section className="sd-section">
        <h3>이 역량이 들어간 로드맵 단계</h3>
        {roadmap.state === "loading" ? <DetailSkeleton />
          : roadmap.state === "error" || roadmap.state === "missing" ? <p className="sd-empty-card">로드맵을 불러오지 못했어요</p>
          : steps.length === 0 ? <p className="sd-empty-card">아직 로드맵에 들어가지 않은 역량이에요</p>
          : steps.map(step => <div className="sd-step" key={step.step_id}>
            <span className="sd-step-number">{step.position != null ? step.position + 1 : step.order ?? "—"}</span>
            <div><strong>{step.title}</strong><p className="sd-muted">{formatPeriod(step.planned_start, step.planned_end)}
              <span className={`sd-badge sd-step-state--${step.state}`}>{stepLabels[step.state]}</span></p></div>
            <button type="button" className="sd-step-link" onClick={() => navigate("/roadmap")}>보기</button>
          </div>)}
      </section>
      </div>
    </div>
    <footer className="sd-panel-footer">
      <button type="button" disabled={!ready} onClick={() => navigate("/roadmap")}>로드맵에서 보기</button>
    </footer>
  </aside>;
}
