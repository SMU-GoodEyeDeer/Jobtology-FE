import { useId, useLayoutEffect, useRef, useState } from "react";
import "./NcsLevel.css";

export const NCS_LEVELS = [
  { level: 1, description: "구체적인 지시와 철저한 감독 아래 기초 지식을 활용해 단순하고 반복적인 과업을 수행하는 수준" },
  { level: 2, description: "일반적인 지시와 감독 아래 절차에 따라 과업을 수행하는 수준", context: "고등학교·기능사 과정" },
  { level: 3, description: "제한된 권한 안에서 기본 이론과 일반 지식을 활용해 다소 복잡한 과업을 수행하는 수준", context: "전문대학·산업기사 과정" },
  { level: 4, description: "일반적인 권한 안에서 제한된 이론과 지식을 활용해 복잡하고 다양한 과업을 수행하는 수준", context: "4년제 대학·기사 과정" },
  { level: 5, description: "포괄적인 권한 안에서 이론과 지식을 자유롭게 활용해 복잡하고 비일상적인 과업을 수행하는 수준" },
  { level: 6, description: "독립적인 권한 안에서 지식과 기술을 자유롭게 활용해 숙련된 과업을 수행하는 수준", context: "학사·기사 및 고숙련 업무" },
  { level: 7, description: "전문적인 이론과 지식을 활용해 광범위한 업무를 수행하고 다른 사람의 결과에도 책임지는 수준", context: "석사 과정" },
  { level: 8, description: "최고 수준의 이론과 지식을 활용해 새로운 이론을 만들고 조직 전반의 권한과 책임을 갖는 수준", context: "박사·기술사 과정" },
] as const;

export function NcsDegreeNote({ level, levels = [] }: { readonly level?: number | null; readonly levels?: readonly (number | null)[] }) {
  const highLevels = [7, 8].filter(value => value === level || levels.includes(value));
  if (!highLevels.length) return null;
  const context = highLevels.length === 2 ? "석사·박사 수준의 전문 업무" : highLevels[0] === 7 ? "석사 수준의 전문 업무" : "박사 수준의 연구·전문 업무";
  return <p className="ncs-degree-note" role="note">
    <strong>{highLevels.join("·")}수준 · {context} 참고</strong>
    <span>NCS 수준만으로 학위가 필수인 것은 아니에요. 실제 채용공고의 학위·응시 자격을 확인해 주세요.</span>
  </p>;
}

export function NcsLevel({ level, compact = false }: { readonly level?: number | null; readonly compact?: boolean }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selected = NCS_LEVELS.find(item => item.level === level);

  useLayoutEffect(() => {
    if (!open) return;
    function position() {
      if (!trigger.current || !popup.current) return;
      const anchor = trigger.current.getBoundingClientRect();
      const card = popup.current.getBoundingClientRect();
      const left = Math.max(16, Math.min(anchor.left, window.innerWidth - card.width - 16));
      const below = anchor.bottom + 8;
      const top = below + card.height <= window.innerHeight - 16 ? below
        : Math.max(16, Math.min(anchor.top - card.height - 8, window.innerHeight - card.height - 16));
      popup.current.style.left = `${left}px`;
      popup.current.style.top = `${top}px`;
    }
    position();
    closeButton.current?.focus({ preventScroll: true });
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    }
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    document.addEventListener("keydown", escape, true);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open]);

  function close() {
    popup.current?.hidePopover();
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  return <div className={`ncs-level${compact ? " ncs-level--compact" : ""}`}>
    <button ref={trigger} type="button" className="ncs-level-trigger" aria-haspopup="dialog" aria-controls={id} aria-expanded={open} onClick={() => {
      if (open) close();
      else { popup.current?.showPopover(); setOpen(true); }
    }}>
      {selected ? `NCS ${level}수준` : "NCS 수준 안내"}
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" /><path d="M10 9v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="10" cy="6.5" r=".9" fill="currentColor" /></svg>
    </button>
    <div ref={popup} id={id} popover="auto" className="ncs-level-popup" role="dialog" aria-labelledby={`${id}-title`} aria-hidden={!open} inert={!open}
      onToggle={event => setOpen((event.nativeEvent as ToggleEvent).newState === "open")}>
      <header className="ncs-level-popup-heading"><h3 id={`${id}-title`}>NCS 수준 안내</h3><button ref={closeButton} type="button" className="ncs-level-close" aria-label="NCS 수준 안내 닫기" disabled={!open} onClick={close}><svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></button></header>
      <div className="ncs-level-help">
      <p>NCS 수준은 업무의 복잡성, 권한과 책임을 설명해요. 나의 숙련도 점수가 아니에요.</p>
      <NcsDegreeNote level={level} />
      <ol>{NCS_LEVELS.map(item => <li key={item.level} className={item.level === level ? "ncs-level-current" : undefined} aria-current={item.level === level ? "true" : undefined}>
        <strong>{item.level}수준</strong><span>{item.description}</span>{"context" in item && <small>이해를 돕는 예: {item.context}</small>}
      </li>)}</ol>
      <p className="ncs-level-caution">학력·자격 예시는 이해를 돕는 대략적인 참고이며 동등 학력, 응시 자격이나 채용 요건을 보장하지 않아요.</p>
      <a href="https://www.ncs.go.kr/mobile/rm01/TH10200103.do" target="_blank" rel="noopener noreferrer" tabIndex={open ? 0 : -1}>NCS 공식 수준 체계 보기 ↗</a>
      </div>
    </div>
  </div>;
}
