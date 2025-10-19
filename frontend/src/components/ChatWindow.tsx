"use client";

import { useRef, useEffect, useState } from "react";
import MessageBubble from "./MessageBubble";

type Message = { id: string; role: "user" | "assistant"; content: string; timestamp?: string };

type ChatWindowProps = {
  initialMessages?: Message[];
};

export default function ChatWindow({ initialMessages = [] }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const addMessage = (role: Message["role"], content: string) => {
    const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role, content, timestamp: ts }]);
  };

  // Listen for simple send events to keep this component decoupled from the input
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ text: string }>;
      const text = custom.detail?.text ?? "";
      if (!text) return;
      addMessage("user", text);
      // Mock assistant response for UI demo
      const reply = `Analyzing: ${text}. This is a demo response.`;
      setTimeout(() => addMessage("assistant", reply), 450);
    };
    window.addEventListener("defier-send", handler as EventListener);
    return () => window.removeEventListener("defier-send", handler as EventListener);
  }, []);

  return (
    <div className="flex h-full w-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-xl text-center text-sm text-app-foreground/60">
            Ask DeFier about addresses, contracts, transactions, or market data.
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} role={m.role} content={m.content} timestamp={m.timestamp} />
          ))
        )}
      </div>
      {/* Expose imperative API via custom event for simplicity */}
      <div hidden id="chat-window-api" data-hook="custom">
        {/* Placeholder element to locate this component if needed */}
      </div>
    </div>
  );
}


