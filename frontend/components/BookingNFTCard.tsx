"use client";

import { ExternalLink, Wallet, CheckCircle } from "lucide-react";
import { useState } from "react";

interface NFTCardProps {
  booking: {
    bookingId: string;
    nftMinted: boolean;
    nftTokenId?: string;
    nftContractAddress?: string;
    chainId?: number;
    stayTitle: string;
  };
}

export function BookingNFTCard({ booking }: NFTCardProps) {
  const [isAddingToWallet, setIsAddingToWallet] = useState(false);
  const [addedToWallet, setAddedToWallet] = useState(false);

  if (!booking.nftMinted || !booking.nftTokenId) {
    return null;
  }

  // ✅ Add NFT to MetaMask Wallet
const handleAddToWallet = async () => {
    if (!booking.nftContractAddress || !booking.nftTokenId) return;

    try {
      setIsAddingToWallet(true);

      // Check if MetaMask is installed
      if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask to add NFT to your wallet');
        return;
      }

      // Request to add token to wallet
      const wasAdded = await window.ethereum.request({
        method: 'wallet_watchAsset',
        // 🔴 FIX: Cast this object to 'any' to satisfy the TypeScript compiler
        params: {
          type: 'ERC721', 
          options: {
            address: booking.nftContractAddress,
            tokenId: booking.nftTokenId,
          },
        } as any, 
      });

      if (wasAdded) {
        setAddedToWallet(true);
        setTimeout(() => setAddedToWallet(false), 3000);
      }
    } catch (error) {
      console.error('Error adding NFT to wallet:', error);
      alert('Failed to add NFT to wallet. Please try again.');
    } finally {
      setIsAddingToWallet(false);
    }
  };

  const getOpenSeaUrl = () => {
    const chainSlug = booking.chainId === 42161 ? 'arbitrum' : 
                      booking.chainId === 56 ? 'bnb' : 
                      booking.chainId === 8453 ? 'base' : 'ethereum';
    
    return `https://opensea.io/assets/${chainSlug}/${booking.nftContractAddress}/${booking.nftTokenId}`;
  };

  const getBlockExplorerUrl = () => {
    const baseUrl = booking.chainId === 42161 ? 'https://arbiscan.io' :
                    booking.chainId === 56 ? 'https://bscscan.com' :
                    booking.chainId === 8453 ? 'https://basescan.org' : 
                    'https://etherscan.io';
    
    return `${baseUrl}/token/${booking.nftContractAddress}?a=${booking.nftTokenId}`;
  };

  return (
    <div className="bg-gradient-to-br from-[#172a46]/5 to-[#172a46]/10 border-2 border-[#172a46]/20 rounded-xl p-6 mt-4">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-16 h-16 bg-[#172a46] rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-3xl">🎫</span>
        </div>

        <div className="flex-1">
          {/* Title */}
          <h4 className="font-bold text-[#172a46] text-lg mb-1">
            NFT Ticket Minted!
          </h4>
          <p className="text-sm text-gray-700 mb-3">
            Your booking is now tokenized as an NFT. View it in your wallet or on OpenSea.
          </p>
          
          {/* Token Details */}
          <div className="bg-white border border-[#172a46]/20 rounded-lg p-3 mb-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Token ID:</span>
                <div className="font-mono font-bold text-[#172a46]">
                  #{booking.nftTokenId}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Contract:</span>
                <div className="font-mono text-xs text-gray-700 truncate">
                  {booking.nftContractAddress?.slice(0, 10)}...
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {/* ✅ ✅ ✅ ADD TO WALLET BUTTON ✅ ✅ ✅ */}
            <button
              onClick={handleAddToWallet}
              disabled={isAddingToWallet || addedToWallet}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-semibold ${
                addedToWallet
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-[#172a46] text-white hover:bg-[#172a46]/90'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {addedToWallet ? (
                <>
                  <CheckCircle size={16} />
                  <span>Added!</span>
                </>
              ) : (
                <>
                  <Wallet size={16} />
                  <span>{isAddingToWallet ? 'Adding...' : 'Add to Wallet'}</span>
                </>
              )}
            </button>

            {/* OpenSea Button */}
            <a 
              href={getOpenSeaUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-[#172a46] text-white px-4 py-2 rounded-lg hover:bg-[#172a46]/90 transition-colors text-sm font-semibold"
            >
              <span>OpenSea</span>
              <ExternalLink size={14} />
            </a>
            
            {/* Explorer Button */}
            <a 
              href={getBlockExplorerUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-white border-2 border-[#172a46] text-[#172a46] px-4 py-2 rounded-lg hover:bg-[#172a46]/5 transition-colors text-sm font-semibold"
            >
              <span>Explorer</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}