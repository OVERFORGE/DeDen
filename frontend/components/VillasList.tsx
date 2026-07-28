"use client";

import { useMemo, useState } from "react";
import VillaStayCard from "@/components/VillaStayCard";

type Stay = {
  id: string;
  stayId: string;
  title: string;
  slotsTotal: number;
  slotsAvailable: number;
  priceUSDC: number;
  location?: string | null;
  startDate: Date | string;
  shortDescription?: string | null;
  images?: string[] | null;
  heroImage?: string | null;
  amenityIcons?: any;
};

type SortKey = "upcoming" | "price" | "location";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "price", label: "Price" },
  { key: "location", label: "Location" },
];

export default function VillasList({ stays }: { stays: Stay[] }) {
  const [sortBy, setSortBy] = useState<SortKey>("upcoming");

  const sorted = useMemo(() => {
    const copy = [...stays];
    if (sortBy === "price") {
      copy.sort((a, b) => (a.priceUSDC || 0) - (b.priceUSDC || 0));
    } else if (sortBy === "location") {
      copy.sort((a, b) => (a.location || "").localeCompare(b.location || ""));
    } else {
      copy.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    }
    return copy;
  }, [stays, sortBy]);

  return (
    <>
      <div className="flex items-center gap-2 mb-10">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#43392e]/60 mr-2">
          Sort by
        </span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            className={`text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full border transition-colors ${
              sortBy === opt.key
                ? "bg-[#43392e] text-[#f7eedb] border-[#43392e]"
                : "bg-transparent text-[#43392e] border-[#43392e]/30 hover:border-[#43392e]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-24 pb-20">
        {sorted.map((stay) => (
          <VillaStayCard key={stay.id} stay={stay} />
        ))}
      </div>
    </>
  );
}
