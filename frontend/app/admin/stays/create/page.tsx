"use client";

import { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';

const staySchema = z.object({
  title: z.string().min(3, 'Title is required'),
  slug: z.string().min(3, 'Slug is required (e.g., "ibw")'),
  location: z.string().min(3, 'Location is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  priceUSDC: z.string().min(1, 'Default USDC price is required'),
  priceUSDT: z.string().min(1, 'Default USDT price is required'),
  slotsTotal: z.string().min(1, 'Slots is required'),
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
    
    const priceUSDC = parseFloat(data.priceUSDC);
    const priceUSDT = parseFloat(data.priceUSDT);
    const slotsTotal = parseInt(data.slotsTotal, 10);

    if (isNaN(priceUSDC) || priceUSDC <= 0) {
      setApiError('Default USDC price must be a positive number');
      return;
    }
    if (isNaN(priceUSDT) || priceUSDT <= 0) {
      setApiError('Default USDT price must be a positive number');
      return;
    }
    if (isNaN(slotsTotal) || slotsTotal <= 0) {
      setApiError('Slots must be a positive number');
      return;
    }

    try {
      const payload = {
        title: data.title,
        slug: data.slug,
        location: data.location,
        startDate: data.startDate,
        endDate: data.endDate,
        priceUSDC,
        priceUSDT,
        slotsTotal,
      };

      const res = await fetch('/api/admin/stays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to create stay');
      }
      
      alert('Stay created successfully! Now add room types with specific prices.');
      router.push(`/admin/stays/${result.id}`);
    } catch (err: any) {
      setApiError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3EDE0] py-16 px-6 sm:px-10 font-inter">
      <div className="max-w-[800px] mx-auto">
        <h1 className="text-4xl md:text-5xl font-serif text-[#3D4331] font-bold mb-8">
          Create New Stay
        </h1>
        
        {/* Important Notice */}
        <div className="bg-[#EBE1D0] border-l-4 border-[#96A476] rounded-r-xl p-5 mb-10 shadow-sm">
          <p className="text-sm font-semibold text-[#3D4331]">
            <span className="uppercase tracking-widest text-[10px] font-black mr-2 bg-[#96A476] text-[#F3EDE0] px-2 py-1 rounded-full">Note</span>
            The prices you set here are <strong className="font-black">default values</strong> that will be suggested when you create room types. Each room will have its own specific prices that guests will actually pay.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-[#EBE1D0]/50 space-y-8">
          
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-[#3D4331]">Stay Title</label>
            <input 
              {...register('title')} 
              placeholder="IBW 2026 Den"
              className="w-full bg-[#F3EDE0]/50 border border-[#EBE1D0] rounded-xl px-4 py-3 text-sm text-[#3D4331] font-medium outline-none focus:border-[#96A476] transition-colors"
            />
            {errors.title && <span className="text-xs text-red-500 font-bold">{errors.title.message}</span>}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-[#3D4331]">Slug (URL-friendly)</label>
            <input 
              {...register('slug')} 
              placeholder="ibw-2026"
              className="w-full bg-[#F3EDE0]/50 border border-[#EBE1D0] rounded-xl px-4 py-3 text-sm text-[#3D4331] font-medium outline-none focus:border-[#96A476] transition-colors"
            />
            {errors.slug && <span className="text-xs text-red-500 font-bold">{errors.slug.message}</span>}
            <p className="text-[10px] text-[#3D4331]/60 font-semibold mt-1">Used in URLs like: /stay/ibw-2026</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-[#3D4331]">Location</label>
            <input 
              {...register('location')} 
              placeholder="Goa, India"
              className="w-full bg-[#F3EDE0]/50 border border-[#EBE1D0] rounded-xl px-4 py-3 text-sm text-[#3D4331] font-medium outline-none focus:border-[#96A476] transition-colors"
            />
            {errors.location && <span className="text-xs text-red-500 font-bold">{errors.location.message}</span>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-[#3D4331]">Start Date</label>
              <input 
                type="date" 
                {...register('startDate')}
                className="w-full bg-[#F3EDE0]/50 border border-[#EBE1D0] rounded-xl px-4 py-3 text-sm text-[#3D4331] font-medium outline-none focus:border-[#96A476] transition-colors"
              />
              {errors.startDate && <span className="text-xs text-red-500 font-bold">{errors.startDate.message}</span>}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-[#3D4331]">End Date</label>
              <input 
                type="date" 
                {...register('endDate')}
                className="w-full bg-[#F3EDE0]/50 border border-[#EBE1D0] rounded-xl px-4 py-3 text-sm text-[#3D4331] font-medium outline-none focus:border-[#96A476] transition-colors"
              />
              {errors.endDate && <span className="text-xs text-red-500 font-bold">{errors.endDate.message}</span>}
            </div>
          </div>

          <div className="bg-[#F3EDE0]/30 rounded-2xl p-6 border border-[#EBE1D0]/50">
            <h3 className="text-lg font-serif font-bold text-[#3D4331] mb-2">Default Room Prices</h3>
            <p className="text-xs text-[#3D4331]/70 font-medium mb-6">
              These will be used as suggested prices when creating room types. You can set different prices for each room type later.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-[#3D4331]">
                  Default USDC Price
                </label>
                <input 
                  type="number" 
                  step="0.01"
                  {...register('priceUSDC')} 
                  placeholder="300"
                  className="w-full bg-[#F3EDE0]/50 border border-[#EBE1D0] rounded-xl px-4 py-3 text-sm text-[#3D4331] font-medium outline-none focus:border-[#96A476] transition-colors"
                />
                {errors.priceUSDC && <span className="text-xs text-red-500 font-bold">{errors.priceUSDC.message}</span>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-[#3D4331]">
                  Default USDT Price
                </label>
                <input 
                  type="number" 
                  step="0.01"
                  {...register('priceUSDT')} 
                  placeholder="300"
                  className="w-full bg-[#F3EDE0]/50 border border-[#EBE1D0] rounded-xl px-4 py-3 text-sm text-[#3D4331] font-medium outline-none focus:border-[#96A476] transition-colors"
                />
                {errors.priceUSDT && <span className="text-xs text-red-500 font-bold">{errors.priceUSDT.message}</span>}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-[#3D4331]">Total Slots</label>
            <input 
              type="number" 
              {...register('slotsTotal')} 
              placeholder="50"
              className="w-full bg-[#F3EDE0]/50 border border-[#EBE1D0] rounded-xl px-4 py-3 text-sm text-[#3D4331] font-medium outline-none focus:border-[#96A476] transition-colors"
            />
            {errors.slotsTotal && <span className="text-xs text-red-500 font-bold">{errors.slotsTotal.message}</span>}
            <p className="text-[10px] text-[#3D4331]/60 font-semibold mt-1">Maximum number of guests for this stay</p>
          </div>

          {apiError && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-semibold border border-red-100">
              {apiError}
            </div>
          )}

          <div className="pt-6 flex flex-col sm:flex-row gap-4">
            <button 
              type="button" 
              onClick={() => router.push('/admin/stays')}
              className="flex-1 bg-[#F3EDE0] text-[#3D4331] font-bold text-sm tracking-widest uppercase rounded-full py-4 hover:bg-[#EBE1D0] transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className={`flex-[2] bg-[#3D4331] text-[#F3EDE0] font-bold text-sm tracking-widest uppercase rounded-full py-4 transition-colors ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-[#525942]'
              }`}
            >
              {isSubmitting ? 'Creating...' : 'Create Stay & Add Rooms ✦'}
            </button>
          </div>
        </form>

        {/* Additional Info */}
        <div className="mt-12 bg-white rounded-3xl p-8 shadow-sm border border-[#EBE1D0]/50">
          <h4 className="text-lg font-serif font-bold text-[#3D4331] mb-4">What happens next?</h4>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-[#3D4331]/80 font-medium">
            <li>After creating the stay, you'll be redirected to add room types</li>
            <li>Each room type can have different prices for USDC and USDT</li>
            <li>Guests will see and pay the specific room prices, not the default stay prices</li>
          </ol>
        </div>
      </div>
    </div>
  );
}