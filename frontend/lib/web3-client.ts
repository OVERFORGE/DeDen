// lib/web3-client.ts - Fixed Mantle Sepolia definition

import { createPublicClient, http, type PublicClient } from 'viem';
import { arbitrum, bsc, base } from 'viem/chains';
import type { Chain } from 'viem/chains';

// ✅ FIXED: Define Mantle Sepolia chain without 'network' property
const mantleSepolia: Chain = {
  id: 5003,
  name: 'Mantle Sepolia',
  // ❌ REMOVED: network: 'mantle-sepolia', // This property doesn't exist in Chain type
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
        : 'https://bsc-dataseed.binance.org';
    
    case 8453: // Base
      return process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_BASE
        ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_BASE}`
        : 'https://mainnet.base.org';
    
    // ✅ NEW: Mantle Sepolia
    case 5003:
      return process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_MANTLE_TESTNET
        ? `https://mantle-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_MANTLE_TESTNET}`
        : 'https://rpc.sepolia.mantle.xyz';
    
    default:
      console.warn(`No RPC URL configured for chain ${chainId}`);
      return undefined;
  }
};

type ChainPublicClient = PublicClient<ReturnType<typeof http>, Chain>;

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

// Initialize Base client
const baseRpc = getRpcUrl(8453);
if (baseRpc) {
  try {
    const baseClient = createPublicClient({
      chain: base,
      transport: http(baseRpc, {
        timeout: 30_000,
        retryCount: 3,
        retryDelay: 1000,
      }),
    });
    
    clients[8453] = baseClient as ChainPublicClient;
    console.log('[Web3Client] ✅ Base client initialized');
  } catch (error) {
    console.error('[Web3Client] ❌ Failed to initialize Base client:', error);
    clients[8453] = null;
  }
}

// ✅ Initialize Mantle Sepolia client
const mantleSepoliaRpc = getRpcUrl(5003);
if (mantleSepoliaRpc) {
  try {
    const mantleSepoliaClient = createPublicClient({
      chain: mantleSepolia,
      transport: http(mantleSepoliaRpc, {
        timeout: 30_000,
        retryCount: 3,
        retryDelay: 1000,
      }),
    });
    
    clients[5003] = mantleSepoliaClient as ChainPublicClient;
    console.log('[Web3Client] ✅ Mantle Sepolia client initialized');
    console.log('[Web3Client] Mantle Sepolia RPC:', mantleSepoliaRpc.substring(0, 50) + '...');
  } catch (error) {
    console.error('[Web3Client] ❌ Failed to initialize Mantle Sepolia client:', error);
    clients[5003] = null;
  }
}

export function getPublicClient(chainId: number): ChainPublicClient | null {
  const client = clients[chainId];
  
  if (!client) {
    console.error(`[Web3Client] ❌ No public client configured for chain ${chainId}`);
    console.error(`[Web3Client] Available chains:`, Object.keys(clients).filter(k => clients[Number(k)] !== null));
    return null;
  }
  
  return client;
}

export function getSupportedChainIds(): number[] {
  return Object.keys(clients)
    .map(Number)
    .filter(chainId => clients[chainId] !== null);
}

export function isChainSupported(chainId: number): boolean {
  return clients[chainId] !== null;
}

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

console.log('\n[Web3Client] Initialization Summary:');
console.log('=====================================');
Object.entries(clients).forEach(([chainId, client]) => {
  const status = client ? '✅ Ready' : '❌ Failed';
  console.log(`Chain ${chainId}: ${status}`);
});
console.log('=====================================\n');

export { clients };
export type { ChainPublicClient };