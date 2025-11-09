// File: app/lib/providers.ts

import { ethers } from 'ethers';
// Use the relative path you used before, or the @/ alias
import { chainConfig } from '@/lib/config'; 

// Get the BSC Testnet config (chainId 97)
const bscConfig = chainConfig[97];

if (!bscConfig || !bscConfig.rpcUrl) {
  // This will crash the server if your config is wrong, which is what we want.
  throw new Error("BSC Testnet (97) RPC URL not found in config.ts");
}

// Create a reusable Ethers.js provider
// This is our single, read-only connection point to the blockchain
export const bscTestnetProvider = new ethers.JsonRpcProvider(bscConfig.rpcUrl);