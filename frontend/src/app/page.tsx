"use client";

import ThemeToggle from "@/components/ThemeToggle";
import WalletButton from "@/components/WalletButton";
import ChatWindow from "@/components/ChatWindow";
import ChatInput from "@/components/ChatInput";
import { useRef } from "react";
import Image from "next/image";

export default function Home() {
  // Local state and handlers can live in ChatWindow; here we pipe input to it via callback.
  return (
    <div className="mx-auto flex min-h-[100svh] max-w-5xl flex-col px-4 py-5 sm:px-6">
      {/* Header */}
      <header className="mb-4 flex items-center justify-between sticky top-0 z-40 bg-app/80 backdrop-blur supports-[backdrop-filter]:bg-app/60 px-3 py-2">
        <div className="flex items-center gap-3">
          <Image src="/Logo.png" alt="DeFier" width={40} height={40} className="h-10 w-10 rounded-2xl" priority />
          <h1 className="text-lg font-semibold tracking-tight text-app-foreground">DeFier</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <WalletButton />
        </div>
      </header>

      {/* Chat Body */}
      <main className="glass card-shadow flex-1 rounded-3xl ring-1 ring-black/5 dark:ring-white/10 flex flex-col">
        <div className="flex-1">
          <ChatWindow />
        </div>
        <div className="border-t border-black/5 dark:border-white/10 p-3 sm:p-4 sticky bottom-0 z-40 bg-app/75 backdrop-blur supports-[backdrop-filter]:bg-app/55">
          <ChatInput onSend={(text) => {
            // For now, we simply log; integrating AI can wire to ChatWindow state.
            const event = new CustomEvent("defier-send", { detail: { text } });
            window.dispatchEvent(event);
            // Force scroll to bottom after send
            requestAnimationFrame(() => {
              const container = document.querySelector('[data-hook="chat-scroll"]') as HTMLDivElement | null;
              container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            });
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
