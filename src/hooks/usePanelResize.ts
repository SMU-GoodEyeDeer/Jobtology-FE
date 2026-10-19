import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

export function usePanelResize({ storageKey, initial, min, max, direction = 1 }: {
  storageKey: string; initial: number; min: number; max: number; direction?: 1 | -1;
}) {
  const [size, setSize] = useState(() => {
    const saved = Number(localStorage.getItem(storageKey));
    return Number.isFinite(saved) && saved > 0 ? Math.min(max, Math.max(min, saved)) : initial;
  });
  const [resizing, setResizing] = useState(false);
  const drag = useRef<{ x: number; size: number } | null>(null);
  const current = useRef(size);

  function update(value: number) {
    current.current = Math.round(Math.min(max, Math.max(min, value)));
    setSize(current.current);
  }
  function save() { localStorage.setItem(storageKey, String(current.current)); }
  function finish(event: PointerEvent<HTMLElement>) {
    if (!drag.current) return;
    drag.current = null;
    setResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    save();
  }

  return { size: Math.min(max, Math.max(min, size)), resizing, separatorProps: {
    role: "separator" as const, tabIndex: 0, "aria-orientation": "vertical" as const,
    "aria-valuemin": min, "aria-valuemax": max, "aria-valuenow": Math.min(max, Math.max(min, size)),
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.button !== 0) return;
      event.preventDefault();
      drag.current = { x: event.clientX, size: Math.min(max, Math.max(min, size)) };
      event.currentTarget.setPointerCapture(event.pointerId);
      setResizing(true);
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (drag.current) update(drag.current.size + (event.clientX - drag.current.x) * direction);
    },
    onPointerUp: finish, onPointerCancel: finish,
    onLostPointerCapture(event: PointerEvent<HTMLElement>) { finish(event); },
    onDoubleClick() { update(initial); save(); },
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      update(event.key === "Home" ? min : event.key === "End" ? max : current.current + (event.key === "ArrowRight" ? 16 : -16) * direction);
      save();
    },
  } };
}
