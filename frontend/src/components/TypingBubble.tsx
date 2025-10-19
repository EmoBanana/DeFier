"use client";

import { motion } from "framer-motion";

type TypingBubbleProps = { timestamp?: string };

export default function TypingBubble({ timestamp }: TypingBubbleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="mr-auto mt-1 max-w-[80%] w-fit glass text-app-foreground/80 ring-1 ring-black/5 dark:ring-white/10 rounded-3xl px-4 pt-4 pb-3 shadow-sm"
    >
      <div className="dots flex items-end gap-1 text-app-foreground/70">
        <span className="dot inline-block h-2 w-2 rounded-full bg-current" />
        <span className="dot inline-block h-2 w-2 rounded-full bg-current" />
        <span className="dot inline-block h-2 w-2 rounded-full bg-current" />
      </div>
      {timestamp ? (
        <span className="mt-1 block text-[10px] text-app-foreground/60">{timestamp}</span>
      ) : null}
    </motion.div>
  );
}


