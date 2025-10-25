"use client";

import { http } from "viem";
import { createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import {
  sepolia,
  baseSepolia,
  arbitrumSepolia,
  optimismSepolia,
  polygonAmoy,
} from "wagmi/chains";
import { getDefaultConfig, RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";

// WalletConnect Cloud Project ID is required by RainbowKit
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";
if (!walletConnectProjectId) {
  // eslint-disable-next-line no-console
  console.warn("[wallet] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. Wallet connection may fail.")
}

export const supportedChains = [sepolia, baseSepolia, arbitrumSepolia, optimismSepolia, polygonAmoy] as const;

// Build a config that doesn't crash builds when projectId is missing.
export const wagmiConfig = walletConnectProjectId
  ? getDefaultConfig({
      appName: "DeFier",
      projectId: walletConnectProjectId,
      chains: supportedChains,
      transports: {
        [sepolia.id]: http(),
        [baseSepolia.id]: http(),
        [arbitrumSepolia.id]: http(),
        [optimismSepolia.id]: http(),
        [polygonAmoy.id]: http(),
      },
      ssr: true,
    })
  : createConfig({
      chains: supportedChains,
      connectors: [injected()],
      transports: {
        [sepolia.id]: http(),
        [baseSepolia.id]: http(),
        [arbitrumSepolia.id]: http(),
        [optimismSepolia.id]: http(),
        [polygonAmoy.id]: http(),
      },
      ssr: true,
    });

export function getRainbowTheme(isDark: boolean) {
  return isDark
    ? darkTheme({ borderRadius: "large", overlayBlur: "large" })
    : lightTheme({ borderRadius: "large", overlayBlur: "large" });
}

export { RainbowKitProvider };


