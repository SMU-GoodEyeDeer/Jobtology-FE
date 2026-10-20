/** Use canonical identities or validated NCS base codes, never translated labels. */
function skillHref(page: "roadmap" | "analysis", requirementKey?: string | null, ncsBaseCode?: string | null): string {
  const query = new URLSearchParams();
  if (requirementKey) query.set("requirement", requirementKey);
  else if (ncsBaseCode && /^[0-9]{10}$/.test(ncsBaseCode)) query.set("ncs", ncsBaseCode);
  return `/${page}${query.size ? `?${query}` : ""}`;
}
export const roadmapSkillHref = (requirementKey?: string | null, ncsBaseCode?: string | null) => skillHref("roadmap", requirementKey, ncsBaseCode);
export const analysisSkillHref = (requirementKey?: string | null, ncsBaseCode?: string | null) => skillHref("analysis", requirementKey, ncsBaseCode);
