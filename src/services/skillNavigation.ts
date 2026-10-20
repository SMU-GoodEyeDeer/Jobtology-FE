/** Use canonical identities or validated NCS base codes, never translated labels. */
function skillHref(page: "roadmap" | "analysis", requirementKey?: string | null, ncsBaseCode?: string | null): string {
  const query = new URLSearchParams();
  if (requirementKey) query.set("requirement", requirementKey);
  else if (ncsBaseCode && /^[0-9]{10}$/.test(ncsBaseCode)) query.set("ncs", ncsBaseCode);
  return `/${page}${query.size ? `?${query}` : ""}`;
}
export function roadmapSkillHref(requirementKey?: string | null, ncsBaseCode?: string | null, stepId?: string | null): string {
  const href = skillHref("roadmap", requirementKey, ncsBaseCode);
  return stepId ? `${href}${href.includes("?") ? "&" : "?"}${new URLSearchParams({ step: stepId })}` : href;
}
export const analysisSkillHref = (requirementKey?: string | null, ncsBaseCode?: string | null) => skillHref("analysis", requirementKey, ncsBaseCode);
