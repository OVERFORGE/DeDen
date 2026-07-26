// lib/web3-client.ts
// EVM read clients for on-chain payment verification.
//
// ✅ RESILIENCE: every chain uses viem's `fallback()` transport, combining
// the primary RPC (Alchemy where configured) with a public backup. If the
// primary errors out (rate limit, inactive app/key, outage — this is
// exactly what happened on Base: Alchemy returned "App is inactive" on
// every retry, so a genuinely successful on-chain payment kept failing
// verification), viem automatically falls through to the backup endpoint
// instead of failing the whole verification attempt.

import { createPublicClient, http, fallback, type PublicClient } from 'viem';
import { mainnet, bsc, base, arbitrum } from 'viem/chains';
import type { Chain } from 'viem/chains';

// Public (no-key) backup RPCs per chain — used automatically if the primary
// endpoint errors out. Ethereum gets two independent public RPCs since it
// has no Alchemy key configured at all (see lib/config.ts).
const PUBLIC_RPCS: Record<number, string[]> = {
  1: ['https://eth.llamarpc.com', 'https://cloudflare-eth.com'],
  56: ['https://bsc-dataseed.binance.org'],
  8453: ['https://mainnet.base.org'],
  42161: ['https://arb1.arbitrum.io/rpc'],
};

function getAlchemyRpcUrl(chainId: number): string | undefined {
  switch (chainId) {
    case 42161:
      return process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_ARBITRUM
        ? `https://arb-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_ARBITRUM}`
        : undefined;
    case 56:
      return process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_BNB
        ? `https://bnb-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_BNB}`
        : undefined;
    case 8453:
      return process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_BASE
        ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_BASE}`
        : undefined;
    default:
      return undefined;
  }
}

/**
 * Builds a fallback transport: Alchemy first (if configured), then public
 * RPC(s). `rank: false` keeps the order fixed (don't auto-promote whichever
 * responds fastest) so the metered/reliable endpoint stays primary and the
 * public RPCs are purely a backstop.
 */
function buildTransport(chainId: number) {
  const alchemyUrl = getAlchemyRpcUrl(chainId);
  const publicUrls = PUBLIC_RPCS[chainId] || [];

  const transports = [];
  if (alchemyUrl) {
    transports.push(http(alchemyUrl, { timeout: 20_000, retryCount: 1 }));
  }
  for (const url of publicUrls) {
    transports.push(http(url, { timeout: 20_000, retryCount: 1 }));
  }

  if (transports.length === 0) return null;
  if (transports.length === 1) return transports[0];
  return fallback(transports, { rank: false });
}

type ChainPublicClient = PublicClient<ReturnType<typeof http>, Chain>;

const clients: Record<number, ChainPublicClient | null> = {};

const chainDefs: { id: number; chain: Chain }[] = [
  { id: 1, chain: mainnet },
  { id: 56, chain: bsc },
  { id: 8453, chain: base },
  { id: 42161, chain: arbitrum },
];

for (const { id, chain } of chainDefs) {
  const transport = buildTransport(id);
  if (!transport) {
    console.warn(`[Web3Client] No RPC configured for chain ${id} (no Alchemy key and no public fallback)`);
    clients[id] = null;
    continue;
  }
  try {
    clients[id] = createPublicClient({ chain, transport }) as ChainPublicClient;
    console.log(`[Web3Client] ✅ Chain ${id} (${chain.name}) client initialized`);
  } catch (error) {
    console.error(`[Web3Client] ❌ Failed to initialize client for chain ${id}:`, error);
    clients[id] = null;
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
