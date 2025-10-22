"use client";

import { useRef, useEffect, useState } from "react";
import MessageBubble from "./MessageBubble";
import TypingBubble from "./TypingBubble";
import { getUnifiedBalance, transferFunds, getExplorerUrl, bridgeAndExecute, normalizeTokenSymbol, toTestnetChainId, bridgeFunds } from "lib/avail";
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
        // Call MCP-backed chat (includes Q&A and intent embedded when applicable)
        const chatRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [...messages, { role: "user", content: text }] }),
        });
        if (!chatRes.ok) throw new Error("Chat API error");
        const data = await chatRes.json();
        const reply = data?.reply || "";
        if (reply) addMessage("assistant", reply);
        const intent = data?.intent || null;
        console.log("[flow] intent parsed", intent);
        if (intent?.action !== "transfer" && intent?.action !== "bridge") return;
        const eth = (typeof window !== 'undefined' ? (window as any).ethereum : null);
        const fromAddr = address || (eth?.selectedAddress as `0x${string}` | undefined);
        if (!eth || !fromAddr) {
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
        const ub = await getUnifiedBalance(fromAddr);
        console.log("[flow] unified balance", ub);

        // If intent is "bridge" only, run bridge path directly
        if (intent.action === "bridge") {
          const srcHint = ((intent as any)?.source as string | undefined) || undefined;
          let src = srcHint ? (srcHint.toLowerCase() === 'arb' ? 'arbitrum' : srcHint.toLowerCase() === 'op' ? 'optimism' : srcHint.toLowerCase()) : undefined;
          if (!src) {
            // infer a source with balance
            try {
              const ub = await getUnifiedBalance(fromAddr);
              const asset = (ub as any)?.assets?.find((a: any) => String(a?.symbol || '').toUpperCase() === normalizeTokenSymbol(intent.token as string));
              if (asset && Array.isArray(asset.breakdown) && asset.breakdown.length > 0) {
                src = (asset.breakdown[0]?.chain?.name || '').toLowerCase();
              }
            } catch {}
          }
          if (!src) {
            addMessage("assistant", "Could not determine source chain for bridge.");
            return;
          }
          console.log("[flow] explicit bridge()", { from: src, to: intent.chain, token: intent.token, amount: intent.amount });
          const br = await bridgeFunds({
            fromChain: src,
            toChain: intent.chain as string,
            token: intent.token as string,
            amount: intent.amount as string,
            toAddress,
          });
          const bHash = (br as any)?.bridgeTransactionHash || (br as any)?.transactionHash || "";
          addMessage("assistant", bHash ? `Bridge submitted. [View on explorer](${getExplorerUrl(src, bHash)})` : ((br as any)?.success === false ? `Bridge failed: ${(br as any)?.error || 'unknown error'}` : "Bridge submitted. Awaiting transaction hash..."));
          return;
        }

        // Decide: if sufficient balance on destination chain, direct transfer; otherwise bridge+execute
        const desiredToken = normalizeTokenSymbol(intent.token as string);
        const destChainId = toTestnetChainId(intent.chain as string);
        const requestedAmt = Number(intent.amount || '0');
        const srcHint = ((intent as any)?.source as string | undefined) || undefined;
        const normalizedSrc = srcHint ? (srcHint.toLowerCase() === 'arb' ? 'arbitrum' : srcHint.toLowerCase() === 'op' ? 'optimism' : srcHint.toLowerCase()) : undefined;
        let hasSufficientOnDest = false;
        try {
          const ub2 = await getUnifiedBalance(fromAddr);
          const asset = (ub2 as any)?.assets?.find((a: any) => String(a?.symbol || '').toUpperCase() === desiredToken);
          if (asset) {
            const onDest = (asset.breakdown || []).find((b: any) => Number(b?.chain?.id) === Number(destChainId));
            // Sum all entries on destination chain to be safe
            const destEntries = (asset.breakdown || []).filter((b: any) => Number(b?.chain?.id) === Number(destChainId));
            const destBal = destEntries.reduce((sum: number, b: any) => sum + Number(b?.balance ?? '0'), 0);
            hasSufficientOnDest = destBal >= requestedAmt;
          }
        } catch {}

        // Prefer direct transfer if user explicitly said "from" == destination
        const preferDirect = normalizedSrc && (toTestnetChainId(normalizedSrc) === destChainId);

        if (hasSufficientOnDest || preferDirect) {
          console.log("[flow] sufficient balance on destination → direct transfer", { destChainId, desiredToken });
          try { await (window as any).ethereum?.request?.({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x' + Number(destChainId).toString(16) }] }); } catch {}
          const direct = await transferFunds({
            chain: intent.chain as any,
            token: intent.token,
            amount: intent.amount,
            toAddress,
            fromAddress: fromAddr,
          });
          const directHash = (direct as any)?.transactionHash || (direct as any)?.txHash || '';
          addMessage("assistant", directHash ? `Transfer submitted. [View on explorer](${getExplorerUrl(intent.chain as string, directHash)})` : ((direct as any)?.success === false ? `Transfer failed: ${(direct as any)?.error || 'unknown error'}` : "Transfer submitted. Awaiting transaction hash..."));
          return;
        }

        // Execute via Avail: bridge+execute
        console.log("[flow] executing via Avail bridgeAndExecute", intent);
        const beResult = await bridgeAndExecute({
          token: intent.token,
          amount: intent.amount,
          toChain: intent.chain,
          recipient: toAddress,
          source: (intent as any)?.source,
        });
        // Stop if bridge step failed; don't fall back to wrong-chain direct transfer
        if ((beResult as any)?.success === false) {
          // Try explicit bridge() as a fallback when BE is not applicable
          console.log("[flow] bridgeAndExecute failed, trying explicit bridge()", beResult);
          if (normalizedSrc && normalizedSrc !== intent.chain) {
            try {
              const br = await bridgeFunds({
                fromChain: normalizedSrc,
                toChain: intent.chain as string,
                token: intent.token as string,
                amount: intent.amount as string,
                toAddress,
              });
              const bHash = (br as any)?.bridgeTransactionHash || (br as any)?.transactionHash || "";
              if (bHash) {
                const url = getExplorerUrl(normalizedSrc, bHash);
                addMessage("assistant", url ? `Bridge submitted. [View on explorer](${url})` : `Bridge submitted. Tx: ${bHash}`);
                return;
              }
            } catch (e) {
              console.warn("[flow] explicit bridge() failed", e);
            }
          }
          addMessage("assistant", `Bridge failed: ${(beResult as any)?.error || 'not supported for this token/route on testnet.'}`);
          return;
        }
        const txHashBE = (beResult as any)?.executeTransactionHash || (beResult as any)?.bridgeTransactionHash || (beResult as any)?.transactionHash || (beResult as any)?.txHash || "";
        if (txHashBE) {
          const url = getExplorerUrl(intent.chain as string, txHashBE);
          addMessage("assistant", url ? `Transfer submitted. [View on explorer](${url})` : `Transfer submitted. Tx: ${txHashBE}`);
          return;
        }

        // Fallback to direct transfer only if no source chain was specified
        console.log("[flow] beResult had no tx hash, evaluating fallback", beResult);
        if ((intent as any)?.source) {
          addMessage("assistant", "No transaction hash returned. Please try a supported token/route or smaller amount.");
          return;
        }
        const result = await transferFunds({
          chain: intent.chain as any,
          token: intent.token,
          amount: intent.amount,
          toAddress,
          fromAddress: fromAddr,
        });
        const txHash = (result as any)?.transactionHash || (result as any)?.txHash || "";
        addMessage("assistant", txHash ? `Transfer submitted. [View on explorer](${getExplorerUrl(intent.chain as string, txHash)})` : ((result as any)?.success === false ? `Transfer failed: ${(result as any)?.error || 'unknown error'}` : "Transfer submitted. Awaiting transaction hash..."));
      } catch (err) {
        addMessage("assistant", "Sorry, there was an error reaching the model.");
      } finally {
        setIsTyping(false);
      }
    };
    window.addEventListener("defier-send", handler as EventListener);
    return () => window.removeEventListener("defier-send", handler as EventListener);
  }, [messages, isConnected, address]);

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


