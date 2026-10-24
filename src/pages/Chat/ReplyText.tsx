import { memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const plugins = [remarkGfm];

export const ReplyText = memo(function ReplyText({ text, animate = false }: { text: string; animate?: boolean }) {
  return <div className={`reply-markdown${animate ? " reply-markdown--animate" : ""}`}>
    <Markdown remarkPlugins={plugins} skipHtml components={{
      a: ({ href, children }) => href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
      // Model text must not cause automatic requests to image/tracking URLs.
      img: ({ alt }) => <span className="reply-image-alt">{alt ? `[${alt}]` : "[이미지]"}</span>,
      table: ({ children }) => <div className="reply-table"><table>{children}</table></div>,
    }}>{text}</Markdown>
  </div>;
});
