// File: app/admin/check-in/page.tsx
// Door-staff tool: scan a guest's ticket QR (or type the code by hand if the
// camera/lighting isn't cooperating), confirm identity, check them in.
//
// The QR encodes a signed qrToken, verified read-only via /api/tickets/verify
// before anything is mutated. Manual entry has no token to verify (staff only
// ever sees the ticketCode printed under the QR), so it skips straight to
// check-in — the guest name comes back in that response either way.

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  QrCode,
  Camera,
  CameraOff,
  Keyboard,
  CheckCircle2,
  XCircle,
  Loader2,
  User,
  Calendar,
  RotateCcw,
  Users,
  ChevronDown,
} from "lucide-react";

type Stay = {
  id: string;
  stayId: string;
  title: string;
  status: string;
};

type PendingTicket = {
  ticketCode: string;
  guestName: string | null;
  status: string;
  checkedInAt: string | null;
  stayTitle: string;
  bookingId: string;
};

type Feedback = {
  kind: "success" | "error";
  message: string;
  guestName?: string | null;
};

type RosterGuest = {
  bookingId: string;
  bookingStatus: string;
  guestIndex: number;
  isPrimary: boolean;
  fullName: string | null;
  ticketCode: string | null;
  ticketStatus: string | null;
  checkedInAt: string | null;
};

