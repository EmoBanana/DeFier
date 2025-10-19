"use client";

import { Send } from "lucide-react";
import { useRef, useState } from "react";

type ChatInputProps = {
  onSend: (text: string) => void;
};

export default function ChatInput({ onSend }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const handleSend = () => {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
      textareaRef.current.style.overflowY = "hidden";
    }
  };

  return (
    <div className="glass card-shadow flex items-end gap-2 rounded-3xl p-2 ring-1 ring-black/5 dark:ring-white/10">
      <textarea
        ref={textareaRef}
        aria-label="Message"
        placeholder="Ask anything about chains, tokens, or transactions…"
        rows={1}
        className="flex-1 bg-transparent px-3 py-2 text-sm text-app-foreground placeholder:text-app-foreground/50 focus:outline-none resize-none max-h-40 overflow-y-auto"
        style={{ height: 40 }}
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          const ta = textareaRef.current;
          if (!ta) return;
          ta.style.height = "auto";
          const max = 160; // 40px * 4 rows
          const nextHeight = Math.min(ta.scrollHeight, max);
          ta.style.height = `${nextHeight}px`;
          ta.style.overflowY = ta.scrollHeight > max ? "auto" : "hidden";
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
      />
      <button
        onClick={handleSend}
        className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-tr from-accent to-accent-2 px-3 py-2 text-white text-sm font-medium shadow-[0_8px_20px_rgba(139,92,246,0.25)] hover:opacity-95 active:opacity-90"
      >
        <Send className="size-4" />
      </button>
    </div>
  );
}


