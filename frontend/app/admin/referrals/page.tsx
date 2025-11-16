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
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading referral codes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Community Referrals</h1>
          <p className="text-gray-600 mt-1">Manage referral codes and track community performance</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
        >
          <Plus size={20} />
          Create Referral Codes
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="text-blue-600" size={24} />
            </div>
            <span className="text-3xl font-bold text-gray-900">{totalStats.totalCodes}</span>
          </div>
          <p className="text-sm text-gray-600">Total Codes</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-green-600" size={24} />
            </div>
            <span className="text-3xl font-bold text-gray-900">{totalStats.totalUsage}</span>
          </div>
          <p className="text-sm text-gray-600">Total Usage</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-purple-600 text-xl font-bold">$</span>
            </div>
            <span className="text-3xl font-bold text-gray-900">
              ${totalStats.totalRevenue.toFixed(0)}
            </span>
          </div>
          <p className="text-sm text-gray-600">Total Revenue</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <span className="text-red-600 text-xl font-bold">%</span>
            </div>
            <span className="text-3xl font-bold text-gray-900">
              ${totalStats.totalDiscount.toFixed(0)}
            </span>
          </div>
          <p className="text-sm text-gray-600">Total Discounts</p>
        </div>
      </div>

      {/* Top Communities Leaderboard */}
      {topCommunities.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp size={24} className="text-blue-600" />
            Top Performing Communities
          </h2>
          <div className="space-y-3">
            {topCommunities.slice(0, 5).map((community, index) => (
              <div key={community.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                    index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-600' : 'bg-blue-600'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{community.name}</p>
                    <p className="text-sm text-gray-600">{community.codes} codes</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">{community.usage}</p>
                  <p className="text-sm text-gray-600">bookings</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-200 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Create Referral Codes</h2>
            <button onClick={() => setShowCreateForm(false)} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleCreateCodes} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Community Name *
                </label>
                <input
                  type="text"
                  value={formData.communityName}
                  onChange={(e) => setFormData({ ...formData, communityName: e.target.value })}
                  placeholder="e.g., Ethereum India"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Stay/Event *
                </label>
                <select
                  value={formData.stayId}
                  onChange={(e) => setFormData({ ...formData, stayId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Number of Codes
                </label>
                <input
                  type="number"
                  value={formData.numberOfCodes}
                  onChange={(e) => setFormData({ ...formData, numberOfCodes: parseInt(e.target.value) })}
                  min="1"
                  max="20"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Discount Percent
                </label>
                <input
                  type="number"
                  value={formData.discountPercent}
                  onChange={(e) => setFormData({ ...formData, discountPercent: parseInt(e.target.value) })}
                  min="1"
                  max="100"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Max Usage (optional)
                </label>
                <input
                  type="number"
                  value={formData.maxUsage}
                  onChange={(e) => setFormData({ ...formData, maxUsage: e.target.value })}
                  placeholder="Unlimited"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Expires At (optional)
                </label>
                <input
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this community or campaign..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Generate {formData.numberOfCodes} Referral Codes
            </button>
          </form>
        </div>
      )}

      {/* Referral Codes Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">All Referral Codes</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Community</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Stay</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Discount</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Usage</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {referralCodes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No referral codes yet. Create your first one above!
                  </td>
                </tr>
              ) : (
                referralCodes.map((code) => (
                  <tr key={code.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded">
                          {code.code}
                        </code>
                        <button
                          onClick={() => copyCode(code.code)}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                          title="Copy code"
                        >
                          {copiedCode === code.code ? (
                            <Check size={16} className="text-green-600" />
                          ) : (
                            <Copy size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-900">{code.communityName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900">{code.stay.title}</p>
                        <p className="text-sm text-gray-500">{code.stay.stayId}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-green-600">{code.discountPercent}%</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {code.stats.totalUsage} / {code.maxUsage || '∞'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {code.stats.confirmedBookings} confirmed
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleActive(code.id, code.isActive)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          code.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {code.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleActive(code.id, code.isActive)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title={code.isActive ? 'Deactivate' : 'Activate'}
                        >
                          <Edit size={16} />
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
  );
}