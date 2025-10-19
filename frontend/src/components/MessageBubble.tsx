"use client";

import { motion } from "framer-motion";
import clsx from "clsx";

type MessageBubbleProps = {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
};

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderContentToHtml(raw: string): string {
  // Convert fenced code blocks ```...``` to <pre><code> (multi-line and single-line)
  let html = raw
    .replace(/(^|\s)```[\s]*\n?([\s\S]*?)\n?```(\s|$)/g, (_m, pre, code, post) => {
      const escaped = escapeHtml(String(code).trim());
      return `${pre}<pre class="chat-code"><code>${escaped}</code></pre>${post}`;
    })
    .replace(/(^|\s)```([^\n`][^`]*?)```(\s|$)/g, (_m, pre, code, post) => {
      const escaped = escapeHtml(String(code).trim());
      return `${pre}<pre class="chat-code"><code>${escaped}</code></pre>${post}`;
    });

  // Inline code `...` to <code>...</code>
  html = html.replace(/`([^`]+?)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`);

  // Bold **...** to <strong>...</strong>
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  return html;
}

export default function MessageBubble({ role, content, timestamp }: MessageBubbleProps) {
  const isUser = role === "user";
  const html = renderContentToHtml(content);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={clsx(
        "max-w-[80%] w-fit rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-sm bubble whitespace-pre-wrap break-words",
        isUser
          ? "ml-auto text-white bg-gradient-to-tr from-accent to-accent-2 rounded-br-none"
          : "mr-auto glass text-app-foreground/90 ring-1 ring-black/5 dark:ring-white/10 rounded-bl-none"
      )}
    >
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {timestamp ? (
        <span
          className={clsx(
            "mt-1 block text-[10px]",
            isUser ? "text-white/80 text-right" : "text-app-foreground/60 text-left"
          )}
        >
          {timestamp}
        </span>
      ) : null}
    </motion.div>
  );
}


