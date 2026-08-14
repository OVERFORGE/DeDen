// File: components/Dropdown.tsx
//
// Generic single-select dropdown — trigger button + floating option list,
// styled to match the site's cream/olive theme. Replaces ad-hoc button
// grids for choices like "pick a chain" / "pick a token", where a real
// dropdown (the pattern basically every wallet UI uses for network/token
// pickers) reads better than a wall of buttons, especially as the option
// count grows.

"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Rendered inside the trigger to the left of the label, e.g. a small dot/badge. */
  triggerIcon?: React.ReactNode;
}

export function Dropdown({ options, value, onChange, disabled, placeholder = "Select…", triggerIcon }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) || null;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-3 p-4 rounded-2xl font-bold text-sm text-left transition-colors ${
          disabled
            ? "bg-[#F3EDE0]/60 text-[#3D4331]/40 cursor-not-allowed"
            : "bg-[#F3EDE0] hover:bg-[#EBE1D0] text-[#3D4331] cursor-pointer"
        }`}
      >
        <span className="flex items-center gap-3 min-w-0">
          {selected?.icon ?? triggerIcon}
          <span className="min-w-0">
            <span className="block truncate">{selected ? selected.label : placeholder}</span>
            {selected?.sublabel && (
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#3D4331]/50 truncate">
                {selected.sublabel}
              </span>
            )}
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""} ${disabled ? "opacity-40" : ""}`}
        />
      </button>

      {open && !disabled && (
        <div
          role="listbox"
          className="absolute z-20 mt-2 w-full bg-white rounded-2xl border border-[#3D4331]/10 shadow-xl overflow-hidden max-h-72 overflow-y-auto"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                  isSelected ? "bg-[#F3EDE0]" : "hover:bg-[#F3EDE0]/60"
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  {opt.icon}
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-[#3D4331] truncate">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#3D4331]/50 truncate">
                        {opt.sublabel}
                      </span>
                    )}
                  </span>
                </span>
                {isSelected && <Check size={16} className="text-[#3D4331] shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
