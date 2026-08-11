"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, MapPin, Calendar, Users, DollarSign, Edit, Trash2, Globe, FileX, CheckCircle } from "lucide-react";

interface Stay {
  id: string;
  stayId: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  isPublished: boolean;
  isFeatured: boolean;
  slotsAvailable: number;
  slotsTotal: number;
  priceUSDC: number;
  status: string;
}

export default function AdminStaysPage() {
  const [stays, setStays] = useState<Stay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStays();
  }, []);

  const fetchStays = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/stays");
      if (!response.ok) throw new Error("Failed to fetch stays");
      const data = await response.json();
      setStays(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const togglePublished = async (stayId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/stays/${stayId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !currentStatus }),
      });

      if (!response.ok) throw new Error("Failed to update stay");
      
      // Refresh the list
      fetchStays();
    } catch (err) {
      alert("Error updating stay: " + (err as Error).message);
    }
  };

  const markAsDone = async (stayId: string) => {
    if (!confirm("Are you sure you want to mark this stay as DONE? It will be moved to Past Events.")) return;

    try {
      const response = await fetch(`/api/admin/stays/${stayId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DONE" }),
      });

      if (!response.ok) throw new Error("Failed to mark as done");
      
      fetchStays();
    } catch (err) {
      alert("Error updating stay: " + (err as Error).message);
    }
  };

  const deleteStay = async (stayId: string, stayTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${stayTitle}"?`)) return;

    try {
      const response = await fetch(`/api/admin/stays/${stayId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete stay");
      }

      // Refresh the list
      fetchStays();
    } catch (err) {
      alert("Error deleting stay: " + (err as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7eedb] p-6 lg:p-10 flex items-center justify-center">
        <div className="text-center p-16 bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
          <div className="w-12 h-12 border-4 border-[#f7eedb] border-t-[#2c331f] rounded-full animate-spin mx-auto mb-5"></div>
          <p className="font-bold text-[#2c331f] uppercase tracking-widest text-[10px]">Loading stays...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f7eedb] p-6 lg:p-10">
        <h1 className="text-4xl font-black mb-8 text-[#2c331f] font-display">Manage Popups</h1>
        <div className="p-6 bg-red-100 rounded-2xl border-2 border-red-500 shadow-[4px_4px_0px_0px_#ef4444] text-red-700 font-bold">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7eedb] p-6 lg:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-black mb-2 text-[#2c331f] font-display tracking-tight">
              Manage Popups
            </h1>
            <p className="text-[#5a6b3a] font-bold uppercase tracking-widest text-xs">
              Create, edit, and publish available stays
            </p>
          </div>
          <Link 
            href="/admin/stays/create" 
            className="flex items-center gap-2 py-4 px-6 bg-[#9db47d] text-[#2c331f] rounded-xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-y-1 hover:translate-x-1 transition-all font-black uppercase tracking-widest text-xs"
          >
            <Plus size={18} strokeWidth={3} />
            Create New Popup
          </Link>
        </div>

        {stays.filter(s => s.status !== 'DONE' && new Date(s.endDate) >= new Date()).length === 0 ? (
          <div className="text-center p-16 bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
            <Globe size={48} strokeWidth={2} className="mx-auto mb-5 text-[#2c331f]" />
            <h3 className="text-3xl font-black mb-2 text-[#2c331f] font-display tracking-tight">
              No Active Popups Found
            </h3>
            <p className="text-[#5a6b3a] font-bold uppercase tracking-widest text-xs mb-8">
              You haven't created any active stays yet. Completed/ended stays appear in Past Events.
            </p>
            <Link 
              href="/admin/stays/create" 
              className="inline-flex items-center gap-2 py-3.5 px-8 bg-[#f7eedb] text-[#2c331f] rounded-xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-y-1 hover:translate-x-1 transition-all font-bold uppercase tracking-wider text-sm"
            >
              <Plus size={16} strokeWidth={2.5} />
              Create Your First Popup
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {stays.filter(s => s.status !== 'DONE' && new Date(s.endDate) >= new Date()).map((stay) => (
              <div key={stay.id} className="bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] overflow-hidden flex flex-col relative">
                
                {stay.isFeatured && (
                  <div className="absolute top-4 right-4 bg-[#e8c37b] text-[#2c331f] border-2 border-[#2c331f] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_#2c331f]">
                    Featured
                  </div>
                )}
                
                <div className="p-6 md:p-8 flex-1">
                  <div className="flex flex-wrap gap-2 items-center mb-4">
                    <span className="bg-[#f7eedb] px-2 py-1 rounded-md border-2 border-[#2c331f] text-[#2c331f] font-bold text-[10px]">
                      {stay.stayId}
                    </span>
                    <button
                      onClick={() => togglePublished(stay.id, stay.isPublished)}
                      className={`px-3 py-1 rounded-md border-2 border-[#2c331f] text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-transform hover:scale-105 ${
                        stay.isPublished 
                          ? 'bg-[#9db47d] text-[#2c331f] shadow-[2px_2px_0px_0px_#2c331f]' 
                          : 'bg-[#2c331f] text-[#f7eedb] shadow-[2px_2px_0px_0px_#9db47d]'
                      }`}
                    >
                      {stay.isPublished ? <Globe size={12} /> : <FileX size={12} />}
                      {stay.isPublished ? "Published" : "Draft"}
                    </button>
                    {new Date(stay.endDate) < new Date() && (
                      <span className="bg-amber-100 border-2 border-amber-600 text-amber-800 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">
                        ENDED
                      </span>
                    )}
                  </div>

                  <h3 className="text-3xl font-black mb-3 text-[#2c331f] font-display tracking-tight leading-tight">
                    {stay.title}
                  </h3>
                  
                  <div className="space-y-3 mb-6">
                    <p className="text-xs font-bold text-[#5a6b3a] flex items-center uppercase tracking-widest">
                      <MapPin size={14} className="mr-2 text-[#2c331f]" /> {stay.location}
                    </p>
                    <p className="text-xs font-bold text-[#5a6b3a] flex items-center uppercase tracking-widest">
                      <Calendar size={14} className="mr-2 text-[#2c331f]" /> 
                      {new Date(stay.startDate).toLocaleDateString()} - {new Date(stay.endDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs font-bold text-[#5a6b3a] flex items-center uppercase tracking-widest">
                      <Users size={14} className="mr-2 text-[#2c331f]" /> 
                      {stay.slotsAvailable} / {stay.slotsTotal} Slots
                    </p>
                  </div>

                  <div className="flex justify-between items-center p-4 bg-[#f7eedb] rounded-xl border-2 border-[#2c331f] shadow-[2px_2px_0px_0px_#2c331f] mb-6">
                    <span className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">Base Price</span>
                    <span className="text-xl font-black text-[#2c331f] flex items-center">
                      <DollarSign size={20} />{stay.priceUSDC} USDC
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 border-t-2 border-[#2c331f] bg-gray-50">
                  <Link
                    href={`/admin/stays/${stay.id}`}
                    className="flex items-center justify-center gap-2 py-4 text-[#2c331f] font-bold uppercase tracking-widest text-xs border-r-2 border-[#2c331f] hover:bg-[#e8c37b] transition-colors"
                  >
                    <Edit size={16} strokeWidth={2.5} /> Edit
                  </Link>
                  <button
                    onClick={() => markAsDone(stay.id)}
                    className="flex items-center justify-center gap-2 py-4 text-[#5a6b3a] font-bold uppercase tracking-widest text-xs border-r-2 border-[#2c331f] hover:bg-[#9db47d] hover:text-[#2c331f] transition-colors"
                  >
                    <CheckCircle size={16} strokeWidth={2.5} /> Done
                  </button>
                  <button
                    onClick={() => deleteStay(stay.id, stay.title)}
                    className="flex items-center justify-center gap-2 py-4 text-red-600 font-bold uppercase tracking-widest text-xs hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={16} strokeWidth={2.5} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}