// File: lib/nft-service.ts
// ✅ Supports Arbitrum mainnet

import { ethers } from 'ethers';
import { uploadNFTMetadata } from './nft-metadata';

const NFT_CONTRACT_ABI = [
  'function mintBookingNFT(address recipient, string memory bookingId, string memory metadataURI, string memory stayTitle) public returns (uint256)',
  'function hasBookingNFT(string memory bookingId) public view returns (bool)',
  'function getTokenIdForBooking(string memory bookingId) public view returns (uint256)',
  'event BookingNFTMinted(address indexed recipient, uint256 indexed tokenId, string bookingId, string stayTitle)',
];

const NFT_CONTRACT_ADDRESSES: Record<number, string> = {
  // Arbitrum One
  42161: process.env.NFT_CONTRACT_ARBITRUM || '0x1e792D4c34c3d04Bd127aFEf0c1696E912c755aa', 
  
  // BNB Smart Chain (Updated)
  56: process.env.NFT_CONTRACT_BNB || '0xF4Ec99707aBC065d87eb03B629B2743723Cd3cc0',
  
  // Base (Updated)
  8453: process.env.NFT_CONTRACT_BASE || '0x021D0f2212ec1869933F4D21ea76dCF9e127396B',
};

const RPC_URLS: Record<number, string> = {
  42161: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
  56: process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org',
  8453: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
};

interface MintNFTParams {
  bookingId: string;
  recipientAddress: string;
  chainId: number;
  stayTitle: string;
  location: string;
  checkInDate: Date;
  checkOutDate: Date;
  guestName: string;
  numberOfNights: number;
}

interface MintNFTResult {
  success: boolean;
  tokenId?: number;
  txHash?: string;
  contractAddress?: string;
  error?: string;
}

export async function mintBookingNFT(params: MintNFTParams): Promise<MintNFTResult> {
  const {
    bookingId,
    recipientAddress,
    chainId,
    stayTitle,
    location,
    checkInDate,
    checkOutDate,
    guestName,
    numberOfNights,
  } = params;

  try {
    console.log(`\n========================================`);
    console.log(`[NFT] Starting minting process...`);
    console.log(`[NFT] Booking ID: ${bookingId}`);
    console.log(`[NFT] Recipient: ${recipientAddress}`);
    console.log(`[NFT] Chain ID: ${chainId}`);
    console.log(`========================================\n`);

    const contractAddress = NFT_CONTRACT_ADDRESSES[chainId];
    if (!contractAddress) {
      throw new Error(`No NFT contract configured for chain ${chainId}`);
    }

    console.log(`[NFT] Contract address: ${contractAddress}`);

    const rpcUrl = RPC_URLS[chainId];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const privateKey = process.env.NFT_MINTER_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('NFT_MINTER_PRIVATE_KEY not configured');
    }

    const wallet = new ethers.Wallet(privateKey, provider);
    console.log(`[NFT] Minter wallet: ${wallet.address}`);

    const contract = new ethers.Contract(contractAddress, NFT_CONTRACT_ABI, wallet);

    console.log(`[NFT] Checking if NFT already exists...`);
    const alreadyMinted = await contract.hasBookingNFT(bookingId);
    
    if (alreadyMinted) {
      console.log(`[NFT] ⚠️ NFT already minted for booking ${bookingId}`);
      const tokenId = await contract.getTokenIdForBooking(bookingId);
      return {
        success: true,
        tokenId: Number(tokenId),
        contractAddress,
        error: 'NFT already minted',
      };
    }

    console.log(`[NFT] Uploading metadata to IPFS...`);
    const metadataURI = await uploadNFTMetadata({
      bookingId,
      stayTitle,
      location,
      checkInDate,
      checkOutDate,
      guestName,
      numberOfNights,
    });

    console.log(`[NFT] ✅ Metadata uploaded: ${metadataURI}`);

    console.log(`[NFT] Calling mintBookingNFT on contract...`);
    const tx = await contract.mintBookingNFT(
      recipientAddress,
      bookingId,
      metadataURI,
      stayTitle
    );

    console.log(`[NFT] Transaction sent: ${tx.hash}`);
    console.log(`[NFT] Waiting for confirmation...`);

    const receipt = await tx.wait();
    
    console.log(`[NFT] ✅ Transaction confirmed in block ${receipt.blockNumber}`);

    let tokenId: number | undefined;
    
    for (const log of receipt.logs) {
      try {
        const parsedLog = contract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        
        if (parsedLog && parsedLog.name === 'BookingNFTMinted') {
          tokenId = Number(parsedLog.args.tokenId);
          console.log(`[NFT] ✅ NFT minted with Token ID: ${tokenId}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!tokenId) {
      console.warn(`[NFT] ⚠️ Could not extract token ID from logs, fetching from contract...`);
      tokenId = Number(await contract.getTokenIdForBooking(bookingId));
    }

    console.log(`\n========================================`);
    console.log(`[NFT] ✅✅✅ NFT MINTED SUCCESSFULLY ✅✅✅`);
    console.log(`[NFT] Token ID: ${tokenId}`);
    console.log(`[NFT] Contract: ${contractAddress}`);
    console.log(`[NFT] Transaction: ${tx.hash}`);
    console.log(`[NFT] Recipient: ${recipientAddress}`);
    console.log(`[NFT] View on Arbiscan: https://arbiscan.io/tx/${tx.hash}`);
    console.log(`[NFT] View on OpenSea: https://opensea.io/assets/arbitrum/${contractAddress}/${tokenId}`);
    console.log(`========================================\n`);

    return {
      success: true,
      tokenId,
      txHash: tx.hash,
      contractAddress,
    };

  } catch (error) {
    console.error('[NFT] ❌ Minting failed:', error);
    
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

export async function checkNFTExists(
  bookingId: string,
  chainId: number
): Promise<boolean> {
  try {
    const contractAddress = NFT_CONTRACT_ADDRESSES[chainId];
    if (!contractAddress) return false;

    const rpcUrl = RPC_URLS[chainId];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, NFT_CONTRACT_ABI, provider);

    return await contract.hasBookingNFT(bookingId);
  } catch (error) {
    console.error('[NFT] Error checking NFT existence:', error);
    return false;
  }
}

export async function getTokenIdForBooking(
  bookingId: string,
  chainId: number
): Promise<number | null> {
  try {
    const contractAddress = NFT_CONTRACT_ADDRESSES[chainId];
    if (!contractAddress) return null;

    const rpcUrl = RPC_URLS[chainId];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, NFT_CONTRACT_ABI, provider);

    const tokenId = await contract.getTokenIdForBooking(bookingId);
    return Number(tokenId);
  } catch (error) {
    console.error('[NFT] Error getting token ID:', error);
    return null;
  }
}