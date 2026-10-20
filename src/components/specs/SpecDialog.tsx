import { useEffect, useId, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";

interface Props {
  readonly title: string;
  readonly description: string;
  readonly view: string;
  readonly busy?: boolean;
  readonly back?: boolean;
  readonly onDismiss: () => void;
  readonly children: ReactNode;
}

export function SpecDialog({ title, description, view, busy, back, onDismiss, children }: Props) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const content = useRef<HTMLDivElement>(null);
  // Capture before the opening render disables the trigger button.
  const restoreFocus = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    const node = dialog.current!;
    const trigger = restoreFocus.current;
    const overflow = document.body.style.overflow;
    node.showModal();
    document.body.style.overflow = "hidden";
    heading.current?.focus({ preventScroll: true });
    return () => {
      node.close();
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) {
        const target = trigger.matches(":disabled")
          ? trigger.closest(".spec-manager")?.querySelector<HTMLElement>('[role="alert"] button')
          : trigger;
        target?.focus({ preventScroll: true });
      }
    };
  }, []);
  useLayoutEffect(() => {
    content.current?.scrollTo?.({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [view]);
  return <dialog ref={dialog} className="spec-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    onCancel={event => { event.preventDefault(); if (!busy) onDismiss(); }}>
    <header className="spec-dialog-heading">
      <div><h2 ref={heading} tabIndex={-1} id={`${id}-title`}>{title}</h2><p id={`${id}-description`}>{description}</p></div>
      <button type="button" className="spec-dialog-close" disabled={busy} onClick={onDismiss} aria-label={back ? "이력서 검토로 돌아가기" : "스펙 창 닫기"}>
        {back ? <><span aria-hidden="true">←</span><span className="spec-dialog-back-label">검토로 돌아가기</span></> : <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>}
      </button>
    </header>
    <div ref={content} className="spec-dialog-content" data-view={view}>{children}</div>
  </dialog>;
}
