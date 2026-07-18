"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

const Footer = () => {
  return (
    <footer className="bg-[#f7eedb] text-[#2c331f] pt-20 pb-8 w-full border-t border-[#2c331f]/10">
      <div className="max-w-[1100px] mx-auto px-6">
        
        {/* Top section with columns */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-20">
          
          {/* Brand Column */}
          <div className="flex flex-col max-w-[200px]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-[#7e9154] rounded flex items-center justify-center">
                 <span className="text-white text-xs font-bold font-display leading-none pb-0.5">e</span>
              </div>
              <span className="text-2xl font-bold tracking-tight text-[#7e9154]">eDen</span>
            </div>
            <p className="text-xl italic font-bold mb-4 text-[#7e9154]" style={{ fontFamily: "'Caveat', cursive" }}>
              Meet. Travel. Stay. Repeat.
            </p>
            <p className="text-[9px] uppercase tracking-wider font-bold opacity-70 leading-relaxed text-[#2c331f]">
              Curated stays for people building<br/>the decentralized future.
            </p>
          </div>
          
          {/* Links Columns */}
          <div className="flex flex-wrap gap-12 md:gap-24">
            
            {/* Explore */}
            <div className="flex flex-col gap-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-1">Explore</h4>
              <Link href="#" className="text-[11px] font-bold uppercase tracking-widest opacity-80 hover:opacity-100 transition-opacity">About</Link>
              <Link href="#" className="text-[11px] font-bold uppercase tracking-widest opacity-80 hover:opacity-100 transition-opacity">Live Stays</Link>
              <Link href="#" className="text-[11px] font-bold uppercase tracking-widest opacity-80 hover:opacity-100 transition-opacity">Past Stays</Link>
              <Link href="#" className="text-[11px] font-bold uppercase tracking-widest opacity-80 hover:opacity-100 transition-opacity">The Crews</Link>
            </div>
            
            {/* Company */}
            <div className="flex flex-col gap-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-1">Company</h4>
              <Link href="#" className="text-[11px] font-bold uppercase tracking-widest opacity-80 hover:opacity-100 transition-opacity">Host a Den</Link>
              <Link href="#" className="text-[11px] font-bold uppercase tracking-widest opacity-80 hover:opacity-100 transition-opacity">Brand Kit</Link>
              <Link href="#" className="text-[11px] font-bold uppercase tracking-widest opacity-80 hover:opacity-100 transition-opacity">Contact Us</Link>
            </div>
            
            {/* Follow */}
            <div className="flex flex-col gap-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-1">Follow</h4>
              <a href="#" className="text-[11px] font-bold uppercase tracking-widest opacity-80 hover:opacity-100 transition-opacity">Twitter</a>
              <a href="#" className="text-[11px] font-bold uppercase tracking-widest opacity-80 hover:opacity-100 transition-opacity">LinkedIn</a>
              <a href="#" className="text-[11px] font-bold uppercase tracking-widest opacity-80 hover:opacity-100 transition-opacity">TikTok</a>
            </div>
            
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-[#2c331f]/20 gap-4">
          <p className="text-[9px] font-bold uppercase tracking-widest opacity-60">
            © 2024 eDen. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-[9px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity">Privacy Policy</a>
            <a href="#" className="text-[9px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity">Terms of Service</a>
          </div>
        </div>
        
      </div>
    </footer>
  );
};

export default Footer;

