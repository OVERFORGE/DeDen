// File: app/admin/activity/page.tsx
// Admin-facing view of ActivityLog — already written everywhere (approvals,
// payments, refunds, check-ins, referral changes) but previously only
// queryable by hand in the DB.

"use client";

import { useEffect, useState } from "react";
import { History, Loader2, ChevronLeft, ChevronRight, User } from "lucide-react";

type ActivityLogEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  details: any;
  createdAt: string;
  user: { displayName: string | null; email: string | null } | null;
};

const ACTION_LABELS: Record<string, string> = {
  booking_refunded: "Refund issued",
  status_overridden: "Status overridden",
  email_resent: "Email resent",
  tickets_backfilled: "Tickets backfilled",
  ticket_checked_in: "Ticket checked in",
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] || action.replace(/_/g, " ");
}

export default function AdminActivityPage() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/activity?page=${page}&pageSize=30`)
      .then((res) => res.json())
      .then((data) => {
        setLogs(data.logs);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="p-6 md:p-10">
      <h1 className="text-2xl font-black font-display tracking-tight flex items-center gap-2 mb-1">
        <History size={26} /> Activity Log
      </h1>
      <p className="text-xs font-bold text-[#5a6b3a] uppercase tracking-widest mb-6">
        {total} recorded event{total !== 1 ? "s" : ""}
      </p>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#2c331f]/40 animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <p className="text-sm font-bold text-[#5a6b3a]">No activity recorded yet.</p>
      ) : (
        <div className="bg-white border-2 border-[#2c331f] rounded-2xl shadow-[3px_3px_0px_0px_#2c331f] overflow-hidden">
          {logs.map((log, i) => (
            <div
              key={log.id}
              className={`flex items-start gap-4 px-5 py-4 ${i !== logs.length - 1 ? "border-b border-[#2c331f]/10" : ""}`}
            >
              <div className="w-8 h-8 rounded-full bg-[#f7eedb] border border-[#2c331f]/20 flex items-center justify-center shrink-0 mt-0.5">
                <User size={14} className="text-[#5a6b3a]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black">{actionLabel(log.action)}</span>
                  <span className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
                    {log.entity}
                  </span>
                </div>
                {log.details && (
                  <p className="text-[11px] font-medium text-[#5a6b3a] mt-1 truncate">
                    {Object.entries(log.details as Record<string, any>)
                      .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                  </p>
                )}
                <p className="text-[10px] font-bold text-[#2c331f]/50 mt-1">
                  {log.user?.displayName || log.user?.email || "System"} · {new Date(log.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 bg-white border-2 border-[#2c331f] rounded-xl disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-bold uppercase tracking-widest">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 bg-white border-2 border-[#2c331f] rounded-xl disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
