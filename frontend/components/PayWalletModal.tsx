// File: components/PayWalletModal.tsx
//
// Self-contained pay-time wallet picker. Deliberately does NOT open
// ConnectKit's own modal — that renders its own dark chrome on top of the
// page and looks nothing like the rest of the site. Instead this drives
// wagmi's connectors directly and renders the wallet list + WalletConnect
// QR itself, in the platform's cream/olive theme.
//
// Wallet connection is scoped to this modal's lifetime: connecting happens
// here, and the wallet is disconnected the moment the modal unmounts.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, type Connector } from "wagmi";
import QRCode from "qrcode";
import { X, Wallet, CheckCircle2, Loader2, ExternalLink, QrCode } from "lucide-react";

interface PayWalletModalProps {
  amountLabel: string;
  chainName: string;
  sending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

function isWalletConnect(c: Connector) {
  return c.id === "walletConnect" || c.type === "walletConnect";
}

// Coinbase's own SDK handles its mobile fallback internally (it opens its
// app / shows its own connect flow when no extension is present), so it
// doesn't need the same "no provider on mobile" handling as a plain
// injected() connector like MetaMask does.
function isCoinbase(c: Connector) {
  return c.id === "coinbaseWalletSDK" || c.id === "coinbaseWallet";
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Short, friendly sub-label under each wallet name. */
function connectorHint(c: Connector, ready: boolean, mobile: boolean) {
  if (isWalletConnect(c)) return mobile ? "Opens your wallet app" : "Scan with any wallet";
  if (isCoinbase(c)) return "Extension or mobile";
  if (mobile && !ready) return "Not available in this browser";
  return ready ? "Installed" : "Not detected";
}

export function PayWalletModal({ amountLabel, chainName, sending, onConfirm, onClose }: PayWalletModalProps) {
  const { connectors, connectAsync, status: connectStatus } = useConnect();
  const { disconnect } = useDisconnect();
  const { address, isConnected } = useAccount();

  const [selected, setSelected] = useState<Connector | null>(null);
  const [wcUri, setWcUri] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readyIds, setReadyIds] = useState<Set<string>>(new Set());
  // Computed once on mount rather than per-render — the device class doesn't
  // change mid-session, and this avoids a hydration mismatch from reading
  // navigator during SSR.
  const [mobile, setMobile] = useState(false);
  useEffect(() => setMobile(isMobileDevice()), []);

  const cleanupRef = useRef<null | (() => void)>(null);

  // Disconnect when the modal goes away — no wallet session outlives payment.
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      disconnect();
    };
  }, [disconnect]);

  // Which injected connectors actually have a provider available right now.
  //
  // Keyed on the connector UIDs rather than the array itself: wagmi returns a
  // fresh array identity on most renders, so depending on `connectors`
  // directly makes this effect re-run → setState → re-render, forever.
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

  // Desktop: real extensions first, WalletConnect as the catch-all last.
  //
  // Mobile: flipped. A plain injected connector (MetaMask, etc. without its
  // own SDK) has nothing to talk to in a phone browser — window.ethereum
  // simply doesn't exist there — so tapping it can only ever hang. Leading
  // with WalletConnect means the working path is what people see first,
  // instead of a MetaMask button that looks connectable but silently isn't.
  const ordered = useMemo(() => {
    const wc = connectors.filter(isWalletConnect);
    const rest = connectors.filter((c) => !isWalletConnect(c));
    rest.sort((a, b) => Number(readyIds.has(b.id)) - Number(readyIds.has(a.id)));
    return mobile ? [...wc, ...rest] : [...rest, ...wc];
  }, [connectors, readyIds, mobile]);

  // Render the WalletConnect pairing URI as a QR in our own palette.
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

      // A plain injected connector with no detected provider, on mobile, has
      // nothing to connect to — there's no extension for it to find. Calling
      // connectAsync here just hangs on "Waiting…" indefinitely, which is
      // exactly what was reported: tapping MetaMask on a phone appeared to
      // do nothing. Stop before that happens and point at what actually
      // works instead.
      if (mobile && !isWalletConnect(connector) && !isCoinbase(connector) && !readyIds.has(connector.id)) {
        setError(
          `${connector.name} isn't available in your phone's browser. Use WalletConnect below to open your wallet app instead.`
        );
        return;
      }

      try {
        if (isWalletConnect(connector)) {
          // Grab the pairing URI so we can draw the QR ourselves instead of
          // letting WalletConnect pop its own modal.
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

  // Sealed while a transaction is in flight: unmounting would disconnect
  // mid-send, and the tx could still land on-chain with no way to report
  // its hash back for verification.
  const requestClose = () => {
    if (sending) return;
    onClose();
  };

  const connecting = connectStatus === "pending";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={requestClose}
    >
      <div className="absolute inset-0 bg-[#3D4331]/60 backdrop-blur-sm" />

      <div
        className="relative bg-[#F3EDE0] rounded-[28px] border border-[#3D4331]/15 shadow-2xl w-full max-w-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-8 pt-7 pb-5 border-b border-[#3D4331]/10">
          <div>
            <h3 className="text-2xl font-serif font-black text-[#3D4331] leading-tight">
              Complete Payment
            </h3>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#3D4331]/50 mt-1">
              {amountLabel} · {chainName}
            </p>
          </div>
          <button
            onClick={requestClose}
            disabled={sending}
            title={sending ? "Payment in progress" : "Close"}
            className="w-9 h-9 rounded-full bg-white border border-[#3D4331]/10 flex items-center justify-center hover:bg-[#EBE1D0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <X size={16} className="text-[#3D4331]" />
          </button>
        </div>

        {/* Connected → confirm. Otherwise → picker. */}
        {isConnected ? (
          <div className="px-8 py-10 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-[#3D4331] flex items-center justify-center mb-5">
              <CheckCircle2 className="w-7 h-7 text-[#F3EDE0]" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#3D4331]/50">
              Wallet connected
            </p>
            <p className="font-mono text-sm font-bold text-[#3D4331] mt-1 mb-6 break-all max-w-md">
              {address}
            </p>

            <div className="bg-white rounded-2xl px-10 py-6 border border-[#3D4331]/10 mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#3D4331]/50 mb-1">
                Amount Due
              </p>
              <p className="text-3xl font-black font-serif text-[#3D4331]">{amountLabel}</p>
            </div>

            <button
              onClick={onConfirm}
              disabled={sending}
              className="w-full max-w-sm bg-[#3D4331] text-[#F3EDE0] font-bold py-4 rounded-full flex justify-center items-center gap-3 uppercase tracking-widest text-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
            >
              {sending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Confirm in wallet…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" /> Confirm Payment
                </>
              )}
            </button>

            {!sending && (
              <button
                onClick={() => disconnect()}
                className="mt-3 text-[10px] font-bold uppercase tracking-widest text-[#3D4331]/50 hover:text-[#3D4331] transition-colors"
              >
                Use a different wallet
              </button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-[260px_1fr]">
            {/* ── Left: wallet list ─────────────────────────────── */}
            <div className="border-b md:border-b-0 md:border-r border-[#3D4331]/10 py-4 max-h-[420px] overflow-y-auto">
              <p className="px-6 pb-3 text-[10px] font-black uppercase tracking-widest text-[#3D4331]/45">
                Select a wallet
              </p>

              {ordered.map((c) => {
                const active = selected?.uid === c.uid;
                const ready = readyIds.has(c.id);
                const icon = (c as any).icon as string | undefined;
                // Dimmed, not disabled — still tappable so the explanatory
                // error in handleSelect actually reaches the user, instead
                // of a dead button that looks broken with no explanation.
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
                      <span className="block text-sm font-bold text-[#3D4331] truncate">
                        {c.name}
                      </span>
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

            {/* ── Right: QR / status ────────────────────────────── */}
            <div className="p-8 flex flex-col items-center justify-center text-center min-h-[320px]">
              {!selected && (
                <>
                  <div className="bg-white rounded-2xl px-10 py-6 border border-[#3D4331]/10 mb-5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#3D4331]/50 mb-1">
                      Amount Due
                    </p>
                    <p className="text-3xl font-black font-serif text-[#3D4331]">{amountLabel}</p>
                  </div>
                  <p className="text-sm font-medium text-[#3D4331]/60 max-w-xs">
                    Choose a wallet on the left to connect and confirm your payment.
                  </p>
                </>
              )}

              {selected && isWalletConnect(selected) && (
                <>
                  {mobile ? (
                    <>
                      <p className="text-sm font-bold text-[#3D4331] mb-5 max-w-xs">
                        Open your wallet app to connect and confirm payment
                      </p>

                      {/* Primary path on mobile: a real deep link, not a QR
                          the same phone can't scan. `wc:` URIs are
                          registered as universal/app links by essentially
                          every WalletConnect-compatible wallet (MetaMask,
                          Trust, Rainbow, etc.), so this opens whichever one
                          the guest has installed. */}
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
                        Scan with your wallet app to connect and confirm payment
                      </p>
                      <div className="bg-white p-4 rounded-2xl border border-[#3D4331]/15 shadow-sm">
                        {qrDataUrl ? (
                          <img
                            src={qrDataUrl}
                            alt="WalletConnect QR code"
                            className="w-[230px] h-[230px] block"
                          />
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

        {/* Footer */}
        <div className="px-8 py-4 border-t border-[#3D4331]/10 bg-[#EBE1D0]/40">
          <p className="text-[10px] text-center font-bold uppercase tracking-widest text-[#3D4331]/45">
            {sending
              ? "Don't close this window until your wallet finishes"
              : "Your wallet disconnects automatically once this window closes"}
          </p>
        </div>
      </div>
    </div>
  );
}
