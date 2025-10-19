"use client";

import { Wallet } from "lucide-react";

export default function WalletButton() {
  return (
    <button
      className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium text-white bg-gradient-to-tr from-accent to-accent-2 shadow-[0_8px_20px_rgba(99,102,241,0.25)] hover:opacity-95 active:opacity-90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[--ring]"
    >
      <Wallet className="size-4" />
      Connect Wallet
    </button>
  );
}


