import type { CSSProperties } from "react";

const PARTICLES = [
  { x: 6, y: 22, size: 8, bubble: false },
  { x: 17, y: 16, size: 30, bubble: true },
  { x: 31, y: 8, size: 5, bubble: false },
  { x: 79, y: 15, size: 17, bubble: true },
  { x: 92, y: 27, size: 38, bubble: true },
  { x: 89, y: 47, size: 7, bubble: false },
  { x: 7, y: 50, size: 23, bubble: true },
  { x: 23, y: 39, size: 6, bubble: false },
  { x: 75, y: 37, size: 10, bubble: false },
  { x: 4, y: 79, size: 11, bubble: false },
  { x: 22, y: 90, size: 21, bubble: true },
  { x: 51, y: 91, size: 6, bubble: false },
  { x: 78, y: 92, size: 34, bubble: true },
  { x: 96, y: 72, size: 14, bubble: true },
] as const;

export function LandingParticles() {
  return <div className="landing-particles" aria-hidden="true">
    {PARTICLES.map((particle, index) => <span key={index} className={`landing-particle${particle.bubble ? " landing-particle--bubble" : ""}`}
      data-mouse-field={particle.bubble ? 48 : 64} data-field-radius="240"
      style={{ left: `${particle.x}%`, top: `${particle.y}%`, width: particle.size, height: particle.size, "--particle-opacity": index % 3 === 0 ? .45 : .65 } as CSSProperties} />)}
  </div>;
}
