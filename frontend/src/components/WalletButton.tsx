"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useEffect, useMemo, useState } from "react";
import { getUnifiedBalance } from "lib/avail";

export default function WalletButton() {
  const { address, isConnected } = useAccount();
  const [assetCount, setAssetCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      if (!isConnected || !address) {
        setAssetCount(null);
        return;
      }
      try {
        const ub = await getUnifiedBalance(address);
        const count = Array.isArray((ub as any)?.assets) ? (ub as any).assets.length : null;
        setAssetCount(count);
      } catch (e) {
        console.warn("[wallet-ui] unified balance fetch failed", e);
        setAssetCount(null);
      }
    })();
  }, [address, isConnected]);

  const label = useMemo(() => {
    if (!isConnected) return "Connect";
    if (assetCount == null) return "Connected";
    return `Connected • ${assetCount} assets`;
  }, [isConnected, assetCount]);

  return <ConnectButton label={label} />;
}


