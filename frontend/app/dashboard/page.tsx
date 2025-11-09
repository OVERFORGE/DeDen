// File: app/dashboard/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectKitButton } from 'connectkit';
import Link from 'next/link';

type Booking = {
  bookingId: string;
  status: string;
  guestName: string;
  guestEmail: string;
  paymentAmount: number | null;
  paymentToken: string | null;
  expiresAt: string | null;
  createdAt: string;
  confirmedAt: string | null;
  stay: {
    title: string;
    location: string;
    startDate: string;
    endDate: string;
  };
};

export default function UserDashboard() {
  const { address, isConnected } = useAccount();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address) {
      setLoading(false);
      return;
    }

    async function fetchMyBookings() {
      try {
        setLoading(true);
        setError(null);
        
        const res = await fetch(`/api/user/bookings?wallet=${address}`);
        
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
    }

    fetchMyBookings();
  }, [address, isConnected]);

  const getStatusInfo = (status: string, expiresAt: string | null) => {
    const now = new Date();
    const expiry = expiresAt ? new Date(expiresAt) : null;
    const isExpired = expiry && expiry < now;

    switch (status) {
      case 'WAITLISTED':
        return {
          icon: '⏳',
          label: 'Under Review',
          color: '#f59e0b',
          bg: '#fef3c7',
          message: 'Your application is being reviewed. Well notify you within 24-48 hours.',
        };
      case 'PENDING':
        if (isExpired) {
          return {
            icon: '⌛',
            label: 'Payment Expired',
            color: '#ef4444',
            bg: '#fee2e2',
            message: 'Your payment session expired. Please contact support.',
          };
        }
        return {
          icon: '💳',
          label: 'Payment Required',
          color: '#3b82f6',
          bg: '#dbeafe',
          message: 'Your application was approved! Complete payment to confirm your spot.',
        };
      case 'CONFIRMED':
        return {
          icon: '✅',
          label: 'Confirmed',
          color: '#10b981',
          bg: '#d1fae5',
          message: 'All set! Your spot is confirmed. Check your email for details.',
        };
      case 'CANCELLED':
        return {
          icon: '❌',
          label: 'Cancelled',
          color: '#ef4444',
          bg: '#fee2e2',
          message: 'This booking was cancelled.',
        };
      default:
        return {
          icon: '❓',
          label: status,
          color: '#6b7280',
          bg: '#f3f4f6',
          message: '',
        };
    }
  };

  if (!isConnected) {
    return (
      <div style={styles.container}>
        <div style={styles.connectPrompt}>
          <h2 style={styles.connectTitle}>Connect Your Wallet</h2>
          <p style={styles.connectText}>
            Connect your wallet to view your applications and bookings.
          </p>
          <div style={{ marginTop: '20px' }}>
            <ConnectKitButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>My Applications</h1>
        <p style={styles.subtitle}>
          Wallet: {address?.substring(0, 6)}...{address?.substring(address.length - 4)}
        </p>
      </div>

      {loading ? (
        <div style={styles.loading}>Loading your applications...</div>
      ) : error ? (
        <div style={styles.error}>{error}</div>
      ) : bookings.length === 0 ? (
        <div style={styles.empty}>
          <h3>No Applications Yet</h3>
          <p>You haven't applied to any stays yet.</p>
          <Link href="/" style={styles.browseButton}>
            Browse Available Stays
          </Link>
        </div>
      ) : (
        <div style={styles.bookingsList}>
          {bookings.map((booking) => {
            const statusInfo = getStatusInfo(booking.status, booking.expiresAt);
            return (
              <div key={booking.bookingId} style={styles.bookingCard}>
                {/* Status Badge */}
                <div style={{
                  ...styles.statusBadge,
                  backgroundColor: statusInfo.bg,
                  color: statusInfo.color,
                }}>
                  {statusInfo.icon} {statusInfo.label}
                </div>

                {/* Stay Info */}
                <h3 style={styles.stayTitle}>{booking.stay.title}</h3>
                <p style={styles.stayLocation}>📍 {booking.stay.location}</p>
                <p style={styles.stayDates}>
                  🗓️ {new Date(booking.stay.startDate).toLocaleDateString()} - {new Date(booking.stay.endDate).toLocaleDateString()}
                </p>

                {/* Status Message */}
                <div style={styles.statusMessage}>
                  {statusInfo.message}
                </div>

                {/* Booking Details */}
                <div style={styles.bookingDetails}>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Application ID:</span>
                    <code style={styles.detailValue}>{booking.bookingId}</code>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Applied on:</span>
                    <span style={styles.detailValue}>
                      {new Date(booking.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {booking.paymentAmount && (
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Amount:</span>
                      <span style={styles.detailValue}>
                        ${booking.paymentAmount} {booking.paymentToken}
                      </span>
                    </div>
                  )}
                  {booking.expiresAt && booking.status === 'PENDING' && (
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Payment expires:</span>
                      <span style={{
                        ...styles.detailValue,
                        color: new Date(booking.expiresAt) < new Date() ? '#ef4444' : '#666',
                      }}>
                        {new Date(booking.expiresAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {booking.confirmedAt && (
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Confirmed on:</span>
                      <span style={styles.detailValue}>
                        {new Date(booking.confirmedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {booking.status === 'PENDING' && booking.expiresAt && new Date(booking.expiresAt) > new Date() && (
                  <Link
                    href={`/booking/${booking.bookingId}`}
                    style={styles.payButton}
                  >
                    💳 Complete Payment
                  </Link>
                )}

                {booking.status === 'CONFIRMED' && (
                  <Link
                    href={`/booking/${booking.bookingId}/details`}
                    style={styles.viewButton}
                  >
                    View Booking Details
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    fontFamily: 'Arial, sans-serif',
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '40px 20px',
  },
  header: {
    marginBottom: '40px',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    marginBottom: '10px',
  },
  subtitle: {
    fontSize: '1rem',
    color: '#666',
  },
  connectPrompt: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  connectTitle: {
    fontSize: '2rem',
    marginBottom: '15px',
  },
  connectText: {
    fontSize: '1.1rem',
    color: '#666',
    marginBottom: '20px',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    fontSize: '1.2rem',
    color: '#666',
  },
  error: {
    padding: '20px',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    borderRadius: '8px',
    border: '1px solid #fca5a5',
  },
  empty: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  browseButton: {
    display: 'inline-block',
    marginTop: '20px',
    padding: '12px 32px',
    backgroundColor: '#0070f3',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '8px',
    fontWeight: '600',
  },
  bookingsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  bookingCard: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    position: 'relative' as const,
  },
  statusBadge: {
    display: 'inline-block',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '0.9rem',
    fontWeight: '600',
    marginBottom: '20px',
  },
  stayTitle: {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    marginBottom: '10px',
  },
  stayLocation: {
    fontSize: '1.1rem',
    color: '#666',
    marginBottom: '5px',
  },
  stayDates: {
    fontSize: '1rem',
    color: '#888',
    marginBottom: '20px',
  },
  statusMessage: {
    padding: '15px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '1rem',
    lineHeight: '1.5',
    color: '#374151',
  },
  bookingDetails: {
    borderTop: '1px solid #e5e7eb',
    paddingTop: '20px',
    marginBottom: '20px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '12px',
    fontSize: '0.95rem',
  },
  detailLabel: {
    color: '#6b7280',
    fontWeight: '500',
  },
  detailValue: {
    color: '#111827',
    fontWeight: '600',
  },
  payButton: {
    display: 'block',
    width: '100%',
    padding: '14px',
    backgroundColor: '#0070f3',
    color: 'white',
    textAlign: 'center' as const,
    textDecoration: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '1.1rem',
  },
  viewButton: {
    display: 'block',
    width: '100%',
    padding: '14px',
    backgroundColor: '#10b981',
    color: 'white',
    textAlign: 'center' as const,
    textDecoration: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '1.1rem',
  },
} as const;