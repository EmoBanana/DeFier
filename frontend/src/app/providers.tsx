"use client";

import { ThemeProvider, useTheme } from "next-themes";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { getRainbowTheme, wagmiConfig } from "lib/wallet";
import "@rainbow-me/rainbowkit/styles.css";

type ProvidersProps = {
  children: React.ReactNode;
};

function RainbowBridge({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const theme = getRainbowTheme(isDark);
  const [queryClient] = React.useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme}>{children}</RainbowKitProvider>
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


