// This file stores all your non-secret configuration for chains and tokens

// Define the structure for a token
interface TokenConfig {
  address: string;
  decimals: number;
}

// Define the structure for a chain
interface ChainConfig {
  name: string;
  chainId: number;
  rpcUrl: string; // The full RPC URL
  tokens: {
    [symbol: string]: TokenConfig;
  };
}

// --- CONFIGURATION (BSC Testnet ONLY) ---

// Ensure the environment variable is loaded
const bscRpcUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_BSC_TESTNET;
if (!bscRpcUrl) {
  throw new Error("ALCHEMY_API_KEY_BSC_TESTNET is not defined in .env.local");
}

export const chainConfig: { [key: number]: ChainConfig } = {
  
  // BSC Testnet
  97: {
    name: "BSC Testnet",
    chainId: 97,
    // --- THIS IS THE FIX ---
    // Use the environment variable directly as the full URL
    rpcUrl: `https://bnb-testnet.g.alchemy.com/v2/${bscRpcUrl}`,
    // --- END OF FIX ---
    tokens: {
      USDT: {
        address: "0x0F0ff457a288EC92d2598CB6be3469A0318B636F", // Your Deployed TUSDT
        decimals: 18,
      },
      USDC: {
        address: "0x43f203931795ad83f2cba490fB908E62279f88AC", // Your Deployed TUSDC (6 decimals)
        decimals: 6,
      },
    },
  },
  
  // Arbitrum is ignored for now, as requested.
};

// Export the treasury address for easy access
export const treasuryAddress = process.env.NEXT_PUBLIC_TESTNET_TREASURY_ADDRESS;
