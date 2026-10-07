import { motion } from "motion/react";
import type { Transition } from "motion/react";
import type { ReactNode } from "react";
import type { ProgressStep } from "./progress";

// Shared motion vocabulary for the onboarding chat. Durations stay in the
// Linear/Vercel range (150–250ms, ease-out); springs drive layout morphs.
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const SPRING: Transition = { type: "spring", stiffness: 260, damping: 30 };

export function enterDuration(reduceMotion: boolean, seconds = 0.22): number {
  return reduceMotion ? 0 : seconds;
}

export function enterDelay(reduceMotion: boolean, seconds: number): number {
  return reduceMotion ? 0 : seconds;
}

interface ChipProps {
  className: string;
  children: ReactNode;
  onClick: () => void;
  delay?: number;
  reduceMotion?: boolean;
  disabled?: boolean;
  ariaPressed?: boolean;
}

/// A quick-reply chip that fades + slides up, staggered by `delay`.
/// Text is always rendered (SSR/static markup safe); only the entrance animates.
export function Chip({ className, children, onClick, delay = 0, reduceMotion = false, disabled, ariaPressed }: ChipProps) {
  return (
    <motion.button
      className={className}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={ariaPressed}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: enterDuration(reduceMotion), delay: enterDelay(reduceMotion, delay), ease: EASE_OUT }}
    >
      {children}
    </motion.button>
  );
}

/// Header progress trail: dots connected by a thin segmented bar, tiny labels.
export function ProgressTrail({ steps, current }: { steps: readonly ProgressStep[]; current: number }) {
  return (
    <nav className="ob-progress" aria-label="온보딩 진행 단계">
      <ol>
        {steps.map((s, i) => (
          <li
            key={s.step}
            className={
              i < current ? "ob-step ob-step--done" : i === current ? "ob-step ob-step--current" : "ob-step"
            }
            aria-current={i === current ? "step" : undefined}
          >
            <span className="ob-step-dot" />
            <span className="ob-progress-label">{s.label}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
