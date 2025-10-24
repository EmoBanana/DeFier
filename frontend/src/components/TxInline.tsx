"use client";

import React from "react";
import { getExplorerUrl } from "lib/avail";
import { useTransactionPopup } from "@blockscout/app-sdk";

type TxInlineProps = {
  chain: string;
  chainId: number | string;
  txHash: string;
  address?: `0x${string}`;
};

export default function TxInline({ chain, chainId, txHash, address }: TxInlineProps) {
  const { openPopup } = useTransactionPopup();
  const [status, setStatus] = React.useState<"pending" | "success" | "error">("pending");
  const [label, setLabel] = React.useState<string>("Transaction submitted...");
  const [showDetails, setShowDetails] = React.useState(false);
  const [details, setDetails] = React.useState<string>("");
  const [loadingDetails, setLoadingDetails] = React.useState(false);
  const [detailsError, setDetailsError] = React.useState<string>("");

  React.useEffect(() => {
    let mounted = true;
    let tries = 0;
    const maxTries = 60; // ~4 minutes at 4s interval

    async function checkReceipt() {
      try {
        const eth = (typeof window !== "undefined" ? (window as any).ethereum : null);
        if (!eth) return;
        const receipt = await eth.request({ method: "eth_getTransactionReceipt", params: [txHash] });
        if (!mounted) return;
        if (receipt && receipt.status) {
          if (receipt.status === "0x1") {
            setStatus("success");
            setLabel("Transaction is complete");
            return; // stop polling
          }
          if (receipt.status === "0x0") {
            setStatus("error");
            setLabel("Transaction failed");
            return; // stop polling
          }
        }
      } catch {
        // ignore errors; keep polling
      }
      tries += 1;
      if (tries < maxTries) {
        setTimeout(checkReceipt, 4000);
      }
    }

    checkReceipt();
    return () => {
      mounted = false;
    };
  }, [txHash]);

  async function loadDetails() {
    if (details || loadingDetails) {
      setShowDetails((v) => !v);
      return;
    }
    setLoadingDetails(true);
    setDetailsError("");
    try {
      // Best-effort fetch from Blockscout API; gracefully degrade on CORS
      const chainLower = chain.toLowerCase();
      let base: string;

      if (chainLower.includes("arb")) {
        base = "https://arbitrum-sepolia.blockscout.com/tx";
      } else if (chainLower.includes("sepolia")) {
        base = "https://eth-sepolia.blockscout.com/api/v2/transactions";
      } else {
        base = "https://eth.blockscout.com/api/v2/transactions";
      }
      const res = await fetch(`${base}/${txHash}`);
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      const to = json?.to?.hash || json?.to || "unknown";
      const from = json?.from?.hash || json?.from || "unknown";
      const method = json?.method || json?.decoded_input?.method || "transfer";
      const value = json?.value/10**18 || json?.value?.value/10**18 || json?.transaction_value/10**18 || "";
      const symbol = json?.value?.symbol || json?.token_transfers?.[0]?.token?.symbol || "ETH";
      const summary = `Action: ${method}\nFrom: ${from}\nTo: ${to}\nValue: ${value ? value + ' ' + symbol : 'n/a'}`;
      setDetails(summary);
      setShowDetails(true);
    } catch (e: any) {
      setDetailsError("Could not load interpretation. Please try View history.");
      setShowDetails(true);
    } finally {
      setLoadingDetails(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white/2.5 dark:bg-white/5 ring-1 ring-black/5 dark:ring-white/10 p-3 text-sm">
      <div className="flex items-center gap-2 font-medium mb-1 text-app-foreground/90">
        {status === "pending" && <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />}
        {status === "success" && <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />}
        {status === "error" && <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />}
        <span>{label}</span>
      </div>
      <div className="text-app-foreground/70 break-all">{txHash}</div>
      <div className="mt-2 flex items-center gap-2">
        <a
          href={getExplorerUrl(chain, txHash) || `https://eth-sepolia.blockscout.com/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600/10 text-blue-600 dark:text-blue-400 hover:underline"
        >
          View on explorer ↗
        </a>
        <button
          type="button"
          onClick={loadDetails}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-app-foreground/10 text-app-foreground/80 hover:bg-app-foreground/15"
        >
          {showDetails ? 'Hide details' : 'View details'}
        </button>
        <button
          type="button"
          onClick={() => openPopup({ chainId: String(chainId), address })}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-app-foreground/10 text-app-foreground/80 hover:bg-app-foreground/15"
        >
          View history
        </button>
      </div>
      {showDetails && (
        <pre className="mt-2 text-xs whitespace-pre-wrap text-app-foreground/80 bg-black/5 dark:bg-white/5 rounded-md p-2">
          {loadingDetails ? "Loading details..." : (details || detailsError || "No details available")}
        </pre>
      )}
    </div>
  );
}


