import type { Point } from "./landingGraphModel";

export interface FieldBounds { left: number; top: number; width: number; height: number }

/** A bounded attracting field measured against the element's resting bounds. */
export function attractionOffset(bounds: FieldBounds, pointer: Point | null, strength: number, radius = 200): Point {
  if (!pointer) return { x: 0, y: 0 };
  const dx = pointer.x - bounds.left - bounds.width / 2;
  const dy = pointer.y - bounds.top - bounds.height / 2;
  const edgeDistance = Math.hypot(Math.max(0, Math.abs(dx) - bounds.width / 2), Math.max(0, Math.abs(dy) - bounds.height / 2));
  if (edgeDistance >= radius) return { x: 0, y: 0 };
  const distance = Math.hypot(dx, dy);
  const force = strength * (1 - edgeDistance / radius) ** 2;
  return distance > .01 ? { x: dx / distance * force, y: dy / distance * force } : { x: 0, y: 0 };
}

/** Local text deformation; nearby letters retain their order instead of piling up. */
export function characterAttraction(bounds: FieldBounds, pointer: Point | null, strength: number, radius: number): Point {
  if (!pointer) return { x: 0, y: 0 };
  const dx = pointer.x - bounds.left - bounds.width / 2, dy = pointer.y - bounds.top - bounds.height / 2;
  const distance = Math.hypot(dx, dy);
  if (distance < .01 || distance >= radius) return { x: 0, y: 0 };
  const pull = Math.min(.4, strength / distance) * (1 - (distance / radius) ** 2) ** 2;
  return { x: dx * pull, y: dy * pull };
}
