"use client";

import { useRef, useEffect, useState } from "react";
import MessageBubble from "./MessageBubble";
import TypingBubble from "./TypingBubble";
import { getUnifiedBalance, transferFunds } from "lib/avail";
import { useAccount } from "wagmi";
import { isAddress } from "viem";

type Message = { id: string; role: "user" | "assistant"; content: string; timestamp?: string };

type ChatWindowProps = {
  initialMessages?: Message[];
};

export default function ChatWindow({ initialMessages = [] }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isTyping, setIsTyping] = useState(false);
  const { address, isConnected } = useAccount();
  const nowTs = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const addMessage = (role: Message["role"], content: string) => {
    const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role, content, timestamp: ts }]);
  };

  // Listen for send events and drive the end-to-end flow
  useEffect(() => {
    const handler = async (e: Event) => {
      const custom = e as CustomEvent<{ text: string }>;
      const text = custom.detail?.text ?? "";
      if (!text) return;
      addMessage("user", text);
      try {
        setIsTyping(true);
        const chatBody = { messages: [...messages, { role: "user", content: text }] };
        const [chatRes, intentRes] = await Promise.all([
          fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(chatBody),
          }).catch(() => null),
          fetch("/api/intent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          }).catch(() => null),
        ]);

        // Handle chat reply (MCP-backed)
        if (chatRes && chatRes.ok) {
          const data = await chatRes.json();
          const reply = data?.reply || "";
          if (reply) addMessage("assistant", reply);
        }

        // Handle parsed intent for action
        if (!intentRes || !intentRes.ok) return;
        const { intent } = await intentRes.json();
        console.log("[flow] intent parsed", intent);
        if (intent?.action !== "transfer") return;
        if (!isConnected || !address) {
          addMessage("assistant", "Please connect your wallet to continue.");
          return;
        }

        // Resolve ENS (placeholder): require 0x address for now
        if (!isAddress(intent.recipient as `0x${string}`)) {
          addMessage("assistant", "ENS resolution not configured yet. Please provide a 0x address.");
          return;
        }
        const toAddress = intent.recipient as `0x${string}`;

        // Unified balance check (placeholder logic)
        const ub = await getUnifiedBalance(address);
        console.log("[flow] unified balance", ub);

        // Execute transfer via Avail SDK
        const result = await transferFunds({
          chain: intent.chain as any,
          token: intent.token,
          amount: intent.amount,
          toAddress,
          fromAddress: address,
        });
        const txHash = (result as any)?.transactionHash || (result as any)?.txHash || "";
        if (txHash) {
          addMessage("assistant", `Transfer submitted. Tx: ${txHash}`);
        } else if ((result as any)?.success === false) {
          addMessage("assistant", `Transfer failed: ${(result as any)?.error || 'unknown error'}`);
        } else {
          addMessage("assistant", "Transfer submitted. Awaiting transaction hash...");
        }
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


