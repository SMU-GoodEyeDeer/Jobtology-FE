import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export function GoalDropdown({ open, children }: { open: boolean; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return <AnimatePresence initial={false}>
    {open && <motion.div id="goal-dropdown" className="goal-dropdown"
      initial={{ opacity: 0, y: -4, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: .98 }} style={{ transformOrigin: "top right" }}
      transition={{ duration: reduceMotion ? 0 : .14, ease: "easeOut" }}>
      {children}
    </motion.div>}
  </AnimatePresence>;
}
