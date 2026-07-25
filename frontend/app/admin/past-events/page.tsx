"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Calendar, Globe, Edit } from "lucide-react";

interface Stay {
  id: string;
  stayId: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  status: string;
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
      
      // Filter for DONE status
      setStays(data.filter((s: Stay) => s.status === 'DONE'));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
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
              Manage gallery and testimonials for completed experiences
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
              Mark an active stay as 'Done' for it to appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {stays.map((stay) => (
              <div key={stay.id} className="bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] overflow-hidden flex flex-col relative">
                
                <div className="p-6 md:p-8 flex-1">
                  <div className="flex gap-2 items-center mb-4">
                    <span className="bg-[#f7eedb] px-2 py-1 rounded-md border-2 border-[#2c331f] text-[#2c331f] font-bold text-[10px]">
                      {stay.stayId}
                    </span>
                    <span className="bg-green-100 px-2 py-1 rounded-md border-2 border-green-600 text-green-700 font-black text-[10px] uppercase tracking-widest">
                      COMPLETED
                    </span>
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
                  </div>
                </div>

                <div className="grid grid-cols-1 border-t-2 border-[#2c331f] bg-gray-50">
                  <Link
                    href={`/admin/past-events/${stay.id}`}
                    className="flex items-center justify-center gap-2 py-4 text-[#2c331f] font-bold uppercase tracking-widest text-xs hover:bg-[#e8c37b] transition-colors"
                  >
                    <Edit size={16} strokeWidth={2.5} /> Edit Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
