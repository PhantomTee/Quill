"use client";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { arcTestnet } from "viem/chains";
import { useState } from "react";

const config = createConfig({
  chains: [arcTestnet],
  connectors: [
    injected(),
    injected({
      target() {
        if (typeof window === "undefined") return undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const provider = (window as any).okxwallet;
        if (!provider) return undefined;
        return { id: "okxwallet", name: "OKX Wallet", provider };
      },
    }),
  ],
  transports: { [arcTestnet.id]: http("https://rpc.testnet.arc.network") },
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
