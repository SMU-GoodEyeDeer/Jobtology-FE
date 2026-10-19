export function nodePopupPosition(node: { x: number; y: number; r: number }, bounds: { width: number; height: number }, popup: { width: number; height: number }) {
  const gap = node.r + 14;
  const side = node.x + gap + popup.width <= bounds.width - 8 ? "right"
    : node.x - gap - popup.width >= 8 ? "left"
    : node.y + gap + popup.height <= bounds.height - 8 ? "bottom" : "top";
  const clamp = (value: number, max: number) => Math.max(8, Math.min(Math.max(8, max), value));
  const x = clamp(side === "right" ? node.x + gap : side === "left" ? node.x - gap - popup.width : node.x - popup.width / 2, bounds.width - popup.width - 8);
  const y = clamp(side === "bottom" ? node.y + gap : side === "top" ? node.y - gap - popup.height : node.y - popup.height / 2, bounds.height - popup.height - 8);
  const arrow = side === "left" || side === "right"
    ? Math.max(18, Math.min(popup.height - 18, node.y - y)) : Math.max(18, Math.min(popup.width - 18, node.x - x));
  return { x, y, side, arrow };
}
