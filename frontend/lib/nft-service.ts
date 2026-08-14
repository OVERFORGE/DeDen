// File: lib/nft-service.ts
// ✅ Supports Arbitrum mainnet

import { ethers } from 'ethers';
import { uploadNFTMetadata } from './nft-metadata';

const NFT_CONTRACT_ABI = [
  'function mintBookingNFT(address recipient, string memory bookingId, string memory metadataURI, string memory stayTitle) public returns (uint256)',
  'function claimNFT(address recipient, string memory bookingId, string memory metadataURI, string memory stayTitle, uint256 expiry, bytes memory signature) public returns (uint256)',
  'function hasBookingNFT(string memory bookingId) public view returns (bool)',
  'function getTokenIdForBooking(string memory bookingId) public view returns (uint256)',
  'event BookingNFTMinted(address indexed recipient, uint256 indexed tokenId, string bookingId, string stayTitle)',
];

// lib/nft-service.ts - Add Mantle Sepolia

const NFT_CONTRACT_ADDRESSES: Record<number, string> = {
  42161: process.env.NFT_CONTRACT_ARBITRUM || '0x1e792D4c34c3d04Bd127aFEf0c1696E912c755aa', 
  56: process.env.NFT_CONTRACT_BNB || '0xF4Ec99707aBC065d87eb03B629B2743723Cd3cc0',
  8453: process.env.NFT_CONTRACT_BASE || '0x021D0f2212ec1869933F4D21ea76dCF9e127396B',
  5003: process.env.NFT_CONTRACT_MANTLE_TESTNET || '0xF563d7a976313D363fFB0dF60DC82DF02CeD85cb', // ✅ NEW
};

const RPC_URLS: Record<number, string> = {
  42161: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
  56: process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org',
  8453: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  5003: process.env.MANTLE_TESTNET_RPC_URL || 'https://rpc.sepolia.mantle.xyz', // ✅ NEW
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

interface ClaimVoucherParams {
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

interface ClaimVoucherResult {
  success: boolean;
  contractAddress?: string;
  metadataURI?: string;
  signature?: string;
  expiry?: number; // unix seconds
  error?: string;
}

// Generous but not indefinite — bounds how long a leaked/lost voucher stays claimable.
const VOUCHER_VALIDITY_SECONDS = 90 * 24 * 60 * 60;

/**
 * Issues a signed EIP-712 "claim voucher" instead of broadcasting the mint
 * transaction ourselves. This is the self-service counterpart to
 * mintBookingNFT(): the guest calls claimNFT() on-chain with this voucher
 * from their OWN wallet and pays their OWN gas. Signing a typed-data message
 * is pure crypto — no RPC call, no gas, no dependency on the platform
 * wallet holding native token on whatever chain the guest paid on.
 */
export async function issueClaimVoucher(params: ClaimVoucherParams): Promise<ClaimVoucherResult> {
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
    const contractAddress = NFT_CONTRACT_ADDRESSES[chainId];
    if (!contractAddress) {
      throw new Error(`No NFT contract configured for chain ${chainId}`);
    }

    const privateKey = process.env.NFT_MINTER_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('NFT_MINTER_PRIVATE_KEY not configured');
    }
    // No provider/RPC needed here — signing never touches the chain.
    const signerWallet = new ethers.Wallet(privateKey);

    console.log(`[NFT] Uploading metadata to IPFS for voucher (booking ${bookingId})...`);
    const metadataURI = await uploadNFTMetadata({
      bookingId,
      stayTitle,
      location,
      checkInDate,
      checkOutDate,
      guestName,
      numberOfNights,
    });

    const expiry = Math.floor(Date.now() / 1000) + VOUCHER_VALIDITY_SECONDS;

    // Must match BookingNFT.sol's EIP712 domain and ClaimVoucher struct
    // EXACTLY (name/version/field order/types) or every signature this
    // produces will fail claimNFT()'s ECDSA.recover check on-chain.
    const domain = {
      name: 'Decentralized Den Ticket',
      version: '1',
      chainId,
      verifyingContract: contractAddress,
    };
    const types = {
      ClaimVoucher: [
        { name: 'recipient', type: 'address' },
        { name: 'bookingId', type: 'string' },
        { name: 'metadataURI', type: 'string' },
        { name: 'stayTitle', type: 'string' },
        { name: 'expiry', type: 'uint256' },
      ],
    };
    const value = { recipient: recipientAddress, bookingId, metadataURI, stayTitle, expiry };

    const signature = await signerWallet.signTypedData(domain, types, value);

    console.log(`[NFT] ✅ Claim voucher signed for booking ${bookingId} (expires ${new Date(expiry * 1000).toISOString()})`);

    return { success: true, contractAddress, metadataURI, signature, expiry };
  } catch (error) {
    console.error('[NFT] Voucher signing failed:', error);
    return { success: false, error: (error as Error).message };
  }
}

interface VerifyClaimResult {
  success: boolean;
  tokenId?: number;
  error?: string;
}

/**
 * Confirms a guest's self-service claim actually happened on-chain, for the
 * exact booking and to the expected wallet — called from the claim-confirm
 * API route after the guest's own claimNFT() transaction is submitted.
 * Never trusts the client's say-so that a claim succeeded; re-derives it
 * from the transaction receipt's event log.
 */
export async function verifyClaimTx(
  chainId: number,
  txHash: string,
  bookingId: string,
  expectedRecipient: string
): Promise<VerifyClaimResult> {
  try {
    const contractAddress = NFT_CONTRACT_ADDRESSES[chainId];
    if (!contractAddress) {
      return { success: false, error: `No NFT contract configured for chain ${chainId}` };
    }

    const rpcUrl = RPC_URLS[chainId];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt || receipt.status !== 1) {
      return { success: false, error: 'Transaction not found or not confirmed successfully' };
    }
    if (receipt.to?.toLowerCase() !== contractAddress.toLowerCase()) {
      return { success: false, error: 'Transaction was not sent to the NFT contract' };
    }

    const contract = new ethers.Contract(contractAddress, NFT_CONTRACT_ABI, provider);
    let tokenId: number | undefined;
    let recipient: string | undefined;

    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (parsed && parsed.name === 'BookingNFTMinted' && parsed.args.bookingId === bookingId) {
          tokenId = Number(parsed.args.tokenId);
          recipient = parsed.args.recipient as string;
          break;
        }
      } catch {
        continue;
      }
    }

    if (tokenId === undefined || !recipient) {
      return { success: false, error: 'No matching NFT mint event found in this transaction' };
    }
    if (recipient.toLowerCase() !== expectedRecipient.toLowerCase()) {
      return { success: false, error: 'The NFT was minted to a different address than expected' };
    }

    return { success: true, tokenId };
  } catch (error) {
    console.error('[NFT] Claim verification failed:', error);
    return { success: false, error: (error as Error).message };
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