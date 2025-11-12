"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Menu, X, User, LogOut } from "lucide-react";
import { useSession, signOut } from "next-auth/react";

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: session, status } = useSession();
  const router = useRouter();

  const navLinks = [
    { href: "/experiences", label: "EXPERIENCES" },
    { href: "/villas", label: "UPCOMING VILLAS" },
    { href: "/about", label: "ABOUT" },
    { href: "/contact", label: "CONTACT" },
  ];

  const handleSignIn = () => {
    router.push("/auth/signin");
  };

  const handleDashboard = () => {
    router.push("/dashboard");
  };

  return (
    <nav className="bg-transparent text-white w-full z-50 sticky top-0">
      <div className="max-w-screen-xl mx-auto px-6 py-6">
        {/* Desktop Navigation */}
        <div className="hidden md:flex justify-between items-center bg-[#172a46] border-2 border-[#2a4562] rounded-[20px] py-4 px-10 shadow-xl">
          {/* Left side links */}
          <div className="flex items-center gap-10">
            <Link
              href="/experiences"
              className="text-md font-bold text-gray-300 hover:text-white transition-colors uppercase tracking-wide"
            >
              Experiences
            </Link>
            <Link
              href="/villas"
              className="text-sm font-bold text-gray-300 hover:text-white transition-colors uppercase tracking-wide"
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
              className="h-[96px] w-auto"
              priority
            />
          </Link>

          {/* Right side links & Auth */}
          <div className="flex items-center gap-8">
            <Link
              href="/about"
              className="text-md font-bold text-gray-300 hover:text-white transition-colors uppercase tracking-wide"
            >
              About
            </Link>
            <Link
              href="/contact"
              className="text-sm font-bold text-gray-300 hover:text-white transition-colors uppercase tracking-wide"
            >
              Contact
            </Link>

            {/* Auth Section */}
            {status === "loading" ? (
              <button className="bg-[#f5f5f3] text-[#172a46] text-sm font-bold py-3 px-6 rounded-[14px] shadow-lg">
                ...
              </button>
            ) : status === "authenticated" && session.user ? (
              <div className="flex items-center gap-3">
                {/* User Profile */}
                <button
                  onClick={handleDashboard}
                  className="flex items-center gap-2 bg-[#2a4562] hover:bg-[#3a5572] text-white px-4 py-2 rounded-[14px] transition-all"
                >
                  {session.user.image ? (
                    <Image
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      width={28}
                      height={28}
                      className="rounded-full"
                    />
                  ) : (
                    <User size={20} />
                  )}
                  <span className="text-sm font-semibold">
                    {session.user.name || "Dashboard"}
                  </span>
                </button>

                {/* Sign Out */}
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transition-all"
                  title="Sign Out"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="bg-[#f5f5f3] text-[#172a46] text-sm font-bold py-3 px-6 rounded-[14px] transition-all hover:scale-105 hover:bg-white shadow-lg"
              >
                SIGN IN
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden flex justify-between items-center">
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
            {status === "authenticated" && session.user ? (
              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={() => {
                    handleDashboard();
                    setIsMenuOpen(false);
                  }}
                  className="bg-[#2a4562] hover:bg-[#3a5572] text-white py-3 px-6 rounded-full transition-all w-full"
                >
                  Dashboard
                </button>
                <button
                  onClick={() => {
                    signOut({ callbackUrl: "/" });
                    setIsMenuOpen(false);
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white py-3 px-6 rounded-full transition-all w-full"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  handleSignIn();
                  setIsMenuOpen(false);
                }}
                className="bg-[#f5f5f3] text-[#172a46] text-sm font-bold py-3 px-6 rounded-full transition-all hover:scale-105 hover:bg-white shadow-lg w-full"
              >
                SIGN IN
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
