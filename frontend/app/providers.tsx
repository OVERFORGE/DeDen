// app/providers.tsx
"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { arbitrum, bsc, base } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import React from "react";
import { SessionProvider } from "next-auth/react";
import type { Chain } from "wagmi/chains";

// ✅ Define Mantle Sepolia chain
const mantleSepolia: Chain = {
  id: 5003,
  name: 'Mantle Sepolia',
  nativeCurrency: {
    name: 'MNT',
    symbol: 'MNT',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.sepolia.mantle.xyz'],
    },
    public: {
      http: ['https://rpc.sepolia.mantle.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Mantle Sepolia Explorer',
      url: 'https://explorer.sepolia.mantle.xyz',
    },
  },
  testnet: true,
};

// Get environment variables
const arbitrumKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_ARBITRUM;
const bnbKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_BNB;
const baseKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_BASE;
const mantleSepoliaKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_MANTLE_TESTNET;
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

  // Get the app URL from environment or use defaults
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  
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

        // ✅ Configure all supported chains INCLUDING Mantle Sepolia
        chains: [arbitrum, bsc, base, mantleSepolia],

        // ✅ RPC transports including Mantle Sepolia
        transports: {
          [arbitrum.id]: http(
            `https://arb-mainnet.g.alchemy.com/v2/${arbitrumKey}`
          ),
          [bsc.id]: http(
            `https://bnb-mainnet.g.alchemy.com/v2/${bnbKey}`
          ),
          [base.id]: http(
            `https://base-mainnet.g.alchemy.com/v2/${baseKey}`
          ),
          // ✅ Add Mantle Sepolia transport
          [mantleSepolia.id]: http(
            mantleSepoliaKey 
              ? `https://mantle-sepolia.g.alchemy.com/v2/${mantleSepoliaKey}`
              : 'https://rpc.sepolia.mantle.xyz' // Fallback to public RPC
          ),
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
              enforceSupportedChains: true,
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