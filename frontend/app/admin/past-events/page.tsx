"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Calendar, Globe, Edit, Trash2, Eye, EyeOff, BarChart3 } from "lucide-react";

interface Stay {
  id: string;
  stayId: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  status: string;
  isPublished: boolean;
}

export default function AdminPastEventsPage() {
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
      
      // Filter for past events (DONE status or end date in the past)
      const now = new Date();
      setStays(data.filter((s: Stay) => s.status === 'DONE' || new Date(s.endDate) < now));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const togglePublished = async (stayId: string, currentIsPublished: boolean) => {
    try {
      const response = await fetch(`/api/admin/stays/${stayId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !currentIsPublished }),
      });

      if (!response.ok) throw new Error("Failed to update stay visibility");
      fetchStays();
    } catch (err) {
      alert("Error updating visibility: " + (err as Error).message);
    }
  };

  const deletePastEvent = async (stayId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) return;

    try {
      const response = await fetch(`/api/admin/stays/${stayId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete past event");
      }

      fetchStays();
    } catch (err) {
      alert("Error deleting past event: " + (err as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7eedb] p-6 lg:p-10 flex items-center justify-center">
        <div className="text-center p-16 bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
          <div className="w-12 h-12 border-4 border-[#f7eedb] border-t-[#2c331f] rounded-full animate-spin mx-auto mb-5"></div>
          <p className="font-bold text-[#2c331f] uppercase tracking-widest text-[10px]">Loading past events...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f7eedb] p-6 lg:p-10">
        <h1 className="text-4xl font-black mb-8 text-[#2c331f] font-display">Past Events</h1>
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
              Past Events
            </h1>
            <p className="text-[#5a6b3a] font-bold uppercase tracking-widest text-xs">
              Click any card to view event metrics and guest turnout, or manage gallery & visibility
            </p>
          </div>
        </div>

        {stays.length === 0 ? (
          <div className="text-center p-16 bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
            <Globe size={48} strokeWidth={2} className="mx-auto mb-5 text-[#2c331f]" />
            <h3 className="text-3xl font-black mb-2 text-[#2c331f] font-display tracking-tight">
              No Past Events Found
            </h3>
            <p className="text-[#5a6b3a] font-bold uppercase tracking-widest text-xs mb-8">
              Completed stays will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {stays.map((stay) => (
              <div key={stay.id} className="bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] overflow-hidden flex flex-col relative group">
                
                {/* Clickable Card Body -> Takes to Metrics */}
                <Link href={`/admin/past-events/${stay.id}/metrics`} className="p-6 md:p-8 flex-1 block hover:bg-amber-50/50 transition-colors">
                  <div className="flex flex-wrap gap-2 items-center mb-4">
                    <span className="bg-[#f7eedb] px-2 py-1 rounded-md border-2 border-[#2c331f] text-[#2c331f] font-bold text-[10px]">
                      {stay.stayId}
                    </span>
                    <span className="bg-green-100 px-2 py-1 rounded-md border-2 border-green-600 text-green-700 font-black text-[10px] uppercase tracking-widest">
                      COMPLETED
                    </span>
                    <span className={`px-2 py-1 rounded-md border-2 border-[#2c331f] font-black text-[10px] uppercase tracking-widest ${
                      stay.isPublished ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'
                    }`}>
                      {stay.isPublished ? 'PUBLISHED' : 'HIDDEN'}
                    </span>
                  </div>

                  <h3 className="text-3xl font-black mb-3 text-[#2c331f] font-display tracking-tight leading-tight group-hover:text-[#5a6b3a] transition-colors">
                    {stay.title}
                  </h3>
                  
                  <div className="space-y-2 mb-4">
                    <p className="text-xs font-bold text-[#5a6b3a] flex items-center uppercase tracking-widest">
                      <MapPin size={14} className="mr-2 text-[#2c331f]" /> {stay.location}
                    </p>
                    <p className="text-xs font-bold text-[#5a6b3a] flex items-center uppercase tracking-widest">
                      <Calendar size={14} className="mr-2 text-[#2c331f]" /> 
                      {new Date(stay.startDate).toLocaleDateString()} - {new Date(stay.endDate).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="mt-4 pt-4 border-t border-dashed border-gray-200 flex items-center justify-between text-xs font-bold text-[#5a6b3a]">
                    <span className="flex items-center gap-1.5 text-[#2c331f]">
                      <BarChart3 size={15} /> View Event Metrics & Turnout →
                    </span>
                  </div>
                </Link>

                {/* Footer Action Buttons */}
                <div className="grid grid-cols-3 border-t-2 border-[#2c331f] bg-gray-50">
                  <Link
                    href={`/admin/past-events/${stay.id}`}
                    className="flex items-center justify-center gap-1 py-3 text-[#2c331f] font-bold uppercase tracking-widest text-[10px] border-r-2 border-[#2c331f] hover:bg-[#e8c37b] transition-colors"
                  >
                    <Edit size={13} strokeWidth={2.5} /> Edit
                  </Link>

                  <button
                    onClick={() => togglePublished(stay.id, stay.isPublished)}
                    className={`flex items-center justify-center gap-1 py-3 font-bold uppercase tracking-widest text-[10px] border-r-2 border-[#2c331f] transition-colors ${
                      stay.isPublished ? 'text-amber-800 hover:bg-amber-100' : 'text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {stay.isPublished ? (
                      <>
                        <EyeOff size={13} strokeWidth={2.5} /> Hide
                      </>
                    ) : (
                      <>
                        <Eye size={13} strokeWidth={2.5} /> Show
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => deletePastEvent(stay.id, stay.title)}
                    className="flex items-center justify-center gap-1 py-3 text-red-600 font-bold uppercase tracking-widest text-[10px] hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={13} strokeWidth={2.5} /> Delete
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

