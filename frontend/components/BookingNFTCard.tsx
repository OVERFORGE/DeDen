// components/BookingNFTCard.tsx
//
// Styled to match the booking detail page's own card language (white,
// 2px dark-olive border, offset shadow) rather than the old hardcoded navy
// `#172a46` — that colour was a leftover from before this palette was
// established and didn't belong anywhere in the app anymore.

"use client";

import { ExternalLink, Wallet, CheckCircle, Sparkles } from "lucide-react";
import { useState } from "react";

interface NFTCardProps {
  booking: {
    bookingId: string;
    nftMinted: boolean;
    nftTokenId?: string;
    nftContractAddress?: string;
    chainId?: number;
    stayTitle: string;
    nftClaimable?: boolean;
    nftVoucherExpiry?: string | null;
  };
  /** Opens the claim flow (parent owns the modal since it needs booking-wide state). */
  onClaim?: () => void;
}

export function BookingNFTCard({ booking, onClaim }: NFTCardProps) {
  const [isAddingToWallet, setIsAddingToWallet] = useState(false);
  const [addedToWallet, setAddedToWallet] = useState(false);

  const isMinted = booking.nftMinted && !!booking.nftTokenId;
  const isClaimable = !isMinted && booking.nftClaimable;
  const isExpired =
    isClaimable && !!booking.nftVoucherExpiry && new Date(booking.nftVoucherExpiry).getTime() <= Date.now();

  if (!isMinted && !isClaimable) {
    return null;
  }

  // ✅ Add NFT to MetaMask Wallet
  const handleAddToWallet = async () => {
    if (!booking.nftContractAddress || !booking.nftTokenId) return;

    try {
      setIsAddingToWallet(true);

      if (typeof window.ethereum === "undefined") {
        alert("Please install MetaMask to add NFT to your wallet");
        return;
      }

      const wasAdded = await window.ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC721",
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
      console.error("Error adding NFT to wallet:", error);
      alert("Failed to add NFT to wallet. Please try again.");
    } finally {
      setIsAddingToWallet(false);
    }
  };

  const getOpenSeaUrl = () => {
    const chainSlug =
      booking.chainId === 42161 ? "arbitrum" :
      booking.chainId === 56 ? "bnb" :
      booking.chainId === 8453 ? "base" :
      booking.chainId === 5003 ? "mantle" :
      "ethereum";

    return `https://opensea.io/assets/${chainSlug}/${booking.nftContractAddress}/${booking.nftTokenId}`;
  };

  const getBlockExplorerUrl = () => {
    const baseUrl =
      booking.chainId === 42161 ? "https://arbiscan.io" :
      booking.chainId === 56 ? "https://bscscan.com" :
      booking.chainId === 8453 ? "https://basescan.org" :
      booking.chainId === 5003 ? "https://explorer.sepolia.mantle.xyz" :
      "https://etherscan.io";

    return `${baseUrl}/token/${booking.nftContractAddress}?a=${booking.nftTokenId}`;
  };

  const getChainName = () => {
    const chains: Record<number, string> = {
      42161: "Arbitrum",
      56: "BNB Chain",
      8453: "Base",
      5003: "Mantle Sepolia",
    };
    return booking.chainId ? chains[booking.chainId] || `Chain ${booking.chainId}` : "Unknown";
  };

  // ── Claimable, not yet minted ──────────────────────────────────────────
  if (isClaimable) {
    return (
      <div className="bg-white border-2 border-[#2c331f] rounded-2xl p-5 shadow-[3px_3px_0px_0px_#2c331f]">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-[#9db47d] rounded-full flex items-center justify-center flex-shrink-0">
            <Sparkles size={20} className="text-[#2c331f]" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-black text-[#2c331f] text-sm uppercase tracking-widest mb-1">
              NFT Ticket Ready to Claim
            </h4>
            {isExpired ? (
              <p className="text-xs font-medium text-[#5a6b3a]">
                This claim link has expired. Contact support for a new one.
              </p>
            ) : (
              <>
                <p className="text-xs font-medium text-[#5a6b3a] mb-3">
                  Mint your booking as a collectible NFT ticket, straight to your own wallet. You'll pay a small
                  network gas fee to claim it.
                </p>
                <button
                  onClick={onClaim}
                  className="inline-flex items-center gap-2 bg-[#2c331f] text-[#f7eedb] px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest hover:opacity-90 transition-opacity"
                >
                  <Sparkles size={14} />
                  Claim NFT
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Already minted ──────────────────────────────────────────────────────
  return (
    <div className="bg-white border-2 border-[#2c331f] rounded-2xl p-5 shadow-[3px_3px_0px_0px_#2c331f]">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-[#9db47d] rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-2xl">🎫</span>
        </div>

        <div className="flex-1">
          <h4 className="font-black text-[#2c331f] text-sm uppercase tracking-widest mb-1">NFT Ticket Minted</h4>
          <p className="text-xs font-medium text-[#5a6b3a] mb-3">
            Your booking is tokenized as an NFT on {getChainName()}. View it in your wallet or on OpenSea.
          </p>

          <div className="bg-[#f7eedb] border border-[#2c331f]/15 rounded-lg p-3 mb-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[#5a6b3a] font-bold uppercase tracking-wider text-[10px]">Token ID</span>
                <div className="font-mono font-black text-[#2c331f]">#{booking.nftTokenId}</div>
              </div>
              <div>
                <span className="text-[#5a6b3a] font-bold uppercase tracking-wider text-[10px]">Contract</span>
                <div className="font-mono text-[11px] text-[#2c331f] truncate">
                  {booking.nftContractAddress?.slice(0, 10)}...
                </div>
              </div>
            </div>
            {booking.chainId === 5003 && (
              <div className="mt-2 pt-2 border-t border-[#2c331f]/10">
                <span className="inline-block px-2 py-1 bg-[#e8c37b] text-[#2c331f] text-[10px] font-black uppercase tracking-widest rounded">
                  Testnet NFT
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <button
              onClick={handleAddToWallet}
              disabled={isAddingToWallet || addedToWallet}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all text-xs font-black uppercase tracking-widest ${
                addedToWallet
                  ? "bg-[#9db47d] text-[#2c331f] cursor-default"
                  : "bg-[#2c331f] text-[#f7eedb] hover:opacity-90"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {addedToWallet ? (
                <>
                  <CheckCircle size={14} />
                  <span>Added!</span>
                </>
              ) : (
                <>
                  <Wallet size={14} />
                  <span>{isAddingToWallet ? "Adding…" : "Add to Wallet"}</span>
                </>
              )}
            </button>

            <a
              href={getOpenSeaUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-[#2c331f] text-[#f7eedb] px-4 py-2 rounded-lg hover:opacity-90 transition-opacity text-xs font-black uppercase tracking-widest"
            >
              <span>OpenSea</span>
              <ExternalLink size={12} />
            </a>

            <a
              href={getBlockExplorerUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-white border-2 border-[#2c331f] text-[#2c331f] px-4 py-2 rounded-lg hover:bg-[#f7eedb] transition-colors text-xs font-black uppercase tracking-widest"
            >
              <span>Explorer</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
