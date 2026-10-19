import type { CSSProperties } from "react";

export function ReplyText({ text, animate = false }: { text: string; animate?: boolean }) {
  let token = 0;
  const words = (value: string) => !animate ? value : (value.match(/\S+\s*|\s+/g) ?? []).map(word =>
    <span key={token} className="reply-token" style={{ "--token-delay": `${Math.min(token++, 120) * 12}ms` } as CSSProperties}>{word}</span>);
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => i % 2 === 1
    ? <strong key={i}>{words(part.slice(2, -2))}</strong> : <span key={i}>{words(part)}</span>)}</>;
}
