// File: lib/web3-client.ts
// ✅ FIXED: Type-safe Base network client configuration

import { createPublicClient, http, type PublicClient } from 'viem';
import { arbitrum, bsc, base } from 'viem/chains';
import type { Chain } from 'viem/chains';

// Get RPC URLs from environment variables
const getRpcUrl = (chainId: number): string | undefined => {
  switch (chainId) {
    case 42161: // Arbitrum
      return process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_ARBITRUM
        ? `https://arb-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_ARBITRUM}`
        : undefined;
    
    case 56: // BSC
      return process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_BNB
        ? `https://bnb-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_BNB}`
        : 'https://bsc-dataseed.binance.org'; // Public RPC as fallback
    
    case 8453: // Base
      return process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_BASE
        ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_BASE}`
        : 'https://mainnet.base.org'; // Public fallback
    
    default:
      console.warn(`No RPC URL configured for chain ${chainId}`);
      return undefined;
  }
};

// ✅ FIX: Use a union type that accommodates all chain types
type ChainPublicClient = PublicClient<ReturnType<typeof http>, Chain>;

// Create public clients for each chain
const clients: Record<number, ChainPublicClient | null> = {};

// Initialize Arbitrum client
const arbitrumRpc = getRpcUrl(42161);
if (arbitrumRpc) {
  try {
    clients[42161] = createPublicClient({
      chain: arbitrum,
      transport: http(arbitrumRpc),
    });
    console.log('[Web3Client] ✅ Arbitrum client initialized');
  } catch (error) {
    console.error('[Web3Client] ❌ Failed to initialize Arbitrum client:', error);
    clients[42161] = null;
  }
}

// Initialize BSC client
const bscRpc = getRpcUrl(56);
if (bscRpc) {
  try {
    clients[56] = createPublicClient({
      chain: bsc,
      transport: http(bscRpc),
    });
    console.log('[Web3Client] ✅ BSC client initialized');
  } catch (error) {
    console.error('[Web3Client] ❌ Failed to initialize BSC client:', error);
    clients[56] = null;
  }
}

// ✅ FIX: Initialize Base client with proper typing
const baseRpc = getRpcUrl(8453);
if (baseRpc) {
  try {
    // Create the Base client - viem will infer the correct type
    const baseClient = createPublicClient({
      chain: base,
      transport: http(baseRpc, {
        timeout: 30_000, // 30 seconds
        retryCount: 3,
        retryDelay: 1000,
      }),
    });
    
    // ✅ Store with type assertion to the union type
    clients[8453] = baseClient as ChainPublicClient;
    
    console.log('[Web3Client] ✅ Base client initialized');
    console.log('[Web3Client] Base RPC:', baseRpc.substring(0, 50) + '...');
  } catch (error) {
    console.error('[Web3Client] ❌ Failed to initialize Base client:', error);
    clients[8453] = null;
  }
}

/**
 * Get public client for a specific chain
 * @param chainId - The chain ID to get client for
 * @returns PublicClient or null if not configured
 */
export function getPublicClient(chainId: number): ChainPublicClient | null {
  const client = clients[chainId];
  
  if (!client) {
    console.error(`[Web3Client] ❌ No public client configured for chain ${chainId}`);
    console.error(`[Web3Client] Available chains:`, Object.keys(clients).filter(k => clients[Number(k)] !== null));
    return null;
  }
  
  return client;
}

/**
 * Get all configured chain IDs
 * @returns Array of chain IDs that have clients configured
 */
export function getSupportedChainIds(): number[] {
  return Object.keys(clients)
    .map(Number)
    .filter(chainId => clients[chainId] !== null);
}

/**
 * Check if a chain is supported
 * @param chainId - The chain ID to check
 * @returns true if the chain has a client configured
 */
export function isChainSupported(chainId: number): boolean {
  return clients[chainId] !== null;
}

/**
 * Test connection to a chain
 * @param chainId - The chain ID to test
 * @returns Promise<boolean> - true if connection works
 */
export async function testChainConnection(chainId: number): Promise<boolean> {
  const client = getPublicClient(chainId);
  if (!client) {
    return false;
  }
  
  try {
    const blockNumber = await client.getBlockNumber();
    console.log(`[Web3Client] ✅ Chain ${chainId} connection test successful. Latest block: ${blockNumber}`);
    return true;
  } catch (error) {
    console.error(`[Web3Client] ❌ Chain ${chainId} connection test failed:`, error);
    return false;
  }
}

// Log initialization status
console.log('\n[Web3Client] Initialization Summary:');
console.log('=====================================');
Object.entries(clients).forEach(([chainId, client]) => {
  const status = client ? '✅ Ready' : '❌ Failed';
  console.log(`Chain ${chainId}: ${status}`);
});
console.log('=====================================\n');

// Export clients for direct use if needed
export { clients };
export type { ChainPublicClient };