// app/providers.tsx
"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { arbitrum, bsc, base, mainnet } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import React from "react";
import { SessionProvider } from "next-auth/react";


// Get environment variables
const arbitrumKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_ARBITRUM;
const bnbKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_BNB;
const baseKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_BASE;
const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: 2,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  // Validation
  if (!arbitrumKey || !bnbKey || !baseKey) {
    console.error("Missing RPC API keys");
    return (
      <div style={{ padding: "20px", fontFamily: "Arial", color: "red" }}>
        <strong>Configuration Error:</strong> Missing RPC API keys. Please check
        your environment variables.
      </div>
    );
  }

  if (!wcProjectId) {
    console.error("Missing WalletConnect Project ID");
    return (
      <div style={{ padding: "20px", fontFamily: "Arial", color: "red" }}>
        <strong>Configuration Error:</strong> Missing WalletConnect Project ID.
        Get one from cloud.walletconnect.com
      </div>
    );
  }

  // In development use localhost so WalletConnect doesn't reject the origin.
  // In production use the exact URL registered in the WalletConnect dashboard.
  const appUrl = process.env.NODE_ENV === "production"
    ? "https://www.deden.space"
    : "http://localhost:3000";
  const appIcon = process.env.NEXT_PUBLIC_APP_ICON ||
    'https://res.cloudinary.com/dfa0ptxxk/image/upload/v1763107951/DenDen_no_bg_x6absy.png';

  // Create config only once
  const [config] = React.useState(() =>
    createConfig(
      getDefaultConfig({
        appName: "Decentralized Den",
        appDescription: "Secure crypto payments for coliving stays",
        appUrl: appUrl,
        appIcon: appIcon,

        chains: [arbitrum, bsc, base, mainnet],

        transports: {
          [arbitrum.id]: http(`https://arb-mainnet.g.alchemy.com/v2/${arbitrumKey}`),
          [bsc.id]:      http(`https://bnb-mainnet.g.alchemy.com/v2/${bnbKey}`),
          [base.id]:     http(`https://base-mainnet.g.alchemy.com/v2/${baseKey}`),
          [mainnet.id]:  http("https://eth.llamarpc.com"),
        },

        walletConnectProjectId: wcProjectId,
      })
    )
  );

  return (
    <SessionProvider refetchInterval={5 * 60}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <ConnectKitProvider
            mode="dark"
            options={{
              // OFF deliberately. When on, ConnectKit throws up its own dark
              // "Switch Networks" modal the moment a wallet connects on a
              // chain it doesn't recognise — on top of our payment modal, in
              // completely different chrome, asking the user to pick a network
              // they already chose in our own UI.
              //
              // It's also redundant: handlePay() calls switchChainAsync() with
              // the selected chain right before sending, so the wallet is put
              // on the correct network as part of paying.
              enforceSupportedChains: false,
              embedGoogleFonts: true,
            }}
          >
            {children}
          </ConnectKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </SessionProvider>
  );
}