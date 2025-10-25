"use client";

import React from "react";
import { getExplorerUrl, toTestnetChainId, normalizeTokenSymbol } from "lib/avail";
import { useTransactionPopup } from "@blockscout/app-sdk";
import { BridgeButton, TESTNET_CHAINS } from "@avail-project/nexus-widgets";

type TxInlineTxProps = {
  type: "tx";
  chain: string;
  chainId: number | string;
  txHash: string;
  address?: `0x${string}`;
};

type TxInlineBridgeProps = {
  type: "bridge";
  token: string;
  amount: string | number;
  toChain: string | number;
  fromChain?: string | number;
};

type TxInlineProps = TxInlineTxProps | TxInlineBridgeProps;

export default function TxInline(props: TxInlineProps) {
  const { openPopup } = useTransactionPopup();
  const [status, setStatus] = React.useState<"pending" | "success" | "error">("pending");
  const [label, setLabel] = React.useState<string>("Transaction submitted...");
  const [showDetails, setShowDetails] = React.useState(false);
  const [details, setDetails] = React.useState<string>("");
  const [loadingDetails, setLoadingDetails] = React.useState(false);
  const [detailsError, setDetailsError] = React.useState<string>("");
  const [bridgeDone, setBridgeDone] = React.useState(false);
  

  // Bridge widget branch
  if (props.type === "bridge") {
    const token = normalizeTokenSymbol(props.token);
    const destChainId = typeof props.toChain === 'number' ? props.toChain : toTestnetChainId(String(props.toChain));
    const srcChainId = props.fromChain !== undefined
      ? (typeof props.fromChain === 'number' ? props.fromChain : toTestnetChainId(String(props.fromChain)))
      : undefined;
    const amountNum = typeof props.amount === 'number' ? props.amount : Number(props.amount || 0);
    const destSupported = (TESTNET_CHAINS as readonly number[]).includes(Number(destChainId));
    const srcSupported = srcChainId === undefined || (TESTNET_CHAINS as readonly number[]).includes(Number(srcChainId));
    const tokenSupported = token === 'USDC' || token === 'USDT';
    return (
      <div className="rounded-2xl bg-white/2.5 dark:bg-white/5 ring-1 ring-black/5 dark:ring-white/10 p-3 text-sm">
        <div className="mb-2 font-medium text-app-foreground/90">Bridge preview</div>
        <div className="text-app-foreground/80 mb-2">{amountNum} {token} → Chain {destChainId}</div>
        {destSupported && srcSupported && tokenSupported ? (
          <BridgeButton
            prefill={{ chainId: destChainId as any, token, amount: amountNum }}
            className="inline-block"
          >
            {({ onClick, isLoading }) => (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await onClick();
                    setBridgeDone(true);
                  } catch {
                    // ignore; widget handles errors internally
                  }
                }}
                disabled={isLoading || bridgeDone}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 text-white disabled:opacity-60"
              >
                {isLoading ? 'Bridging…' : bridgeDone ? 'Bridge successful' : 'Bridge now'}
              </button>
            )}
          </BridgeButton>
        ) : (
          <div className="text-amber-600 dark:text-amber-400 space-y-1">
            {!destSupported && (
              <div>
                Destination chain {String(destChainId)} isn’t supported by the widget testnet universe.
                Try Base Sepolia (84532), Arbitrum Sepolia (421614), Optimism Sepolia (11155420), or Polygon Amoy (80002).
              </div>
            )}
            {srcChainId !== undefined && !srcSupported && (
              <div>
                Source chain {String(srcChainId)} isn’t supported by the widget testnet universe.
              </div>
            )}
            {!tokenSupported && (
              <div>
                Token {token} isn’t supported for testnet bridging in the widget. Use USDC or USDT.
              </div>
            )}
          </div>
        )}
        
      </div>
    );
  }

  React.useEffect(() => {
    let mounted = true;
    let tries = 0;
    const maxTries = 60; // ~4 minutes at 4s interval

    async function checkReceipt() {
      try {
        const eth = (typeof window !== "undefined" ? (window as any).ethereum : null);
        if (!eth) return;
        const hash = (props as TxInlineTxProps).txHash;
        const receipt = await eth.request({ method: "eth_getTransactionReceipt", params: [hash] });
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
  }, [props.type === 'tx' ? props.txHash : undefined]);

  async function loadDetails() {
    if (details || loadingDetails) {
      setShowDetails((v) => !v);
      return;
    }
    setLoadingDetails(true);
    setDetailsError("");
    try {
      // Best-effort fetch from Blockscout API; gracefully degrade on CORS
      const chainLower = props.type === 'tx' ? props.chain.toLowerCase() : '';
      let base: string;

      if (chainLower.includes("arb")) {
        base = "https://arbitrum-sepolia.blockscout.com/tx";
      } else if (chainLower.includes("sepolia")) {
        base = "https://eth-sepolia.blockscout.com/api/v2/transactions";
      } else {
        base = "https://eth.blockscout.com/api/v2/transactions";
      }
      const hash = (props as TxInlineTxProps).txHash;
      const res = await fetch(`${base}/${hash}`);
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
      <div className="text-app-foreground/70 break-all">{(props as TxInlineTxProps).txHash}</div>
      <div className="mt-2 flex items-center gap-2">
        <a
          href={getExplorerUrl((props as TxInlineTxProps).chain, (props as TxInlineTxProps).txHash) || `https://eth-sepolia.blockscout.com/tx/${(props as TxInlineTxProps).txHash}`}
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
          onClick={() => openPopup({ chainId: String(props.chainId), address: props.address })}
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


