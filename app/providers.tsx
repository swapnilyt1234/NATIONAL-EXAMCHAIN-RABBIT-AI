"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { ReactNode, useMemo } from "react";
import { WagmiProvider } from "wagmi";
import { http } from "viem";
import { polygonAmoy, polygonMumbai } from "viem/chains";

type ProvidersProps = {
  children: ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  const queryClient = useMemo(() => new QueryClient(), []);
  const amoyRpcUrl = process.env.NEXT_PUBLIC_AMOY_RPC_URL;
  const mumbaiRpcUrl = process.env.NEXT_PUBLIC_MUMBAI_RPC_URL;

  const config = useMemo(
    () =>
      getDefaultConfig({
        appName: "EduAccess",
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "demo-project-id",
        chains: [polygonAmoy, polygonMumbai],
        transports: {
          [polygonAmoy.id]: http(amoyRpcUrl, { retryCount: 5, retryDelay: 1_000, timeout: 15_000 }),
          [polygonMumbai.id]: http(mumbaiRpcUrl, { retryCount: 5, retryDelay: 1_000, timeout: 15_000 }),
        },
        ssr: true,
      }),
    [amoyRpcUrl, mumbaiRpcUrl],
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
