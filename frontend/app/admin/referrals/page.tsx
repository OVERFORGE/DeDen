// File: app/admin/referrals/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { Plus, Users, TrendingUp, Copy, Check, X, Edit, Trash2, AlertCircle } from 'lucide-react';

type ReferralCode = {
  id: string;
  code: string;
  communityName: string;
  discountPercent: number;
  usageCount: number;
  maxUsage: number | null;
  isActive: boolean;
  expiresAt: string | null;
  stay: {
    stayId: string;
    title: string;
    startDate: string;
    endDate: string;
  };
  stats: {
    totalUsage: number;
    confirmedBookings: number;
    pendingBookings: number;
    totalRevenue: number;
    totalDiscount: number;
  };
  bookings: any[];
};

type Stay = {
  id: string;
  stayId: string;
  title: string;
};

export default function AdminReferralsPage() {
  const [referralCodes, setReferralCodes] = useState<ReferralCode[]>([]);
  const [stays, setStays] = useState<Stay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    communityName: '',
    stayId: '',
    numberOfCodes: 5,
    discountPercent: 10,
    maxUsage: '',
    expiresAt: '',
    notes: '',
  });

  useEffect(() => {
    fetchReferralCodes();
    fetchStays();
  }, []);

  const fetchReferralCodes = async () => {
    try {
      const res = await fetch('/api/admin/referrals');
      if (res.ok) {
        const data = await res.json();
        setReferralCodes(data);
      }
    } catch (error) {
      console.error('Error fetching referral codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStays = async () => {
    try {
      const res = await fetch('/api/admin/stays');
      if (res.ok) {
        const data = await res.json();
        setStays(data);
      }
    } catch (error) {
      console.error('Error fetching stays:', error);
    }
  };

  const handleCreateCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const res = await fetch('/api/admin/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          maxUsage: formData.maxUsage ? parseInt(formData.maxUsage) : null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(`✅ Created ${data.codes.length} referral codes for ${formData.communityName}!`);
        setShowCreateForm(false);
        setFormData({
          communityName: '',
          stayId: '',
          numberOfCodes: 5,
          discountPercent: 10,
          maxUsage: '',
          expiresAt: '',
          notes: '',
        });
        fetchReferralCodes();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to create referral codes');
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/referrals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (res.ok) {
        fetchReferralCodes();
      }
    } catch (error) {
      alert('Failed to update status');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Calculate overall stats
  const totalStats = referralCodes.reduce((acc, code) => ({
    totalCodes: acc.totalCodes + 1,
    totalUsage: acc.totalUsage + code.stats.totalUsage,
    totalRevenue: acc.totalRevenue + code.stats.totalRevenue,
    totalDiscount: acc.totalDiscount + code.stats.totalDiscount,
  }), { totalCodes: 0, totalUsage: 0, totalRevenue: 0, totalDiscount: 0 });

  // Group by community
  const communityStats = referralCodes.reduce((acc, code) => {
    if (!acc[code.communityName]) {
      acc[code.communityName] = {
        name: code.communityName,
        codes: 0,
        usage: 0,
        revenue: 0,
      };
    }
    acc[code.communityName].codes++;
    acc[code.communityName].usage += code.stats.totalUsage;
    acc[code.communityName].revenue += code.stats.totalRevenue;
    return acc;
  }, {} as Record<string, { name: string; codes: number; usage: number; revenue: number }>);

  const topCommunities = Object.values(communityStats).sort((a, b) => b.usage - a.usage);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7eedb] p-6 lg:p-10 flex items-center justify-center">
        <div className="text-center p-16 bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
          <div className="w-12 h-12 border-4 border-[#f7eedb] border-t-[#2c331f] rounded-full animate-spin mx-auto mb-5"></div>
          <p className="font-bold text-[#2c331f] uppercase tracking-widest text-[10px]">Loading referrals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7eedb] p-6 lg:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-black mb-2 text-[#2c331f] font-display tracking-tight">Community Referrals</h1>
            <p className="text-[#5a6b3a] font-bold uppercase tracking-widest text-xs">Manage referral codes and track community performance</p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 py-4 px-6 bg-[#9db47d] text-[#2c331f] rounded-xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-y-1 hover:translate-x-1 transition-all font-black uppercase tracking-widest text-xs"
          >
            <Plus size={18} strokeWidth={3} />
            Create Referral Codes
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-white rounded-2xl p-6 border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-[#f7eedb] rounded-xl flex items-center justify-center border-2 border-[#2c331f]">
                <Users className="text-[#2c331f]" size={24} strokeWidth={2.5} />
              </div>
              <span className="text-4xl font-black text-[#2c331f] font-display">{totalStats.totalCodes}</span>
            </div>
            <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">Total Codes</p>
          </div>

          <div className="bg-[#9db47d] rounded-2xl p-6 border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border-2 border-[#2c331f]">
                <TrendingUp className="text-[#2c331f]" size={24} strokeWidth={2.5} />
              </div>
              <span className="text-4xl font-black text-[#2c331f] font-display">{totalStats.totalUsage}</span>
            </div>
            <p className="text-[10px] font-bold text-[#2c331f]/80 uppercase tracking-widest">Total Usage</p>
          </div>

          <div className="bg-[#2c331f] rounded-2xl p-6 border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#9db47d]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border-2 border-[#f7eedb]/30">
                <span className="text-[#f7eedb] text-xl font-black font-display">$</span>
              </div>
              <span className="text-4xl font-black text-[#f7eedb] font-display">
                ${totalStats.totalRevenue.toFixed(0)}
              </span>
            </div>
            <p className="text-[10px] font-bold text-[#f7eedb]/70 uppercase tracking-widest">Total Revenue</p>
          </div>

          <div className="bg-[#e8c37b] rounded-2xl p-6 border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border-2 border-[#2c331f]">
                <span className="text-[#2c331f] text-xl font-black font-display">%</span>
              </div>
              <span className="text-4xl font-black text-[#2c331f] font-display">
                ${totalStats.totalDiscount.toFixed(0)}
              </span>
            </div>
            <p className="text-[10px] font-bold text-[#2c331f]/80 uppercase tracking-widest">Total Discounts</p>
          </div>
        </div>

        {/* Top Communities Leaderboard */}
        {topCommunities.length > 0 && (
          <div className="bg-white rounded-2xl p-6 mb-10 border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
            <h2 className="text-xl font-black text-[#2c331f] font-display tracking-tight mb-6 flex items-center gap-3">
              <TrendingUp size={24} className="text-[#2c331f]" />
              Top Performing Communities
            </h2>
            <div className="space-y-4">
              {topCommunities.slice(0, 5).map((community, index) => (
                <div key={community.name} className="flex items-center justify-between p-4 bg-[#f7eedb] rounded-xl border-2 border-[#2c331f] shadow-[2px_2px_0px_0px_#2c331f]">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-[#2c331f] font-display text-xl border-2 border-[#2c331f] shadow-[2px_2px_0px_0px_#2c331f] ${
                      index === 0 ? 'bg-[#e8c37b]' : index === 1 ? 'bg-gray-300' : index === 2 ? 'bg-orange-300' : 'bg-white'
                    }`}>
                      #{index + 1}
                    </div>
                    <div>
                      <p className="font-black text-[#2c331f] text-lg">{community.name}</p>
                      <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">{community.codes} codes</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-[#2c331f] font-display">{community.usage}</p>
                    <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">bookings</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white rounded-2xl p-6 mb-10 border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-[#2c331f] font-display tracking-tight">Create Referral Codes</h2>
            <button onClick={() => setShowCreateForm(false)} className="text-[#2c331f] hover:text-red-500 transition-colors">
              <X size={24} strokeWidth={2.5} />
            </button>
          </div>

          <form onSubmit={handleCreateCodes} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest mb-2">
                  Community Name *
                </label>
                <input
                  type="text"
                  value={formData.communityName}
                  onChange={(e) => setFormData({ ...formData, communityName: e.target.value })}
                  placeholder="e.g., Ethereum India"
                  className="w-full px-4 py-3.5 border-2 border-[#2c331f] rounded-xl bg-[#f7eedb] text-[#2c331f] placeholder:text-[#5a6b3a] font-bold text-sm focus:outline-none focus:ring-4 focus:ring-[#9db47d]/30"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest mb-2">
                  Select Stay/Event *
                </label>
                <select
                  value={formData.stayId}
                  onChange={(e) => setFormData({ ...formData, stayId: e.target.value })}
                  className="w-full px-4 py-3.5 border-2 border-[#2c331f] rounded-xl bg-[#f7eedb] text-[#2c331f] font-bold text-sm focus:outline-none focus:ring-4 focus:ring-[#9db47d]/30 appearance-none"
                  required
                >
                  <option value="">Choose a stay...</option>
                  {stays.map((stay) => (
                    <option key={stay.id} value={stay.id}>
                      {stay.title} ({stay.stayId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest mb-2">
                  Number of Codes
                </label>
                <input
                  type="number"
                  value={formData.numberOfCodes}
                  onChange={(e) => setFormData({ ...formData, numberOfCodes: parseInt(e.target.value) })}
                  min="1"
                  max="20"
                  className="w-full px-4 py-3.5 border-2 border-[#2c331f] rounded-xl bg-[#f7eedb] text-[#2c331f] font-bold text-sm focus:outline-none focus:ring-4 focus:ring-[#9db47d]/30"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest mb-2">
                  Discount Percent
                </label>
                <input
                  type="number"
                  value={formData.discountPercent}
                  onChange={(e) => setFormData({ ...formData, discountPercent: parseInt(e.target.value) })}
                  min="1"
                  max="100"
                  className="w-full px-4 py-3.5 border-2 border-[#2c331f] rounded-xl bg-[#f7eedb] text-[#2c331f] font-bold text-sm focus:outline-none focus:ring-4 focus:ring-[#9db47d]/30"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest mb-2">
                  Max Usage (optional)
                </label>
                <input
                  type="number"
                  value={formData.maxUsage}
                  onChange={(e) => setFormData({ ...formData, maxUsage: e.target.value })}
                  placeholder="Unlimited"
                  className="w-full px-4 py-3.5 border-2 border-[#2c331f] rounded-xl bg-[#f7eedb] text-[#2c331f] placeholder:text-[#5a6b3a] font-bold text-sm focus:outline-none focus:ring-4 focus:ring-[#9db47d]/30"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest mb-2">
                  Expires At (optional)
                </label>
                <input
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  className="w-full px-4 py-3.5 border-2 border-[#2c331f] rounded-xl bg-[#f7eedb] text-[#2c331f] font-bold text-sm focus:outline-none focus:ring-4 focus:ring-[#9db47d]/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest mb-2">
                Notes (optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this community or campaign..."
                rows={3}
                className="w-full px-4 py-3.5 border-2 border-[#2c331f] rounded-xl bg-[#f7eedb] text-[#2c331f] placeholder:text-[#5a6b3a] font-bold text-sm focus:outline-none focus:ring-4 focus:ring-[#9db47d]/30"
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-[#2c331f] text-[#f7eedb] rounded-xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#9db47d] hover:shadow-[0px_0px_0px_0px_#9db47d] hover:translate-y-1 hover:translate-x-1 transition-all font-black uppercase tracking-widest text-sm"
            >
              Generate {formData.numberOfCodes} Referral Codes
            </button>
          </form>
        </div>
      )}

      {/* Referral Codes Table */}
      <div className="bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] overflow-hidden">
        <div className="px-6 py-5 border-b-2 border-[#2c331f] bg-[#f7eedb]">
          <h2 className="text-xl font-black text-[#2c331f] font-display tracking-tight">All Referral Codes</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#2c331f] border-b-2 border-[#2c331f]">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-[#f7eedb] uppercase tracking-widest">Code</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-[#f7eedb] uppercase tracking-widest">Community</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-[#f7eedb] uppercase tracking-widest">Stay</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-[#f7eedb] uppercase tracking-widest">Discount</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-[#f7eedb] uppercase tracking-widest">Usage</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-[#f7eedb] uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-[#f7eedb] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[#2c331f]">
              {referralCodes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
                    No referral codes yet. Create your first one above!
                  </td>
                </tr>
              ) : (
                referralCodes.map((code) => (
                  <tr key={code.id} className="hover:bg-[#f7eedb]/30 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-bold text-[#2c331f] bg-[#f7eedb] px-3 py-1 rounded-md border-2 border-[#2c331f]">
                          {code.code}
                        </code>
                        <button
                          onClick={() => copyCode(code.code)}
                          className="text-[#5a6b3a] hover:text-[#2c331f] transition-colors"
                          title="Copy code"
                        >
                          {copiedCode === code.code ? (
                            <Check size={16} className="text-[#9db47d]" strokeWidth={3} />
                          ) : (
                            <Copy size={16} strokeWidth={2.5} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="font-black text-[#2c331f] text-base">{code.communityName}</span>
                    </td>
                    <td className="px-6 py-5">
                      <div>
                        <p className="font-black text-[#2c331f]">{code.stay.title}</p>
                        <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">{code.stay.stayId}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="font-black text-xl text-[#2c331f] bg-[#e8c37b] px-2 py-0.5 rounded-md border-2 border-[#2c331f]">{code.discountPercent}%</span>
                    </td>
                    <td className="px-6 py-5">
                      <div>
                        <p className="font-black text-[#2c331f]">
                          {code.stats.totalUsage} / {code.maxUsage || '∞'}
                        </p>
                        <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
                          {code.stats.confirmedBookings} confirmed
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <button
                        onClick={() => toggleActive(code.id, code.isActive)}
                        className={`px-3 py-1 rounded-md border-2 border-[#2c331f] text-[10px] font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_#2c331f] ${
                          code.isActive
                            ? 'bg-[#9db47d] text-[#2c331f]'
                            : 'bg-white text-[#5a6b3a]'
                        }`}
                      >
                        {code.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleActive(code.id, code.isActive)}
                          className="p-2 text-[#2c331f] hover:bg-[#e8c37b] border-2 border-transparent hover:border-[#2c331f] rounded-xl transition-colors hover:shadow-[2px_2px_0px_0px_#2c331f]"
                          title={code.isActive ? 'Deactivate' : 'Activate'}
                        >
                          <Edit size={16} strokeWidth={2.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}