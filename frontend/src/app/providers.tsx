"use client";

import { ThemeProvider, useTheme } from "next-themes";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { getRainbowTheme, wagmiConfig } from "lib/wallet";
import { NotificationProvider, TransactionPopupProvider } from "@blockscout/app-sdk";
import { NexusProvider, useNexus } from "@avail-project/nexus-widgets";
// Typed import may fail before dependency install; fall back to require at runtime
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Toaster } = require("sonner");
import "@rainbow-me/rainbowkit/styles.css";

type ProvidersProps = {
  children: React.ReactNode;
};

function RainbowBridge({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const theme = getRainbowTheme(isDark);
  const [queryClient] = React.useState(() => new QueryClient());

  function NexusInit({ children }: { children: React.ReactNode }) {
    const { initializeSdk } = useNexus();
    const triedRef = React.useRef(false);
    React.useEffect(() => {
      if (triedRef.current) return;
      const eth = (typeof window !== "undefined" ? (window as any).ethereum : undefined);
      if (eth) {
        triedRef.current = true;
        initializeSdk(eth).catch(() => { /* noop */ });
      }
    }, []);
    return <>{children}</>;
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme}>
          <NotificationProvider>
            <TransactionPopupProvider>
              <NexusProvider config={{ network: 'testnet', debug: false }}>
                <NexusInit>
                  {children}
                </NexusInit>
              </NexusProvider>
              <Toaster richColors position="top-right" />
            </TransactionPopupProvider>
          </NotificationProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <RainbowBridge>{children}</RainbowBridge>
    </ThemeProvider>
  );
}


