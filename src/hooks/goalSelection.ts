// Memory-only selection shared by pages. An account change discards the old ID.
let current: { account: string | null; goal: string | null } = { account: null, goal: null };
const listeners = new Set<() => void>();
export const subscribeGoal = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const selectedGoal = (account: string | null) => current.account === account ? current.goal : null;
export function selectGoal(account: string | null, goal: string | null) {
  if (current.account === account && current.goal === goal) return;
  current = { account, goal }; listeners.forEach(listener => listener());
}
