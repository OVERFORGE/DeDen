// lib/config.ts - Updated with Mantle Sepolia

interface TokenConfig {
  address: string;
  decimals: number;
  symbol: string;
  name: string;
}

interface ChainConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  tokens: {
    [symbol: string]: TokenConfig;
  };
  testnet?: boolean; // ✅ ADD THIS LINE
}

function getEnvVar(key: string): string {
  const value = process.env[key];
  if (value && value.trim() !== '' && value !== 'undefined') {
    return value.trim();
  }
  return '__BUILD_TIME_PLACEHOLDER__';
}

export const treasuryAddress = "0x8895691124df317aBa77549843f257F61a7C911a";

const arbitrumApiKey = getEnvVar('NEXT_PUBLIC_ALCHEMY_API_KEY_ARBITRUM');
const bnbApiKey = getEnvVar('NEXT_PUBLIC_ALCHEMY_API_KEY_BNB');
const baseApiKey = getEnvVar('NEXT_PUBLIC_ALCHEMY_API_KEY_BASE');
const mantleTestnetApiKey = getEnvVar('NEXT_PUBLIC_ALCHEMY_API_KEY_MANTLE_TESTNET');

export const chainConfig: { [key: number]: ChainConfig } = {
  // Arbitrum One (Mainnet)
  42161: {
    name: "Arbitrum One",
    chainId: 42161,
    rpcUrl: `https://arb-mainnet.g.alchemy.com/v2/${arbitrumApiKey}`,
    blockExplorer: "https://arbiscan.io",
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
    tokens: {
      USDC: {
        address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        decimals: 6,
        symbol: "USDC",
        name: "USD Coin",
      },
      USDT: {
        address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        decimals: 6,
        symbol: "USDT",
        name: "Tether USD",
      },
    },
  },

  // BNB Smart Chain (Mainnet)
  56: {
    name: "BNB Smart Chain",
    chainId: 56,
    rpcUrl: `https://bnb-mainnet.g.alchemy.com/v2/${bnbApiKey}`,
    blockExplorer: "https://bscscan.com",
    nativeCurrency: {
      name: "BNB",
      symbol: "BNB",
      decimals: 18,
    },
    tokens: {
      USDC: {
        address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
        decimals: 18,
        symbol: "USDC",
        name: "USD Coin",
      },
      USDT: {
        address: "0x55d398326f99059fF775485246999027B3197955",
        decimals: 18,
        symbol: "USDT",
        name: "Tether USD",
      },
    },
  },

  // Base (Mainnet)
  8453: {
    name: "Base",
    chainId: 8453,
    rpcUrl: `https://base-mainnet.g.alchemy.com/v2/${baseApiKey}`,
    blockExplorer: "https://basescan.org",
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
    tokens: {
      USDC: {
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimals: 6,
        symbol: "USDC",
        name: "USD Coin",
      },
    },
  },

  // ✅ NEW: Mantle Sepolia Testnet
5003: {
  name: "Mantle Sepolia",
  chainId: 5003,
  rpcUrl: "https://rpc.sepolia.mantle.xyz",
  blockExplorer: "https://explorer.sepolia.mantle.xyz",
  nativeCurrency: {
    name: "MNT",
    symbol: "MNT",
    decimals: 18,
  },
  tokens: {
    USDC: {
      address: "0xE4e422626a10246C8B19Bd0e0eA0535257BBF91c",
      decimals: 6, // ✅ FIXED: Changed from 18 to 6
      symbol: "USDC",
      name: "USD Coin",
    },
    USDT: {
      address: "0xbd47D8dF6964ef6042f40900ea8274aD88c796d9",
      decimals: 6, // ✅ FIXED: Changed from 18 to 6
      symbol: "USDT",
      name: "Tether USD",
    },
  },
    testnet: true, // ✅ ADD THIS LINE

},
};

export function getSupportedTokens(chainId: number): string[] {
  const chain = chainConfig[chainId];
  return chain ? Object.keys(chain.tokens) : [];
}

export function validateChainAndToken(chainId: number, token: string): boolean {
  const chain = chainConfig[chainId];
  if (!chain) return false;
  return token in chain.tokens;
}

export function getChainName(chainId: number): string {
  return chainConfig[chainId]?.name || "Unknown Chain";
}

export const SUPPORTED_CHAINS = Object.keys(chainConfig).map(Number);

function validateConfiguration(): void {
  const errors: string[] = [];
  
  const isTreasuryPlaceholder = treasuryAddress.includes('PLACEHOLDER') ||
                                treasuryAddress.includes('undefined') ||
                                !treasuryAddress.startsWith('0x');
  
  if (!isTreasuryPlaceholder && !/^0x[a-fA-F0-9]{40}$/i.test(treasuryAddress)) {
    errors.push(`Invalid treasury address format: ${treasuryAddress}`);
  }
  
  if (SUPPORTED_CHAINS.length === 0) {
    errors.push("No chains configured");
  }
  
  SUPPORTED_CHAINS.forEach((chainId) => {
    const chain = chainConfig[chainId];
    
    const isRpcPlaceholder = chain.rpcUrl.includes('PLACEHOLDER') || 
                         chain.rpcUrl.includes('undefined') ||
                         chain.rpcUrl.length < 20;
    
    if (!isRpcPlaceholder && !chain.rpcUrl.startsWith('http')) {
      errors.push(`Invalid RPC URL for chain ${chainId}`);
    }
    
    if (Object.keys(chain.tokens).length === 0) {
      errors.push(`No tokens configured for chain ${chainId}`);
    }
    
    Object.entries(chain.tokens).forEach(([symbol, token]) => {
      if (!/^0x[a-fA-F0-9]{40}$/i.test(token.address)) {
        errors.push(`Invalid token address for ${symbol} on chain ${chainId}`);
      }
    });
  });
  
  if (errors.length > 0) {
    console.error('❌ Configuration validation failed:');
    errors.forEach(e => console.error(`   - ${e}`));
    if (typeof window !== 'undefined') {
      throw new Error('Configuration validation failed - check console for details');
    }
  } else if (typeof window === 'undefined' && !isTreasuryPlaceholder) {
    console.log(`✅ Config validated: ${SUPPORTED_CHAINS.length} chains, treasury: ${treasuryAddress}`);
  }
}

validateConfiguration();