import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { WeeklyPlanInput } from "../../services/types";
import { moveStep } from "../../services/weeklyPlan";

export function usePlanDrag(draft: WeeklyPlanInput | null, busy: boolean, onChange: (input: WeeklyPlanInput) => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const active = useRef<{ id: string; snapshot: WeeklyPlanInput } | null>(null);
  const input = useRef(draft);
  input.current = draft;
  const [dragging, setDragging] = useState<{ id: string; name: string; x: number; y: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!dragging) return;
    const cursor = document.body.style.cursor;
    const selection = document.body.style.userSelect;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    return () => { document.body.style.cursor = cursor; document.body.style.userSelect = selection; };
  }, [dragging?.id]);

  function finish(cancel = false) {
    if (cancel && active.current) onChange(active.current.snapshot);
    active.current = null;
    setDragging(null);
  }

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
      onChange({ ...current, order });
      setAnnouncement(`${order.indexOf(id) + 1}번째 위치`);
    }
    const scroller = container.closest(".main-content");
    if (scroller) {
      const rect = scroller.getBoundingClientRect();
      if (y > rect.bottom - 48) scroller.scrollBy(0, 18);
      else if (y < rect.top + 48) scroller.scrollBy(0, -18);
    }
  }

  function handleProps(id: string, name: string) {
    return {
      "aria-label": `${name} 순서 조절`, "aria-describedby": "wp-drag-help", "aria-pressed": dragging?.id === id,
      onPointerDown(event: PointerEvent<HTMLButtonElement>) {
        if (!draft || busy || event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        active.current = { id, snapshot: draft };
        setDragging({ id, name, x: event.clientX, y: event.clientY });
      },
      onPointerMove(event: PointerEvent<HTMLButtonElement>) {
        if (!active.current) return;
        setDragging(previous => previous && ({ ...previous, x: event.clientX, y: event.clientY }));
        preview(event.clientY);
      },
      onPointerUp() { finish(); },
      onPointerCancel() { finish(true); },
      onLostPointerCapture() { finish(); },
      onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        if (event.key === "Escape" && active.current) { event.preventDefault(); finish(true); return; }
        if (!draft || busy || !["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const index = draft.order.indexOf(id);
        const to = event.key === "Home" ? 0 : event.key === "End" ? draft.order.length - 1 : index + (event.key === "ArrowDown" ? 1 : -1);
        const target = draft.order[to];
        if (target) { onChange(moveStep(draft, id, target)); setAnnouncement(`${name}, ${to + 1}번째 위치`); }
      },
    };
  }

  return { containerRef, dragging, announcement, handleProps };
}
