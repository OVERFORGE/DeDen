"use client";

import { useState, useEffect } from "react";
import { ApproveWaitlistButton } from "@/components/ApproveWaitlistButton";

// Define the types for our data
type Booking = {
  bookingId: string;
  status: string;
  guestName: string;
  guestEmail: string;
  paymentAmount?: number;
  paymentToken?: string;
  expiresAt?: string;
  confirmedAt?: string;
  createdAt: string;
  stay: {
    title: string;
  };
  user: {
    walletAddress: string;
    displayName: string;
    email: string;
  };
};

type TabType = "WAITLISTED" | "PENDING" | "CONFIRMED" | "ALL";

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("WAITLISTED");

  // Fetch bookings based on active tab
  const fetchBookings = async (status?: TabType) => {
    try {
      setLoading(true);
      setError(null);
      
      let url = '/api/admin/bookings';
      if (status && status !== "ALL") {
        url += `?status=${status}`;
      }
      
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to fetch bookings');
      }
      const data = await res.json();
      setBookings(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings(activeTab);
  }, [activeTab]);

  const handleApproved = () => {
    // Refresh the list after approval
    fetchBookings(activeTab);
  };

  const getStatusBadge = (status: string) => {
    const statusStyles: Record<string, any> = {
      WAITLISTED: { bg: '#fef3c7', color: '#92400e', label: '⏳ Waitlisted' },
      PENDING: { bg: '#dbeafe', color: '#1e40af', label: '💳 Pending Payment' },
      CONFIRMED: { bg: '#d1fae5', color: '#065f46', label: '✅ Confirmed' },
      CANCELLED: { bg: '#fee2e2', color: '#991b1b', label: '❌ Cancelled' },
      EXPIRED: { bg: '#f3f4f6', color: '#374151', label: '⌛ Expired' },
    };

    const style = statusStyles[status] || { bg: '#f3f4f6', color: '#374151', label: status };
    
    return (
      <span style={{
        backgroundColor: style.bg,
        color: style.color,
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '0.85rem',
        fontWeight: '600',
      }}>
        {style.label}
      </span>
    );
  };

  const stats = {
    waitlisted: bookings.filter(b => b.status === 'WAITLISTED').length,
    pending: bookings.filter(b => b.status === 'PENDING').length,
    confirmed: bookings.filter(b => b.status === 'CONFIRMED').length,
    total: bookings.length,
  };

  return (
    <div style={styles.container}>
      <h2>Admin Dashboard - Booking Management</h2>
      
      {error && <div style={styles.error}>{error}</div>}
      
      {/* Stats Cards */}
      <div style={styles.statsBox}>
        <div style={styles.stat}>
          <div style={styles.statNumber}>{stats.waitlisted}</div>
          <div style={styles.statLabel}>Pending Approval</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statNumber}>{stats.pending}</div>
          <div style={styles.statLabel}>Awaiting Payment</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statNumber}>{stats.confirmed}</div>
          <div style={styles.statLabel}>Confirmed</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statNumber}>{stats.total}</div>
          <div style={styles.statLabel}>Total Bookings</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          onClick={() => setActiveTab("WAITLISTED")}
          style={{
            ...styles.tab,
            ...(activeTab === "WAITLISTED" ? styles.activeTab : {}),
          }}
        >
          Pending Approval ({stats.waitlisted})
        </button>
        <button
          onClick={() => setActiveTab("PENDING")}
          style={{
            ...styles.tab,
            ...(activeTab === "PENDING" ? styles.activeTab : {}),
          }}
        >
          Awaiting Payment ({stats.pending})
        </button>
        <button
          onClick={() => setActiveTab("CONFIRMED")}
          style={{
            ...styles.tab,
            ...(activeTab === "CONFIRMED" ? styles.activeTab : {}),
          }}
        >
          Confirmed ({stats.confirmed})
        </button>
        <button
          onClick={() => setActiveTab("ALL")}
          style={{
            ...styles.tab,
            ...(activeTab === "ALL" ? styles.activeTab : {}),
          }}
        >
          All Bookings ({stats.total})
        </button>
      </div>

      {/* Table */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Booking ID</th>
              <th style={styles.th}>Stay</th>
              <th style={styles.th}>Guest</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Wallet</th>
              <th style={styles.th}>Status</th>
              {activeTab !== "WAITLISTED" && <th style={styles.th}>Amount</th>}
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={styles.td}>
                  <div style={styles.loading}>Loading...</div>
                </td>
              </tr>
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan={9} style={styles.td}>
                  <div style={styles.empty}>
                    No {activeTab.toLowerCase()} bookings found.
                  </div>
                </td>
              </tr>
            ) : (
              bookings.map((booking) => (
                <tr key={booking.bookingId} style={styles.tr}>
                  <td style={styles.td}>
                    <code style={styles.code}>{booking.bookingId}</code>
                  </td>
                  <td style={styles.td}>
                    <strong>{booking.stay.title}</strong>
                  </td>
                  <td style={styles.td}>
                    {booking.user.displayName || booking.guestName}
                  </td>
                  <td style={styles.td}>
                    <a 
                      href={`mailto:${booking.user.email || booking.guestEmail}`}
                      style={styles.emailLink}
                    >
                      {booking.user.email || booking.guestEmail}
                    </a>
                  </td>
                  <td style={styles.td}>
                    <code style={styles.walletCode} title={booking.user.walletAddress}>
                      {booking.user.walletAddress.substring(0, 6)}...
                      {booking.user.walletAddress.substring(
                        booking.user.walletAddress.length - 4
                      )}
                    </code>
                  </td>
                  <td style={styles.td}>
                    {getStatusBadge(booking.status)}
                  </td>
                  {activeTab !== "WAITLISTED" && (
                    <td style={styles.td}>
                      {booking.paymentAmount ? (
                        <span style={styles.amount}>
                          ${booking.paymentAmount} {booking.paymentToken}
                        </span>
                      ) : (
                        <span style={{ color: '#999' }}>—</span>
                      )}
                    </td>
                  )}
                  <td style={styles.td}>
                    <div style={styles.dateText}>
                      {new Date(booking.createdAt).toLocaleDateString()}
                    </div>
                    <div style={styles.timeText}>
                      {new Date(booking.createdAt).toLocaleTimeString()}
                    </div>
                  </td>
                  <td style={styles.td}>
                    {booking.status === 'WAITLISTED' ? (
                      <ApproveWaitlistButton 
                        bookingId={booking.bookingId}
                        onApproved={handleApproved}
                      />
                    ) : booking.status === 'PENDING' ? (
                      <a 
                        href={`/booking/${booking.bookingId}`}
                        target="_blank"
                        style={styles.viewLink}
                      >
                        View Payment
                      </a>
                    ) : booking.status === 'CONFIRMED' ? (
                      <span style={{ color: '#10b981', fontWeight: '600' }}>
                        ✓ Paid
                      </span>
                    ) : (
                      <span style={{ color: '#999' }}>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Styling ---
const styles = {
  container: {
    fontFamily: "Arial, sans-serif",
    maxWidth: "1600px",
    margin: "0 auto",
    padding: "20px",
  },
  error: {
    color: "#c00",
    backgroundColor: "#ffebee",
    padding: "12px",
    borderRadius: "6px",
    marginBottom: "20px",
    border: "1px solid #fcc",
  },
  statsBox: {
    display: "flex",
    gap: "20px",
    marginBottom: "30px",
    flexWrap: "wrap" as const,
  },
  stat: {
    backgroundColor: "white",
    padding: "24px",
    borderRadius: "8px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    minWidth: "150px",
    flex: "1",
  },
  statNumber: {
    fontSize: "2.5rem",
    fontWeight: "bold",
    color: "#0070f3",
  },
  statLabel: {
    fontSize: "0.9rem",
    color: "#666",
    marginTop: "8px",
  },
  tabs: {
    display: "flex",
    gap: "8px",
    marginBottom: "20px",
    borderBottom: "2px solid #e0e0e0",
  },
  tab: {
    padding: "12px 24px",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: "3px solid transparent",
    cursor: "pointer",
    fontSize: "0.95rem",
    fontWeight: "500",
    color: "#666",
    transition: "all 0.2s",
  },
  activeTab: {
    color: "#0070f3",
    borderBottomColor: "#0070f3",
    fontWeight: "600",
  },
  tableContainer: {
    backgroundColor: "white",
    borderRadius: "8px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    overflow: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
  },
  th: {
    padding: "12px 16px",
    textAlign: "left" as const,
    backgroundColor: "#f5f5f5",
    fontWeight: "600",
    fontSize: "0.85rem",
    color: "#333",
    borderBottom: "2px solid #e0e0e0",
    whiteSpace: "nowrap" as const,
  },
  tr: {
    borderBottom: "1px solid #e0e0e0",
    transition: "background-color 0.2s",
  },
  td: {
    padding: "12px 16px",
    fontSize: "0.9rem",
    color: "#333",
  },
  code: {
    backgroundColor: "#f5f5f5",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "0.8rem",
    fontFamily: "monospace",
  },
  walletCode: {
    backgroundColor: "#e3f2fd",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "0.8rem",
    fontFamily: "monospace",
    color: "#1976d2",
    cursor: "help",
  },
  emailLink: {
    color: "#0070f3",
    textDecoration: "none",
  },
  amount: {
    fontWeight: "600",
    color: "#059669",
  },
  dateText: {
    fontSize: "0.9rem",
    color: "#333",
  },
  timeText: {
    fontSize: "0.8rem",
    color: "#999",
    marginTop: "2px",
  },
  viewLink: {
    color: "#0070f3",
    textDecoration: "none",
    fontSize: "0.9rem",
    fontWeight: "500",
  },
  loading: {
    textAlign: "center" as const,
    padding: "40px",
    color: "#666",
  },
  empty: {
    textAlign: "center" as const,
    padding: "40px",
    color: "#999",
  },
} as const;