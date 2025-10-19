"use client";

import { motion } from "framer-motion";
import clsx from "clsx";

type MessageBubbleProps = {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
};

export default function MessageBubble({ role, content, timestamp }: MessageBubbleProps) {
  const isUser = role === "user";
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
      <p>{content}</p>
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


