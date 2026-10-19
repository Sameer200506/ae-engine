"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders assistant output as Markdown.
 *
 * react-markdown does not emit raw HTML unless rehype-raw is added, so model
 * output cannot inject script tags here — that is the safe default and why
 * rehype-raw is deliberately absent.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: kids }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {kids}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
