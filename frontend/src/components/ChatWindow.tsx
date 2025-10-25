"use client";

import { useRef, useEffect, useState } from "react";
import MessageBubble from "./MessageBubble";
import TypingBubble from "./TypingBubble";
import { getUnifiedBalance, transferFunds, getExplorerUrl, bridgeAndExecute, normalizeTokenSymbol, toTestnetChainId, bridgeFunds } from "lib/avail";
import { executeSplit } from "../../lib/split";
import { useAccount } from "wagmi";
import { useNotification } from "@blockscout/app-sdk";
import { isAddress } from "viem";

type Message = { id: string; role: "user" | "assistant"; content: string; timestamp?: string };

type ChatWindowProps = {
  initialMessages?: Message[];
};

export default function ChatWindow({ initialMessages = [] }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isTyping, setIsTyping] = useState(false);
  const { address, isConnected } = useAccount();
  const { openTxToast } = useNotification(); // keep available but do not auto-open
  const nowTs = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const scrollRef = useRef<HTMLDivElement | null>(null);

  function resolveFixedName(nameLike: string): `0x${string}` | null {
    const n = String(nameLike || "").trim().toLowerCase();
    if (n === "wenn.eth") return "0x54609ff7660d8bF2F6c2c6078dae2E7f791610b4" as `0x${string}`;
    if (n === "weewee.eth") return "0x60CB041A232b7Ad0966E6Ec46728078461242803" as `0x${string}`;
    return null;
  }

  async function resolveEnsViaBlockscout(nameLike: string): Promise<`0x${string}` | null> {
    const name = String(nameLike || '').trim();
    if (!name || !name.includes('.')) return null;
    try {
      const res = await fetch('/api/ens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      if (!res.ok) return null;
      const json = await res.json();
      const m = String(json?.address || '').match(/0x[a-fA-F0-9]{40}/);
      return (m?.[0] as `0x${string}`) || null;
    } catch {
      return null;
    }
  }

  // Map human chain names to Blockscout SDK chain IDs (not always EVM chain IDs)
  function toBlockscoutChainId(chainLike: string | number): number {
    if (typeof chainLike === 'number') return chainLike;
    const c = String(chainLike).toLowerCase();
    if (c.includes('arbitrum')) return 1500; // Arbitrum Sepolia in Blockscout SDK
    if (c.includes('optimism') || c === 'op') return 11155420; // OP Sepolia
    if (c.includes('sepolia') || c.includes('ethereum') || c === 'eth') return 11155111; // Ethereum Sepolia
    if (c.includes('base')) return 84532; // Base Sepolia
    if (c.includes('polygon') || c.includes('amoy') || c.includes('matic')) return 80002; // Polygon Amoy
    return toTestnetChainId(c);
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollNow = () => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    // Defer until after DOM paints to capture new height
    const id = requestAnimationFrame(scrollNow);
    return () => cancelAnimationFrame(id);
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
        if (intent?.action !== "transfer" && intent?.action !== "bridge" && intent?.action !== "split") return;
        const eth = (typeof window !== 'undefined' ? (window as any).ethereum : null);
        const fromAddr = address || (eth?.selectedAddress as `0x${string}` | undefined);
        if (!eth || !fromAddr) {
          addMessage("assistant", "Please connect your wallet to continue.");
          return;
        }

        // Split intent path
        if (intent.action === "split") {
          const chain = String(intent.chain || "sepolia").toLowerCase();
          if (chain !== "sepolia") {
            addMessage("assistant", "Split is only wired for Sepolia in this demo.");
            return;
          }
          const token = String(intent.token || "PYUSD").toUpperCase();
          if (token !== "PYUSD") {
            addMessage("assistant", "This splitter is configured for PYUSD only.");
            return;
          }
          const recipientField = String(intent.recipient || "");
          let addrs = recipientField
            .replace(/\s*,\s*/g, ',')
            .replace(/\band\b/gi, ',')
            .split(/[ ,]+/)
            .filter(Boolean)
            .filter((t) => /^0x[a-fA-F0-9]{40}$/.test(t));
          if (addrs.length === 0) {
            const fromUser = (text.match(/0x[a-fA-F0-9]{40}/g) || []);
            if (fromUser.length > 0) addrs = fromUser;
          }
          if (addrs.length === 0) {
            addMessage("assistant", "Please provide at least one 0x address.");
            return;
          }
          if (!addrs.every((a) => isAddress(a as `0x${string}`))) {
            addMessage("assistant", "All recipients must be 0x addresses.");
            return;
          }
          const total = Number(intent.amount || "0");
          if (!isFinite(total) || total <= 0) {
            addMessage("assistant", "Amount must be greater than 0.");
            return;
          }
          // If phrasing is "split X between A and B" → equal parts
          const per = Number((total / addrs.length).toFixed(6));
          try { await (window as any).ethereum?.request?.({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] }); } catch {}
          try {
            const { txHash, explorerUrl } = await executeSplit({
              recipients: addrs as `0x${string}`[],
              amounts: Array(addrs.length).fill(per),
            });
            addMessage("assistant", explorerUrl ? `Split submitted. [View on Blockscout](${explorerUrl})` : `Split submitted. Tx: ${txHash}`);
            addMessage("assistant", `__tx__${JSON.stringify({ chain: "sepolia", chainId: 11155111, txHash, address: fromAddr })}`);
            // Do not auto-open overlay for PYUSD; inline bubble handles status
          } catch (e: any) {
            addMessage("assistant", `Split failed: ${e?.message || 'unknown error'}`);
          }
          return;
        }

        // Resolve recipient: fixed ENS mapping first, then 0x address
        const recipientRaw = String(intent.recipient || "");
        let toAddress: `0x${string}` | null = null;
        if (isAddress(recipientRaw as `0x${string}`)) {
          toAddress = recipientRaw as `0x${string}`;
        } else {
          const fixed = resolveFixedName(recipientRaw);
          toAddress = fixed || (await resolveEnsViaBlockscout(recipientRaw));
        }
        if (!toAddress) {
          addMessage("assistant", "Address resolution is limited for now.");
          return;
        }

        // If PYUSD on Sepolia and a simple send → use Split contract with single recipient
        if (
          intent.action === "transfer" &&
          String(intent.token || "").toUpperCase() === "PYUSD" &&
          String(intent.chain || "").toLowerCase() === "sepolia"
        ) {
          try { await (window as any).ethereum?.request?.({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] }); } catch {}
          try {
            const amt = Number(intent.amount || '0');
            const { txHash, explorerUrl } = await executeSplit({
              recipients: [toAddress],
              amounts: [amt],
            });
            addMessage("assistant", explorerUrl ? `Transfer submitted. [View on Blockscout](${explorerUrl})` : `Transfer submitted. Tx: ${txHash}`);
            addMessage("assistant", `__tx__${JSON.stringify({ chain: "sepolia", chainId: 11155111, txHash, address: fromAddr })}`);
            // Do not auto-open overlay for PYUSD; inline bubble handles status
          } catch (e: any) {
            addMessage("assistant", `Transfer failed: ${e?.message || 'unknown error'}`);
          }
          return;
        }

        // Unified balance check (placeholder logic)
        const ub = await getUnifiedBalance(fromAddr);
        console.log("[flow] unified balance", ub);

        // If intent is "bridge" only, run bridge path directly
        // --- Bridge intent handler ---
