"use client";

import { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';

// Form schema
const staySchema = z.object({
  title: z.string().min(3, 'Title is required'),
  slug: z.string().min(3, 'Slug is required (e.g., "ibw")'),
  location: z.string().min(3, 'Location is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  priceUSDC: z.preprocess(
    (a) => parseFloat(z.string().parse(a)),
    z.number().positive('Price must be positive')
  ),
  priceUSDT: z.preprocess(
    (a) => parseFloat(z.string().parse(a)),
    z.number().positive('Price must be positive')
  ),
  slotsTotal: z.preprocess(
    (a) => parseInt(z.string().parse(a), 10),
    z.number().positive('Slots must be positive')
  ),
});

type StayFormInputs = z.infer<typeof staySchema>;

export default function CreateStayPage() {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StayFormInputs>({
    resolver: zodResolver(staySchema),
  });

  const onSubmit: SubmitHandler<StayFormInputs> = async (data) => {
    setApiError(null);
    try {
      const res = await fetch('/api/admin/stays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to create stay');
      }
      
      alert('Stay created successfully!');
      router.push('/admin/stays'); // Go back to the list
    } catch (err: any) {
      setApiError(err.message);
    }
  };

  return (
    <div>
      <h1>Create New Stay</h1>
      <form onSubmit={handleSubmit(onSubmit)} style={styles.form}>
        <div style={styles.field}>
          <label>Stay Title</label>
          <input {...register('title')} placeholder="IBW 2026 Den" />
          {errors.title && <span style={styles.error}>{errors.title.message}</span>}
        </div>

        <div style={styles.field}>
          <label>Slug</label>
          <input {...register('slug')} placeholder="ibw-2026" />
          {errors.slug && <span style={styles.error}>{errors.slug.message}</span>}
        </div>

        <div style={styles.field}>
          <label>Location</label>
          <input {...register('location')} placeholder="Goa, India" />
          {errors.location && <span style={styles.error}>{errors.location.message}</span>}
        </div>

        <div style={styles.fieldGroup}>
          <div style={styles.field}>
            <label>Start Date</label>
            <input type="date" {...register('startDate')} />
            {errors.startDate && <span style={styles.error}>{errors.startDate.message}</span>}
          </div>
          <div style={styles.field}>
            <label>End Date</label>
            <input type="date" {...register('endDate')} />
            {errors.endDate && <span style={styles.error}>{errors.endDate.message}</span>}
          </div>
        </div>

        <div style={styles.fieldGroup}>
          <div style={styles.field}>
            <label>Price (USDC)</label>
            <input type="number" {...register('priceUSDC')} placeholder="300" />
            {errors.priceUSDC && <span style={styles.error}>{errors.priceUSDC.message}</span>}
          </div>
          <div style={styles.field}>
            <label>Price (USDT)</label>
            <input type="number" {...register('priceUSDT')} placeholder="300" />
            {errors.priceUSDT && <span style={styles.error}>{errors.priceUSDT.message}</span>}
          </div>
        </div>

        <div style={styles.field}>
          <label>Total Slots</label>
          <input type="number" {...register('slotsTotal')} placeholder="50" />
          {errors.slotsTotal && <span style={styles.error}>{errors.slotsTotal.message}</span>}
        </div>

        {apiError && <div style={styles.error}>{apiError}</div>}

        <button type="submit" disabled={isSubmitting} style={styles.button}>
          {isSubmitting ? 'Creating...' : 'Create Stay'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    maxWidth: '600px',
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
  },
  fieldGroup: {
    display: 'flex',
    gap: '15px',
  },
  error: { color: 'red', fontSize: '0.9em' },
  button: {
    padding: '12px',
    fontSize: '1em',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
} as const;