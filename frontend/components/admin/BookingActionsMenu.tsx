// File: components/admin/BookingActionsMenu.tsx
// Row-level "more actions" menu for admin/bookings — wires up 3 endpoints
// that existed but had no UI: refund, override-status, resend-email.

"use client";

import { useState } from "react";
import { MoreVertical, X, Loader2 } from "lucide-react";

const BOOKING_STATUSES = [
  "WAITLISTED",
  "PENDING",
  "RESERVED",
  "CONFIRMED",
  "CANCELLED",
  "REFUNDED",
  "EXPIRED",
  "FAILED",
];

const REFUNDABLE_STATUSES = ["CONFIRMED", "RESERVED"];
const RESENDABLE_STATUSES = ["PENDING", "RESERVED", "CONFIRMED"];

export function BookingActionsMenu({
  bookingId,
  status,
  onDone,
}: {
  bookingId: string;
  status: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<"refund" | "override" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refund form
  const [refundReason, setRefundReason] = useState("");
  const [refundTxHash, setRefundTxHash] = useState("");

  // Override form
  const [overrideStatus, setOverrideStatus] = useState(status);
  const [overrideNotes, setOverrideNotes] = useState("");

  const closeAll = () => {
    setOpen(false);
    setModal(null);
    setError(null);
  };

  const handleResendEmail = async () => {
    setOpen(false);
    if (!confirm(`Resend the current lifecycle email for ${bookingId}?`)) return;
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/resend-email`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend email");
      alert(`Email resent (${data.emailType}).`);
    } catch (err: any) {
      alert(`Resend failed: ${err.message}`);
    }
  };

  const submitRefund = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: refundReason || undefined,
          refundTxHash: refundTxHash || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refund failed");
      alert(`Refund recorded: $${data.refund.amount} ${data.refund.token}${data.emailSent ? " — guest notified" : ""}`);
      closeAll();
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitOverride = async () => {
    if (!overrideNotes.trim()) {
      setError("A reason is required to override status");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/override-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: overrideStatus, adminNotes: overrideNotes.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Override failed");
      closeAll();
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-lg border-2 border-[#2c331f]/20 hover:border-[#2c331f] text-[#2c331f] transition-colors"
        title="More actions"
      >
        <MoreVertical size={14} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-44 bg-white border-2 border-[#2c331f] rounded-xl shadow-[3px_3px_0px_0px_#2c331f] overflow-hidden">
            {REFUNDABLE_STATUSES.includes(status) && (
              <button
                onClick={() => { setModal("refund"); setOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-[#f7eedb]"
              >
                Refund
              </button>
            )}
            <button
              onClick={() => { setModal("override"); setOverrideStatus(status); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-[#f7eedb]"
            >
              Override Status
            </button>
            {RESENDABLE_STATUSES.includes(status) && (
              <button
                onClick={handleResendEmail}
                className="w-full text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-[#f7eedb]"
              >
                Resend Email
              </button>
            )}
          </div>
        </>
      )}

      {modal && (
        <div className="fixed inset-0 bg-[#2c331f]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeAll}>
          <div
            className="bg-white border-2 border-[#2c331f] rounded-2xl shadow-[4px_4px_0px_0px_#2c331f] p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-widest">
                {modal === "refund" ? "Refund Booking" : "Override Status"}
              </h3>
              <button onClick={closeAll}><X size={18} /></button>
            </div>

            {modal === "refund" && (
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">{bookingId}</p>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#5a6b3a] block mb-1">Reason (optional)</label>
                  <textarea
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="w-full p-2.5 border-2 border-[#2c331f]/30 rounded-lg text-xs"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#5a6b3a] block mb-1">
                    Refund tx hash (if already sent on-chain)
                  </label>
                  <input
                    value={refundTxHash}
                    onChange={(e) => setRefundTxHash(e.target.value)}
                    placeholder="0x..."
                    className="w-full p-2.5 border-2 border-[#2c331f]/30 rounded-lg text-xs font-mono"
                  />
                </div>
                <p className="text-[10px] font-medium text-[#5a6b3a]">
                  This marks the booking REFUNDED and releases its slots. The on-chain payout itself is manual — send it yourself and paste the tx hash here, or leave it blank to record the refund as requested.
                </p>
                {error && <p className="text-xs font-bold text-red-600">{error}</p>}
                <button
                  onClick={submitRefund}
                  disabled={busy}
                  className="w-full py-2.5 bg-[#2c331f] text-[#f7eedb] rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {busy && <Loader2 size={14} className="animate-spin" />}
                  Confirm Refund
                </button>
              </div>
            )}

            {modal === "override" && (
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">{bookingId} — currently {status}</p>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#5a6b3a] block mb-1">New status</label>
                  <select
                    value={overrideStatus}
                    onChange={(e) => setOverrideStatus(e.target.value)}
                    className="w-full p-2.5 border-2 border-[#2c331f]/30 rounded-lg text-xs font-bold"
                  >
                    {BOOKING_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#5a6b3a] block mb-1">
                    Reason (required — this bypasses every normal guard)
                  </label>
                  <textarea
                    value={overrideNotes}
                    onChange={(e) => setOverrideNotes(e.target.value)}
                    className="w-full p-2.5 border-2 border-[#2c331f]/30 rounded-lg text-xs"
                    rows={3}
                  />
                </div>
                {error && <p className="text-xs font-bold text-red-600">{error}</p>}
                <button
                  onClick={submitOverride}
                  disabled={busy || overrideStatus === status}
                  className="w-full py-2.5 bg-[#2c331f] text-[#f7eedb] rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {busy && <Loader2 size={14} className="animate-spin" />}
                  Confirm Override
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
