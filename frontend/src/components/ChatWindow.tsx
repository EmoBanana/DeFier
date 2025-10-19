"use client";

import { useRef, useEffect, useState } from "react";
import MessageBubble from "./MessageBubble";
import TypingBubble from "./TypingBubble";

type Message = { id: string; role: "user" | "assistant"; content: string; timestamp?: string };

type ChatWindowProps = {
  initialMessages?: Message[];
};

export default function ChatWindow({ initialMessages = [] }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isTyping, setIsTyping] = useState(false);
  const nowTs = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const addMessage = (role: Message["role"], content: string) => {
    const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role, content, timestamp: ts }]);
  };

  // Listen for send events and call the backend Gemini API
  useEffect(() => {
    const handler = async (e: Event) => {
      const custom = e as CustomEvent<{ text: string }>;
      const text = custom.detail?.text ?? "";
      if (!text) return;
      addMessage("user", text);
      try {
        setIsTyping(true);
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [...messages, { role: "user", content: text }] }),
        });
        const data = await res.json();
        const reply = data?.reply || "";
        addMessage("assistant", reply || "(no response)");
      } catch (err) {
        addMessage("assistant", "Sorry, there was an error reaching the model.");
      } finally {
        setIsTyping(false);
      }
    };
    window.addEventListener("defier-send", handler as EventListener);
    return () => window.removeEventListener("defier-send", handler as EventListener);
  }, [messages]);

  return (
    <div className="flex h-full w-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-xl text-center text-sm text-app-foreground/60">
            Ask DeFier about addresses, contracts, transactions, or market data.
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <MessageBubble key={m.id} role={m.role} content={m.content} timestamp={m.timestamp} />
            ))}
            {isTyping && <TypingBubble timestamp={nowTs()} />}
          </>
        )}
      </div>
      {/* Expose imperative API via custom event for simplicity */}
      <div hidden id="chat-window-api" data-hook="custom">
        {/* Placeholder element to locate this component if needed */}
      </div>
    </div>
  );
}


