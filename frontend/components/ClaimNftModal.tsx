// File: components/ClaimNftModal.tsx
//
// Self-service NFT claim: the GUEST mints their own booking NFT from their
// own wallet and pays their own gas, using an EIP-712 voucher the backend
// signed for free (see lib/nft-service.ts issueClaimVoucher /
// contracts/BookingNFT.sol claimNFT). Mirrors the wallet-picker UX of
// PayWalletModal but is intentionally a separate component — the payment
// flow is critical and already battle-tested, and duplicating ~250 lines
// here is worth not touching it.
//
// Wallet connection is scoped to this modal's lifetime, same as the pay
// modal: connecting happens here, and the wallet disconnects when it closes.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
  type Connector,
} from "wagmi";
import QRCode from "qrcode";
import { X, Wallet, CheckCircle2, Loader2, ExternalLink, QrCode, Sparkles } from "lucide-react";
import { getChainName } from "@/lib/config";

const CLAIM_NFT_ABI = [
  {
    type: "function",
    name: "claimNFT",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "bookingId", type: "string" },
      { name: "metadataURI", type: "string" },
      { name: "stayTitle", type: "string" },
      { name: "expiry", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

interface ClaimNftModalProps {
  contractAddress: string;
  chainId: number;
  bookingId: string;
  metadataURI: string;
  stayTitle: string;
  expiry: number; // unix seconds
  signature: string;
  onClaimed: (txHash: string) => void;
  onClose: () => void;
}

function isWalletConnect(c: Connector) {
  return c.id === "walletConnect" || c.type === "walletConnect";
}
function isCoinbase(c: Connector) {
  return c.id === "coinbaseWalletSDK" || c.id === "coinbaseWallet";
}
function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
function connectorHint(c: Connector, ready: boolean, mobile: boolean) {
  if (isWalletConnect(c)) return mobile ? "Opens your wallet app" : "Scan with any wallet";
  if (isCoinbase(c)) return "Extension or mobile";
  if (mobile && !ready) return "Not available in this browser";
  return ready ? "Installed" : "Not detected";
}

export function ClaimNftModal({
  contractAddress,
  chainId,
  bookingId,
  metadataURI,
  stayTitle,
  expiry,
  signature,
  onClaimed,
  onClose,
}: ClaimNftModalProps) {
  const { connectors, connectAsync, status: connectStatus } = useConnect();
  const { disconnect } = useDisconnect();
  const { address, isConnected } = useAccount();
  const activeChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [selected, setSelected] = useState<Connector | null>(null);
  const [wcUri, setWcUri] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readyIds, setReadyIds] = useState<Set<string>>(new Set());
  const [mobile, setMobile] = useState(false);
  useEffect(() => setMobile(isMobileDevice()), []);

  const [claiming, setClaiming] = useState(false);
  const [claimTxHash, setClaimTxHash] = useState<`0x${string}` | undefined>(undefined);

  const { isSuccess: receiptConfirmed } = useWaitForTransactionReceipt({ hash: claimTxHash });

  const cleanupRef = useRef<null | (() => void)>(null);

  const isExpired = Math.floor(Date.now() / 1000) >= expiry;

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      disconnect();
    };
  }, [disconnect]);

  const connectorKey = connectors.map((c) => c.uid).join("|");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = await Promise.all(
        connectors.map(async (c) => {
          try {
            const p = await c.getProvider();
            return p ? c.id : null;
          } catch {
            return null;
          }
        })
      );
      if (!cancelled) setReadyIds(new Set(ids.filter(Boolean) as string[]));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectorKey]);

  const ordered = useMemo(() => {
    const wc = connectors.filter(isWalletConnect);
    const rest = connectors.filter((c) => !isWalletConnect(c));
    rest.sort((a, b) => Number(readyIds.has(b.id)) - Number(readyIds.has(a.id)));
    return mobile ? [...wc, ...rest] : [...rest, ...wc];
  }, [connectors, readyIds, mobile]);

  useEffect(() => {
    if (!wcUri) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(wcUri, {
      width: 460,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#3D4331", light: "#FFFFFF" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [wcUri]);

  const handleSelect = useCallback(
    async (connector: Connector) => {
      setError(null);
      setSelected(connector);
      setWcUri(null);
      cleanupRef.current?.();

      if (mobile && !isWalletConnect(connector) && !isCoinbase(connector) && !readyIds.has(connector.id)) {
        setError(
          `${connector.name} isn't available in your phone's browser. Use WalletConnect below to open your wallet app instead.`
        );
        return;
      }

      try {
        if (isWalletConnect(connector)) {
          const provider: any = await connector.getProvider();
          const onUri = (uri: string) => setWcUri(uri);
          provider?.on?.("display_uri", onUri);
          cleanupRef.current = () => provider?.removeListener?.("display_uri", onUri);
        }

        await connectAsync({ connector });
      } catch (err: any) {
        const msg = String(err?.message || "");
        if (/rejected|denied|closed/i.test(msg)) {
          setError("Connection cancelled.");
        } else {
          setError(msg || "Could not connect to that wallet.");
        }
      }
    },
    [connectAsync, mobile, readyIds]
  );

  const handleClaim = useCallback(async () => {
    if (!address) return;
    setError(null);
    setClaiming(true);
    try {
      if (activeChainId !== chainId) {
        await switchChainAsync({ chainId });
      }

      const hash = await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: CLAIM_NFT_ABI,
        functionName: "claimNFT",
        chainId,
        args: [address, bookingId, metadataURI, stayTitle, BigInt(expiry), signature as `0x${string}`],
      });

      setClaimTxHash(hash);
    } catch (err: any) {
      const msg = String(err?.shortMessage || err?.message || "");
      if (/rejected|denied/i.test(msg)) {
        setError("Claim cancelled.");
      } else if (/already minted/i.test(msg)) {
        setError("This NFT has already been claimed.");
      } else if (/expired/i.test(msg)) {
        setError("This claim voucher has expired. Contact support for a new one.");
      } else {
        setError(msg || "Could not claim your NFT. Please try again.");
      }
      setClaiming(false);
    }
  }, [address, activeChainId, chainId, switchChainAsync, writeContractAsync, contractAddress, bookingId, metadataURI, stayTitle, expiry, signature]);

  // Once the claim tx is actually confirmed on-chain, hand the hash back to
  // the parent, which calls /confirm-nft-claim to verify + persist it.
  useEffect(() => {
    if (receiptConfirmed && claimTxHash) {
      onClaimed(claimTxHash);
    }
  }, [receiptConfirmed, claimTxHash, onClaimed]);

  const requestClose = () => {
    if (claiming && !receiptConfirmed) return;
    onClose();
  };

  const connecting = connectStatus === "pending";
  const waitingOnChain = claiming && !!claimTxHash && !receiptConfirmed;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={requestClose}>
      <div className="absolute inset-0 bg-[#3D4331]/60 backdrop-blur-sm" />

      <div
        className="relative bg-[#F3EDE0] rounded-[28px] border border-[#3D4331]/15 shadow-2xl w-full max-w-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-8 pt-7 pb-5 border-b border-[#3D4331]/10">
          <div>
            <h3 className="text-2xl font-serif font-black text-[#3D4331] leading-tight">
              Claim Your NFT Ticket
            </h3>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#3D4331]/50 mt-1">
              {stayTitle} · {getChainName(chainId)}
            </p>
          </div>
          <button
            onClick={requestClose}
            disabled={claiming && !receiptConfirmed}
            title={claiming ? "Claim in progress" : "Close"}
            className="w-9 h-9 rounded-full bg-white border border-[#3D4331]/10 flex items-center justify-center hover:bg-[#EBE1D0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <X size={16} className="text-[#3D4331]" />
          </button>
        </div>

        {isExpired ? (
          <div className="px-8 py-12 flex flex-col items-center text-center">
            <p className="text-sm font-bold text-[#3D4331]">
              This claim voucher has expired. Please contact support for a new one.
            </p>
          </div>
        ) : isConnected ? (
          <div className="px-8 py-10 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-[#3D4331] flex items-center justify-center mb-5">
              {waitingOnChain ? (
                <Loader2 className="w-7 h-7 text-[#F3EDE0] animate-spin" />
              ) : (
                <CheckCircle2 className="w-7 h-7 text-[#F3EDE0]" />
              )}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#3D4331]/50">
              Wallet connected
            </p>
            <p className="font-mono text-sm font-bold text-[#3D4331] mt-1 mb-6 break-all max-w-md">
              {address}
            </p>

            <div className="bg-white rounded-2xl px-10 py-6 border border-[#3D4331]/10 mb-6 flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-[#3D4331]/60" />
              <p className="text-sm font-bold text-[#3D4331] text-left">
                You'll pay a small network gas fee to mint this NFT to your own wallet.
              </p>
            </div>

            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full max-w-sm bg-[#3D4331] text-[#F3EDE0] font-bold py-4 rounded-full flex justify-center items-center gap-3 uppercase tracking-widest text-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
            >
              {waitingOnChain ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Confirming on-chain…
                </>
              ) : claiming ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Confirm in wallet…
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" /> Claim NFT
                </>
              )}
            </button>

            {!claiming && (
              <button
                onClick={() => disconnect()}
                className="mt-3 text-[10px] font-bold uppercase tracking-widest text-[#3D4331]/50 hover:text-[#3D4331] transition-colors"
              >
                Use a different wallet
              </button>
            )}

            {error && (
              <p className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2 mt-5 max-w-xs">
                {error}
              </p>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-[260px_1fr]">
            <div className="border-b md:border-b-0 md:border-r border-[#3D4331]/10 py-4 max-h-[420px] overflow-y-auto">
              <p className="px-6 pb-3 text-[10px] font-black uppercase tracking-widest text-[#3D4331]/45">
                Select a wallet
              </p>

              {ordered.map((c) => {
                const active = selected?.uid === c.uid;
                const ready = readyIds.has(c.id);
                const icon = (c as any).icon as string | undefined;
                const unusableHere = mobile && !isWalletConnect(c) && !isCoinbase(c) && !ready;

                return (
                  <button
                    key={c.uid}
                    onClick={() => handleSelect(c)}
                    disabled={connecting}
                    className={`w-full flex items-center gap-3 px-6 py-3 text-left transition-colors disabled:opacity-60 ${
                      active ? "bg-[#EBE1D0]" : "hover:bg-[#EBE1D0]/60"
                    } ${unusableHere ? "opacity-50" : ""}`}
                  >
                    <span className="w-8 h-8 rounded-lg bg-white border border-[#3D4331]/10 flex items-center justify-center overflow-hidden shrink-0">
                      {icon ? (
                        <img src={icon} alt="" className="w-full h-full object-cover" />
                      ) : isWalletConnect(c) ? (
                        <QrCode size={16} className="text-[#3D4331]" />
                      ) : (
                        <Wallet size={16} className="text-[#3D4331]" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-[#3D4331] truncate">{c.name}</span>
                      <span
                        className={`block text-[10px] font-bold uppercase tracking-wider ${
                          ready && !isWalletConnect(c) ? "text-[#7d8f5c]" : "text-[#3D4331]/40"
                        }`}
                      >
                        {connectorHint(c, ready, mobile)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="p-8 flex flex-col items-center justify-center text-center min-h-[320px]">
              {!selected && (
                <>
                  <div className="bg-white rounded-2xl px-10 py-6 border border-[#3D4331]/10 mb-5 flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-[#3D4331]/60" />
                    <p className="text-sm font-bold text-[#3D4331] text-left">Mint your booking as an NFT</p>
                  </div>
                  <p className="text-sm font-medium text-[#3D4331]/60 max-w-xs">
                    Choose a wallet on the left to connect and claim your NFT ticket.
                  </p>
                </>
              )}

              {selected && isWalletConnect(selected) && (
                <>
                  {mobile ? (
                    <>
                      <p className="text-sm font-bold text-[#3D4331] mb-5 max-w-xs">
                        Open your wallet app to connect
                      </p>
                      <a
                        href={wcUri || undefined}
                        aria-disabled={!wcUri}
                        className={`inline-flex items-center gap-2 bg-[#3D4331] text-[#F3EDE0] font-bold py-3 px-7 rounded-full uppercase tracking-widest text-xs transition-opacity ${
                          wcUri ? "hover:opacity-90" : "opacity-50 pointer-events-none"
                        }`}
                      >
                        {wcUri ? (
                          <>
                            <ExternalLink size={14} /> Open Wallet App
                          </>
                        ) : (
                          <>
                            <Loader2 size={14} className="animate-spin" /> Preparing…
                          </>
                        )}
                      </a>

                      <details className="mt-6 text-left w-full max-w-[230px]">
                        <summary className="text-[10px] font-bold uppercase tracking-widest text-[#3D4331]/40 cursor-pointer text-center">
                          Or scan with another device
                        </summary>
                        <div className="bg-white p-3 rounded-2xl border border-[#3D4331]/15 shadow-sm mt-3 mx-auto w-fit">
                          {qrDataUrl ? (
                            <img src={qrDataUrl} alt="WalletConnect QR code" className="w-[160px] h-[160px] block" />
                          ) : (
                            <div className="w-[160px] h-[160px] flex items-center justify-center">
                              <Loader2 className="w-6 h-6 animate-spin text-[#3D4331]/40" />
                            </div>
                          )}
                        </div>
                      </details>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-[#3D4331] mb-5 max-w-xs">
                        Scan with your wallet app to connect
                      </p>
                      <div className="bg-white p-4 rounded-2xl border border-[#3D4331]/15 shadow-sm">
                        {qrDataUrl ? (
                          <img src={qrDataUrl} alt="WalletConnect QR code" className="w-[230px] h-[230px] block" />
                        ) : (
                          <div className="w-[230px] h-[230px] flex items-center justify-center">
                            <Loader2 className="w-7 h-7 animate-spin text-[#3D4331]/40" />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#3D4331]/40 mt-4">
                    480+ wallets supported
                  </p>
                </>
              )}

              {selected && !isWalletConnect(selected) && (
                <>
                  <span className="w-16 h-16 rounded-2xl bg-white border border-[#3D4331]/10 flex items-center justify-center overflow-hidden mb-5">
                    {(selected as any).icon ? (
                      <img src={(selected as any).icon} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Wallet size={26} className="text-[#3D4331]" />
                    )}
                  </span>
                  <p className="text-lg font-serif font-black text-[#3D4331]">{selected.name}</p>
                  <p className="text-sm font-medium text-[#3D4331]/60 mt-2 mb-6 max-w-xs">
                    {connecting
                      ? "Approve the connection request in your wallet."
                      : "Continue in your wallet extension to connect."}
                  </p>

                  <button
                    onClick={() => handleSelect(selected)}
                    disabled={connecting}
                    className="inline-flex items-center gap-2 bg-[#3D4331] text-[#F3EDE0] font-bold py-3 px-7 rounded-full uppercase tracking-widest text-xs hover:opacity-90 disabled:opacity-60 transition-opacity"
                  >
                    {connecting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Waiting…
                      </>
                    ) : (
                      <>
                        <ExternalLink size={14} /> Launch {selected.name}
                      </>
                    )}
                  </button>
                </>
              )}

              {error && (
                <p className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2 mt-5 max-w-xs">
                  {error}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="px-8 py-4 border-t border-[#3D4331]/10 bg-[#EBE1D0]/40">
          <p className="text-[10px] text-center font-bold uppercase tracking-widest text-[#3D4331]/45">
            {claiming
              ? "Don't close this window until your wallet finishes"
              : "Your wallet disconnects automatically once this window closes"}
          </p>
        </div>
      </div>
    </div>
  );
}
