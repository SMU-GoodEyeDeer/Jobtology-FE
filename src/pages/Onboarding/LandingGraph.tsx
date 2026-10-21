import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { COMPACT_POSITIONS, CONNECTIONS, INITIAL_POSITIONS, LANDING_ROLES, NODE_IDS, connectionPath } from "./landingGraphModel";
import type { LandingRole, NodeId } from "./landingGraphModel";

function NodeIcon({ kind }: { readonly kind: "me" | "project" | "postings" | "goal" | "activity" }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "me" ? <><circle cx="12" cy="8" r="3" /><path d="M5 21v-3a7 7 0 0 1 14 0v3" /></>
      : kind === "project" ? <><rect x="3" y="5" width="18" height="15" rx="3" /><path d="m8 11-2 2 2 2m8-4 2 2-2 2m-3-5-2 7" /></>
      : kind === "postings" ? <><rect x="3" y="7" width="18" height="14" rx="3" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a22 22 0 0 0 18 0M10 13h4" /></>
      : kind === "activity" ? <><path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4L12 17.5l-5.7 3.1 1.1-6.4-4.6-4.5 6.4-.9Z" /></>
      : <><path d="m4 18 5-6 4 3 7-10m-6 0h6v6" /></>}
  </svg>;
}
function nodeContent(id: NodeId, role: LandingRole) {
  switch (id) {
    case "me": return { label: "나의 경험", type: "출발점", description: "프로젝트와 경험이 경로의 출발점이 돼요." };
    case "project": return { label: "프로젝트", type: "내 스펙", description: "직접 해낸 일을 역량과 연결해요." };
    case "skill1": return { label: role.skills[0], type: "역량", description: "내 경험과 목표 직무의 요구 역량을 비교해요." };
    case "skill2": return { label: role.skills[1], type: "역량", description: "이미 해낸 것과 더 배울 것을 나눠 봐요." };
    case "skill3": return { label: role.skills[2], type: "역량", description: "부족한 역량에서 다음 학습 단계를 찾아요." };
    case "activity": return { label: role.activity, type: "다음 한 걸음", description: "학습 시간과 목표일에 맞춰 계획을 세워요." };
    case "postings": return { label: "채용공고", type: "직무의 근거", description: "채용공고에서 직무와 역량의 연결을 살펴봐요." };
    case "catalog": return { label: "NCS · O*NET", type: "역량의 기준", description: "서로 다른 역량 기준을 참고해 탐색해요." };
    case "goal": return { label: role.label, type: "목표 직무", description: "목표를 바꾸면 준비할 역량과 경로도 달라져요." };
  }
}

export function LandingGraph() {
  const [roleIndex, setRoleIndex] = useState(0);
  const [compact, setCompact] = useState(false);
  const positions = compact ? COMPACT_POSITIONS : INITIAL_POSITIONS;
  const [selected, setSelected] = useState<NodeId | null>(null);
  const [hovered, setHovered] = useState<NodeId | null>(null);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const query = window.matchMedia?.("(max-width: 600px)");
    if (!query) return;
    const update = () => setCompact(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const role = LANDING_ROLES[roleIndex];
  const active = hovered ?? selected;
  const connected = new Set<NodeId>(active ? [active] : []);
  for (const [from, to] of CONNECTIONS) if (from === active || to === active) { connected.add(from); connected.add(to); }
  return <section className="landing-explorer" aria-label="커리어 경로 미리보기">
    <div className="landing-role-picker" role="group" aria-label="미리 볼 목표 직무">
      {LANDING_ROLES.map((item, index) => <button type="button" data-mouse-field="8" key={item.id} aria-pressed={roleIndex === index} onClick={() => { setRoleIndex(index); setSelected(null); }}>
        <span className="landing-role-dot" aria-hidden="true" />{item.label}
      </button>)}
    </div>
    <p className="sr-only" id="landing-graph-help">예시 경로예요. 노드를 선택하면 관련 연결을 강조해요. Escape 키로 선택을 해제할 수 있어요.</p>
    <div className="landing-graph">
      <svg className="landing-connections" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {CONNECTIONS.map(([from, to], index) => {
          const highlighted = active === from || active === to;
          return <g key={`${from}-${to}`} className={active ? highlighted ? "is-connected" : "is-dimmed" : ""}>
            <path className="landing-edge" data-edge-from={from} data-edge-to={to} d={connectionPath(positions[from], positions[to])} vectorEffect="non-scaling-stroke" />
            <path className="landing-edge-flow" data-edge-from={from} data-edge-to={to} d={connectionPath(positions[from], positions[to])} vectorEffect="non-scaling-stroke" style={{ animationDelay: `${index * -.7}s` }} />
          </g>;
        })}
      </svg>
      {NODE_IDS.map((id, index) => {
        const content = nodeContent(id, role);
        const icon = id === "me" || id === "project" || id === "postings" || id === "goal" || id === "activity" ? id : null;
        return <motion.div className={`landing-node-position landing-node-position--${id}`} key={id} data-mouse-field="36" data-graph-node={id}
          style={{ left: `${positions[id].x}%`, top: `${positions[id].y}%` }}
          initial={reduceMotion ? false : { opacity: 0, scale: .88 }} animate={{ opacity: active && !connected.has(id) ? .38 : 1, scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : .35, delay: active ? 0 : index * .025 }}>
          <button type="button" className={`landing-node landing-node--${id}${active === id ? " is-active" : ""}`}
            aria-label={`${content.label} 연결 보기`} aria-pressed={selected === id} aria-describedby="landing-graph-help" aria-description={content.description}
            onPointerEnter={() => setHovered(id)} onPointerLeave={() => setHovered(null)} onFocus={() => setHovered(id)} onBlur={() => setHovered(null)}
            onKeyDown={event => { if (event.key === "Escape") { setSelected(null); setHovered(null); } }}
            onClick={() => setSelected(previous => previous === id ? null : id)}>
            {icon && <span className="landing-node-icon"><NodeIcon kind={icon} /></span>}
            <span className="landing-node-copy">{(id === "me" || id === "goal" || id === "activity") && <small>{content.type}</small>}<motion.strong key={content.label} initial={reduceMotion ? false : { opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : .2 }}>{content.label}</motion.strong></span>
            {id.startsWith("skill") && <span className="landing-node-port" aria-hidden="true" />}
          </button>
        </motion.div>;
      })}
    </div>
  </section>;
}
