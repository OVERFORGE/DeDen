"use client"; // This must be a client component

import { WagmiProvider, createConfig, http } from "wagmi";
import { bscTestnet } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import React from "react";
import { SessionProvider } from "next-auth/react"; // <-- Import SessionProvider

// 1. Get your environment variables
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_BSC_TESTNET;
const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// 2. Set up a React Query client
const queryClient = new QueryClient();

// 3. Create the provider component
export function Providers({ children }: { children: React.ReactNode }) {
  
  // --- Your validation logic ---
  if (!alchemyApiKey) {
    console.error("Missing NEXT_PUBLIC_ALCHEMY_API_KEY_BSC_TESTNET env var");
    return (
      <html lang="en">
        <body>
          <div style={{ padding: '20px', fontFamily: 'Arial', color: 'red' }}>
            <strong>Build Error:</strong> Missing 
            <code>NEXT_PUBLIC_ALCHEMY_API_KEY_BSC_TESTNET</code> environment
            variable. Please check your .env.local file and restart the server.
          </div>
        </body>
      </html>
    );
  }

  if (!wcProjectId) {
    console.error("Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID env var");
    return (
      <html lang="en">
        <body>
          <div style={{ padding: '20px', fontFamily: 'Arial', color: 'red' }}>
            <strong>Build Error:</strong> Missing 
            <code>NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID</code> environment
            variable. Please get one from cloud.walletconnect.com and add it to .env.local.
          </div>
        </body>
      </html>
    );
  }
  // --- END OF VALIDATION ---


  // We use React.useState to create the config only once.
  const [config] = React.useState(() =>
    createConfig(
      getDefaultConfig({
        // Your dApp's name
        appName: "Payment Gateway",
        
        // Your transports config
        transports: {
          [bscTestnet.id]: http(
            `https://bnb-testnet.g.alchemy.com/v2/${alchemyApiKey}`
          ),
        },

        // We only support BSC Testnet
        chains: [bscTestnet],
        
        // WalletConnect Project ID
        walletConnectProjectId: wcProjectId,
      })
    )
  );


  return (
    // Wrap your providers with SessionProvider
    <SessionProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <ConnectKitProvider>
            {children}
          </ConnectKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </SessionProvider>
  );
}