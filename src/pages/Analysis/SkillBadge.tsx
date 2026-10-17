import type { Skill } from "../../services/types";

export function SkillBadge({ type }: { readonly type: Skill["type"] }) {
  return <span className={`sd-badge sd-badge--${type === "필수" ? "required" : "preferred"}`}>{type}</span>;
}
