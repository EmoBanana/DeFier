"use client";

import ThemeToggle from "@/components/ThemeToggle";
import WalletButton from "@/components/WalletButton";
import ChatWindow from "@/components/ChatWindow";
import ChatInput from "@/components/ChatInput";
import { useRef } from "react";

export default function Home() {
  const messagesRef = useRef<{ push: (role: "user" | "assistant", text: string) => void } | null>(null);

  // Local state and handlers can live in ChatWindow; here we pipe input to it via callback.
  return (
    <div className="mx-auto flex min-h-[100svh] max-w-5xl flex-col px-4 py-5 sm:px-6">
      {/* Header */}
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="glass card-shadow flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ring-black/5 dark:ring-white/10">
            <span className="text-base font-semibold text-app-foreground">D</span>
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-app-foreground">DeFier</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <WalletButton />
        </div>
      </header>

      {/* Chat Body */}
      <main className="glass card-shadow flex-1 rounded-3xl ring-1 ring-black/5 dark:ring-white/10 flex flex-col overflow-hidden">
        <div className="flex-1">
          <ChatWindow />
        </div>
        <div className="border-t border-black/5 dark:border-white/10 p-3 sm:p-4">
          <ChatInput onSend={(text) => {
            // For now, we simply log; integrating AI can wire to ChatWindow state.
            const event = new CustomEvent("defier-send", { detail: { text } });
            window.dispatchEvent(event);
          }} />
        </div>
      </main>

      {/* Bottom-left floating toggle (optional alternate placement) */}
      <div className="fixed bottom-4 left-4 hidden sm:block">
        <ThemeToggle />
      </div>
    </div>
  );
}
