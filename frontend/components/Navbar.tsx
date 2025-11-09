"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ConnectKitButton } from "connectkit";
import { useAccount } from "wagmi";
import { Menu, X } from "lucide-react";

export function Navbar() {
  const { isConnected } = useAccount();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { href: "/experiences", label: "EXPERIENCES" },
    { href: "/villas", label: "UPCOMING VILLAS" },
    { href: "/about", label: "ABOUT" },
    { href: "/contact", label: "CONTACT" },
  ];

  return (
    <nav className="bg-transparent text-white w-full z-50 sticky top-0">
      <div className="max-w-screen-xl mx-auto px-6 py-6">
        {/* Desktop Navigation */}
        <div className="hidden md:flex justify-between items-center bg-[#172a46] border-2 border-[#2a4562] rounded-full py-4 px-10 shadow-xl">
          {/* Left side links */}
          <div className="flex items-center gap-10">
            <Link
              href="/experiences"
              className="text-sm font-semibold text-gray-300 hover:text-white transition-colors uppercase tracking-wide"
            >
              Experiences
            </Link>
            <Link
              href="/villas"
              className="text-sm font-semibold text-gray-300 hover:text-white transition-colors uppercase tracking-wide"
            >
              Upcoming Villas
            </Link>
          </div>

          {/* Logo - Centered */}
          <Link href="/" className="absolute left-1/2 -translate-x-1/2">
            <Image
              src="/images/logo-no-bg.png"
              alt="DEDEN Logo"
              width={207}
              height={116}
              className="h-[58px] w-auto"
              priority
            />
          </Link>

          {/* Right side links & Wallet Button */}
          <div className="flex items-center gap-8">
            <Link
              href="/about"
              className="text-sm font-semibold text-gray-300 hover:text-white transition-colors uppercase tracking-wide"
            >
              About
            </Link>
            <Link
              href="/contact"
              className="text-sm font-semibold text-gray-300 hover:text-white transition-colors uppercase tracking-wide"
            >
              Contact
            </Link>
            <ConnectKitButton.Custom>
              {({ isConnected, show, truncatedAddress, ensName }) => {
                return (
                  <button
                    onClick={show}
                    className="bg-[#f5f5f3] text-[#172a46] text-sm font-bold py-3 px-6 rounded-full transition-all hover:scale-105 hover:bg-white shadow-lg flex items-center gap-2"
                  >
                    {isConnected ? (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        {ensName ?? truncatedAddress}
                      </>
                    ) : (
                      "CONNECT WALLET"
                    )}
                  </button>
                );
              }}
            </ConnectKitButton.Custom>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden flex justify-between items-center">
          {/* Logo */}
          <Link href="/">
            <Image
              src="/images/logo-no-bg.png"
              alt="DEDEN Logo"
              width={100}
              height={35}
              className="h-8 w-auto"
              priority
            />
          </Link>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-lg hover:bg-[#2a4562] transition-colors"
          >
            {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMenuOpen && (
        <div className="md:hidden bg-[#1a3352] border-t-2 border-[#2a4562] px-6 py-6 space-y-4 shadow-2xl">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsMenuOpen(false)}
              className="block text-center text-base font-semibold text-gray-300 hover:text-white py-3 rounded-lg hover:bg-[#2a4562] transition-colors uppercase tracking-wide"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-4 flex justify-center">
            <ConnectKitButton.Custom>
              {({ isConnected, show, truncatedAddress, ensName }) => {
                return (
                  <button
                    onClick={show}
                    className="bg-[#f5f5f3] text-[#172a46] text-sm font-bold py-3 px-6 rounded-full transition-all hover:scale-105 hover:bg-white shadow-lg w-full flex items-center justify-center gap-2"
                  >
                    {isConnected ? (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        {ensName ?? truncatedAddress}
                      </>
                    ) : (
                      "CONNECT WALLET"
                    )}
                  </button>
                );
              }}
            </ConnectKitButton.Custom>
          </div>
        </div>
      )}
    </nav>
  );
}