export default function AdminCheckInPage() {
  const [stays, setStays] = useState<Stay[]>([]);
  const [selectedStayId, setSelectedStayId] = useState<string>("");
  const [roster, setRoster] = useState<{ checkedIn: number; totalGuests: number } | null>(null);
  const [rosterGuests, setRosterGuests] = useState<RosterGuest[]>([]);
  const [rosterOpen, setRosterOpen] = useState(false);

  const [cameraOn, setCameraOn] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [pending, setPending] = useState<PendingTicket | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);

  const scannerRef = useRef<any>(null);
  const scanBoxId = "qr-scan-box";

  useEffect(() => {
    fetch("/api/admin/stays")
      .then((res) => res.json())
      .then((data: Stay[]) => {
        setStays(data);
        const live = data.find((s) => s.status !== "DONE");
        if (live) setSelectedStayId(live.id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedStayId) return;
    refreshRoster(selectedStayId);
  }, [selectedStayId]);

  const refreshRoster = async (stayId: string) => {
    try {
      const res = await fetch(`/api/admin/stays/${stayId}/guests`);
      const data = await res.json();
      if (res.ok) {
        setRoster({ checkedIn: data.checkedIn, totalGuests: data.totalGuests });
        setRosterGuests(data.guests);
      }
    } catch {
      // Non-critical
    }
  };

  useEffect(() => {
    if (!cameraOn) {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
      return;
    }

    let cancelled = false;
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      const scanner = new Html5Qrcode(scanBoxId);
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            handleScan(decodedText);
          },
          () => {
            // per-frame "no QR found" noise — ignored
          }
        );
      } catch (err: any) {
        setFeedback({ kind: "error", message: err?.message || "Could not access camera" });
        setCameraOn(false);
      }
    })();

    return () => {
      cancelled = true;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [cameraOn]);

  const handleScan = async (qrToken: string) => {
    if (busy || pending) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/tickets/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken }),
      });
      const data = await res.json();
      if (!data.valid) {
        setFeedback({ kind: "error", message: data.error || "Invalid ticket" });
        return;
      }
      setPending({
        ticketCode: data.ticket.ticketCode,
        guestName: data.ticket.guestName,
        status: data.ticket.status,
        checkedInAt: data.ticket.checkedInAt,
        stayTitle: data.ticket.stay?.title || "",
        bookingId: data.ticket.bookingId,
      });
    } catch (err: any) {
      setFeedback({ kind: "error", message: err.message || "Verification failed" });
    } finally {
      setBusy(false);
    }
  };

  const handleManualLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code || busy) return;
    // No signed token from manual entry — go straight to check-in and let
    // the response tell us who it was.
    await confirmCheckIn(code, true);
    setManualCode("");
  };

  const confirmCheckIn = async (ticketCode: string, isManual = false) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/tickets/${ticketCode}/check-in`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ kind: "error", message: data.error || "Check-in failed" });
        return;
      }
      setFeedback({
        kind: "success",
        message: isManual ? `Checked in: ${ticketCode}` : "Checked in",
        guestName: pending?.guestName,
      });
      if (selectedStayId) refreshRoster(selectedStayId);
    } catch (err: any) {
      setFeedback({ kind: "error", message: err.message || "Check-in failed" });
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const reset = () => {
    setPending(null);
    setFeedback(null);
  };

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-black font-display tracking-tight flex items-center gap-2">
            <QrCode size={26} /> Check-In
          </h1>
          <p className="text-xs font-bold text-[#5a6b3a] uppercase tracking-widest mt-1">
            Scan a guest's ticket at the door
          </p>
        </div>

        {stays.length > 0 && (
          <select
            value={selectedStayId}
            onChange={(e) => setSelectedStayId(e.target.value)}
            className="py-2 px-3 bg-white border-2 border-[#2c331f] rounded-xl text-xs font-bold uppercase tracking-widest"
          >
            {stays.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {roster && (
        <div className="bg-[#2c331f] text-[#f7eedb] rounded-2xl p-4 mb-6 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest opacity-80">Checked In</span>
          <span className="text-2xl font-black font-display">
            {roster.checkedIn} / {roster.totalGuests}
          </span>
        </div>
      )}

      {/* Guest roster */}
      {rosterGuests.length > 0 && (
        <div className="bg-white border-2 border-[#2c331f] rounded-2xl mb-6 shadow-[3px_3px_0px_0px_#2c331f] overflow-hidden">
          <button
            onClick={() => setRosterOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4"
          >
            <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Users size={16} /> Guest Roster
            </h2>
            <ChevronDown size={16} className={`transition-transform ${rosterOpen ? "rotate-180" : ""}`} />
          </button>
          {rosterOpen && (
            <div className="max-h-[360px] overflow-y-auto border-t border-[#2c331f]/10">
              {rosterGuests.map((g, i) => (
                <div
                  key={`${g.bookingId}:${g.guestIndex}`}
                  className={`flex items-center justify-between gap-3 px-5 py-3 ${i !== rosterGuests.length - 1 ? "border-b border-[#2c331f]/10" : ""}`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-black truncate">
                      {g.fullName || `Guest ${g.guestIndex + 1}`}
                      {g.isPrimary && <span className="ml-1.5 text-[9px] font-bold text-[#5a6b3a] uppercase">Primary</span>}
                    </div>
                    <div className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
                      {g.bookingId} · {g.bookingStatus}
                    </div>
                  </div>
                  {g.ticketStatus === "CHECKED_IN" ? (
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest bg-[#9db47d] text-[#2c331f] px-2.5 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 size={11} /> In
                    </span>
                  ) : g.ticketCode ? (
                    <button
                      onClick={() => confirmCheckIn(g.ticketCode!)}
                      disabled={busy}
                      className="shrink-0 text-[9px] font-bold uppercase tracking-widest bg-[#f7eedb] border border-[#2c331f] px-2.5 py-1 rounded-full disabled:opacity-40"
                    >
                      Check In
                    </button>
                  ) : (
                    <span className="shrink-0 text-[9px] font-bold text-[#5a6b3a] uppercase tracking-widest">No ticket</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pending confirmation card */}
      {pending && (
        <div className="bg-white border-2 border-[#2c331f] rounded-2xl p-6 mb-6 shadow-[3px_3px_0px_0px_#2c331f]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#e8c37b] flex items-center justify-center shrink-0">
              <User size={18} className="text-[#2c331f]" />
            </div>
            <div>
              <div className="font-black text-lg">{pending.guestName || "Guest"}</div>
              <div className="text-xs font-bold text-[#5a6b3a] flex items-center gap-1">
                <Calendar size={12} /> {pending.stayTitle}
              </div>
            </div>
          </div>
          <code className="block text-[10px] font-bold text-[#5a6b3a] tracking-widest mb-4">
            {pending.ticketCode}
          </code>

          {pending.status === "CHECKED_IN" ? (
            <p className="text-xs font-bold text-red-700 mb-3">
              Already checked in{pending.checkedInAt ? ` at ${new Date(pending.checkedInAt).toLocaleTimeString()}` : ""}.
            </p>
          ) : pending.status === "VOID" ? (
            <p className="text-xs font-bold text-red-700 mb-3">This ticket has been voided.</p>
          ) : null}

          <div className="flex gap-2">
            <button
              onClick={() => confirmCheckIn(pending.ticketCode)}
              disabled={busy || pending.status !== "ISSUED"}
              className="flex-1 py-3 bg-[#9db47d] border-2 border-[#2c331f] rounded-xl font-bold uppercase tracking-widest text-xs disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Confirm Check-In
            </button>
            <button
              onClick={reset}
              className="py-3 px-5 bg-[#f7eedb] border-2 border-[#2c331f] rounded-xl font-bold uppercase tracking-widest text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Feedback toast */}
      {feedback && !pending && (
        <div
          className={`rounded-2xl p-4 mb-6 border-2 border-[#2c331f] flex items-center justify-between gap-3 ${
            feedback.kind === "success" ? "bg-[#9db47d]" : "bg-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.kind === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            <span className="text-xs font-bold">
              {feedback.guestName ? `${feedback.guestName} — ` : ""}
              {feedback.message}
            </span>
          </div>
          <button onClick={reset} className="shrink-0">
            <RotateCcw size={14} />
          </button>
        </div>
      )}

      {/* Camera scanner */}
      {!pending && (
        <div className="bg-white border-2 border-[#2c331f] rounded-2xl p-5 mb-6 shadow-[3px_3px_0px_0px_#2c331f]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Camera size={16} /> Camera
            </h2>
            <button
              onClick={() => setCameraOn((v) => !v)}
              className="py-2 px-4 bg-[#2c331f] text-[#f7eedb] rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center gap-2"
            >
              {cameraOn ? <CameraOff size={13} /> : <Camera size={13} />}
              {cameraOn ? "Stop" : "Start Scanning"}
            </button>
          </div>
          <div
            id={scanBoxId}
            className={`w-full rounded-xl overflow-hidden border-2 border-[#2c331f]/20 ${cameraOn ? "min-h-[280px]" : "hidden"}`}
          />
          {!cameraOn && (
            <p className="text-xs font-medium text-[#5a6b3a] text-center py-8">
              Tap "Start Scanning" and point the camera at a guest's ticket QR.
            </p>
          )}
        </div>
      )}

      {/* Manual fallback */}
      {!pending && (
        <div className="bg-white border-2 border-[#2c331f] rounded-2xl p-5 shadow-[3px_3px_0px_0px_#2c331f]">
          <h2 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
            <Keyboard size={16} /> Manual Entry
          </h2>
          <form onSubmit={handleManualLookup} className="flex gap-2">
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="TKT-STAY-XXXX-1"
              className="flex-1 py-3 px-4 bg-[#f7eedb] border-2 border-[#2c331f] rounded-xl text-xs font-bold uppercase tracking-widest"
            />
            <button
              type="submit"
              disabled={busy || !manualCode.trim()}
              className="py-3 px-6 bg-[#2c331f] text-[#f7eedb] rounded-xl font-bold uppercase tracking-widest text-xs disabled:opacity-40"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : "Check In"}
            </button>
          </form>
          <p className="text-[10px] font-medium text-[#5a6b3a] mt-2">
            Use the code printed under a guest's ticket if the camera can't read it. Checks in immediately — no separate confirm step.
          </p>
        </div>
      )}

      <Link
        href="/admin/bookings"
        className="block text-center mt-6 text-xs font-bold uppercase tracking-widest text-[#5a6b3a] hover:text-[#2c331f]"
      >
        Back to Bookings
      </Link>
    </div>
  );
}
