import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { WeeklyPlanInput } from "../../services/types";
import { moveStep } from "../../services/weeklyPlan";

export function usePlanDrag(draft: WeeklyPlanInput | null, busy: boolean, onChange: (input: WeeklyPlanInput) => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const active = useRef<{ id: string; pointerId: number; snapshot: WeeklyPlanInput; trigger: HTMLButtonElement } | null>(null);
  const input = useRef(draft);
  const change = useRef(onChange);
  input.current = draft;
  change.current = onChange;
  const point = useRef({ x: 0, y: 0 });
  const frame = useRef<number | null>(null);
  const [dragging, setDragging] = useState<{ id: string; name: string } | null>(null);
  const [announcement, setAnnouncement] = useState("");

  function positionGhost() {
    if (ghostRef.current) ghostRef.current.style.transform = `translate3d(${Math.min(point.current.x + 16, window.innerWidth - 296)}px, ${Math.min(point.current.y + 12, window.innerHeight - 90)}px, 0)`;
  }
  useLayoutEffect(positionGhost, [dragging]);

  useEffect(() => {
    if (!dragging) return;
    const cursor = document.body.style.cursor;
    const selection = document.body.style.userSelect;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    const cancel = () => finish(true);
    window.addEventListener("blur", cancel);
    return () => {
      document.body.style.cursor = cursor;
      document.body.style.userSelect = selection;
      window.removeEventListener("blur", cancel);
    };
  }, [dragging?.id]);
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);

  function preview(y: number) {
    const current = input.current;
    const id = active.current?.id;
    const container = containerRef.current;
    if (!id || !current || !container) return;
    const rows = [...container.querySelectorAll<HTMLElement>("[data-plan-step]")].filter(row => row.dataset.planStep !== id);
    const top = container.getBoundingClientRect().top;
    const before = rows.find(row => y < top + row.offsetTop + row.offsetHeight / 2)?.dataset.planStep;
    const order = current.order.filter(stepId => stepId !== id);
    order.splice(before ? order.indexOf(before) : order.length, 0, id);
    if (order.some((stepId, index) => stepId !== current.order[index])) {
      const next = { ...current, order };
      input.current = next;
      change.current(next);
      setAnnouncement(`${order.indexOf(id) + 1}번째 위치`);
    }
  }

  function tick() {
    frame.current = null;
    if (!active.current) return;
    positionGhost();
    const scroller = containerRef.current?.closest(".main-content");
    let scrolling = false;
    if (scroller) {
      const rect = scroller.getBoundingClientRect();
      const previous = scroller.scrollTop;
      const y = point.current.y;
      if (y > rect.bottom - 56) scroller.scrollTop += Math.min(18, (y - rect.bottom + 56) / 3);
      else if (y < rect.top + 56) scroller.scrollTop -= Math.min(18, (rect.top + 56 - y) / 3);
      scrolling = previous !== scroller.scrollTop;
    }
    preview(point.current.y);
    if (scrolling) frame.current = requestAnimationFrame(tick);
  }

  function finish(cancel = false) {
    const drag = active.current;
    if (!drag) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (cancel) { input.current = drag.snapshot; change.current(drag.snapshot); }
    else preview(point.current.y);
    active.current = null;
    const container = containerRef.current;
    if (container?.hasPointerCapture(drag.pointerId)) container.releasePointerCapture(drag.pointerId);
    setDragging(null);
    requestAnimationFrame(() => { if (drag.trigger.isConnected) drag.trigger.focus({ preventScroll: true }); });
  }

  function handleProps(id: string, name: string) {
    return {
      "aria-label": `${name} 순서 조절`, "aria-describedby": "wp-drag-help", "aria-pressed": dragging?.id === id,
      onPointerDown(event: PointerEvent<HTMLButtonElement>) {
        if (!draft || busy || event.button !== 0 || !containerRef.current) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        active.current = { id, pointerId: event.pointerId, snapshot: draft, trigger: event.currentTarget };
        point.current = { x: event.clientX, y: event.clientY };
        // The parent stays in place when keyed rows move. Capturing the button
        // instead loses capture when React moves it downward in the DOM.
        containerRef.current.setPointerCapture(event.pointerId);
        setDragging({ id, name });
      },
      onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        if (event.key === "Escape" && active.current) { event.preventDefault(); finish(true); return; }
        if (!draft || busy || !["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const index = draft.order.indexOf(id);
        const to = event.key === "Home" ? 0 : event.key === "End" ? draft.order.length - 1 : index + (event.key === "ArrowDown" ? 1 : -1);
        const target = draft.order[to];
        if (target) { change.current(moveStep(draft, id, target)); setAnnouncement(`${name}, ${to + 1}번째 위치`); }
      },
    };
  }

  return { containerRef, ghostRef, dragging, announcement, handleProps, containerProps: {
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      if (!active.current || event.pointerId !== active.current.pointerId) return;
      point.current = { x: event.clientX, y: event.clientY };
      if (frame.current === null) frame.current = requestAnimationFrame(tick);
    },
    onPointerUp(event: PointerEvent<HTMLDivElement>) {
      if (event.pointerId !== active.current?.pointerId) return;
      point.current = { x: event.clientX, y: event.clientY };
      finish();
    },
    onPointerCancel() { finish(true); },
    onLostPointerCapture() { finish(true); },
  } };
}
