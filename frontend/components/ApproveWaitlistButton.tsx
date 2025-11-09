"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ApproveButtonProps {
  bookingId: string;
  onApproved?: () => void;
}

export function ApproveWaitlistButton({ bookingId, onApproved }: ApproveButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    if (!confirm('Approve this application and send payment request?')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentToken: 'USDC',
          sessionExpiryMinutes: 60, // 1 hour to pay
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve');
      }

      alert(`✅ Application approved!\n\nPayment link: ${window.location.origin}${data.booking.paymentLink}\n\nUser will receive an email notification.`);
      onApproved?.();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      alert(`❌ Error: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleApprove}
        disabled={isLoading}
        style={{
          padding: '8px 16px',
          backgroundColor: isLoading ? '#ccc' : '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          fontWeight: '600',
          fontSize: '0.9rem',
        }}
      >
        {isLoading ? 'Approving...' : '✓ Approve'}
      </button>
      {error && <p style={{ color: 'red', fontSize: '0.875rem', marginTop: '4px' }}>{error}</p>}
    </div>
  );
}

// Batch approve component for admin dashboard
export function BatchApproveWaitlist({ bookingIds }: { bookingIds: string[] }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleBatchApprove = async () => {
    if (!confirm(`Approve ${bookingIds.length} applications?`)) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/bookings/approve-batch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingIds,
          paymentToken: 'USDC',
          sessionExpiryMinutes: 60,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Batch approval failed');
      }

      alert(`✅ ${data.results.approved.length} approved, ${data.results.failed.length} failed`);
      window.location.reload();
    } catch (err) {
      alert(`❌ Error: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (bookingIds.length === 0) return null;

  return (
    <button
      onClick={handleBatchApprove}
      disabled={isLoading}
      style={{
        padding: '10px 20px',
        backgroundColor: isLoading ? '#ccc' : '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: isLoading ? 'not-allowed' : 'pointer',
        fontWeight: '600',
        fontSize: '1rem',
      }}
    >
      {isLoading ? 'Processing...' : `✓ Approve ${bookingIds.length} Selected`}
    </button>
  );
}