if (intent.action === "bridge") {
  // Prefer explicit source_chain / destination_chain fields
  const src =
    (intent.source_chain as string | undefined)?.toLowerCase() ||
    (intent.source as string | undefined)?.toLowerCase();
  const toChain =
    (intent.destination_chain as string | undefined)?.toLowerCase() ||
    (intent.chain as string | undefined)?.toLowerCase();

  if (!src) {
    addMessage("assistant", "Source chain not specified for bridge intent.");
    console.warn("[flow] Missing source chain in intent", intent);
    return;
  }

  if (!toChain) {
    addMessage("assistant", "Destination chain not specified for bridge intent.");
    console.warn("[flow] Missing destination chain in intent", intent);
    return;
  }

  const chainIdMap: Record<string, number> = {
    sepolia: 11155111,
    arb: 421614,
    arbitrum: 421614,
    "arbitrum sepolia": 421614,
    optimism: 11155420,
  };

  const fromChainId = chainIdMap[src] || toTestnetChainId(src);
  const toChainId = chainIdMap[toChain] || toTestnetChainId(toChain);

  console.log("[flow] explicit bridge()", {
    from: src,
    fromChainId,
    to: toChain,
    toChainId,
    token: intent.token,
    amount: intent.amount,
  });

  // Instead of executing immediately, show a bridge widget bubble
  addMessage("assistant", `__bridge__${JSON.stringify({ token: intent.token, amount: intent.amount, toChain: toChainId, fromChain: fromChainId })}`);
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
          if (!directHash) {
            addMessage("assistant", (direct as any)?.success === false ? `Transfer failed: ${(direct as any)?.error || 'unknown error'}` : "Transfer submitted. Awaiting transaction hash...");
          } else {
            const url = getExplorerUrl(intent.chain as string, directHash);
            addMessage("assistant", url ? `Transfer submitted. [View on explorer](${url})` : `Transfer submitted. Tx: ${directHash}`);
            addMessage("assistant", `__tx__${JSON.stringify({ chain: String(intent.chain), chainId: toBlockscoutChainId(String(intent.chain)), txHash: directHash, address: fromAddr })}`);
          // overlay popup disabled
          }
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
                fromChain: toTestnetChainId(normalizedSrc),
                toChain: toTestnetChainId(intent.chain as string),
                token: intent.token as string,
                amount: intent.amount as string,
                toAddress,
              });
              const bHash = (br as any)?.bridgeTransactionHash || (br as any)?.transactionHash || "";
              if (bHash) {
                const url = getExplorerUrl(normalizedSrc, bHash);
                addMessage("assistant", url ? `Bridge submitted. [View on explorer](${url})` : `Bridge submitted. Tx: ${bHash}`);
                addMessage("assistant", `__tx__${JSON.stringify({ chain: String(normalizedSrc), chainId: toBlockscoutChainId(String(normalizedSrc)), txHash: bHash, address: fromAddr })}`);
                // overlay popup disabled
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
          addMessage("assistant", `__tx__${JSON.stringify({ chain: String(intent.chain), chainId: toBlockscoutChainId(String(intent.chain)), txHash: txHashBE, address: fromAddr })}`);
          // overlay popup disabled
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
        if (!txHash) {
          addMessage("assistant", (result as any)?.success === false ? `Transfer failed: ${(result as any)?.error || 'unknown error'}` : "Transfer submitted. Awaiting transaction hash...");
        } else {
          const url = getExplorerUrl(intent.chain as string, txHash);
          addMessage("assistant", url ? `Transfer submitted. [View on explorer](${url})` : `Transfer submitted. Tx: ${txHash}`);
          addMessage("assistant", `__tx__${JSON.stringify({ chain: String(intent.chain), chainId: toBlockscoutChainId(String(intent.chain)), txHash, address: fromAddr })}`);
          // overlay popup disabled
        }
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
      <div ref={scrollRef} data-hook="chat-scroll" className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-3">
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


