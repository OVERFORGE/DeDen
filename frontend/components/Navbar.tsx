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
    { href: "/#about", label: "ABOUT" },
    { href: "/contact", label: "CONTACT" },
  ];

  const handleSignIn = () => {
    router.push("/auth/signin");
  };

  const handleDashboard = () => {
    router.push("/dashboard");
  };

  return (
    <nav className="bg-[#f7eedb] text-[#2c331f] w-full z-50 sticky top-0 border-b border-b-2 border-[#2c331f]">
      <div className="font-inter max-w-screen-xl mx-auto px-6 py-3 relative">
        {/* Desktop Navigation */}
        <div className="hidden md:flex justify-between items-center">
          {/* Logo - Left */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/deden-logo-dark.png"
              alt="DEDEN Logo"
              width={120}
              height={40}
              className="h-12 w-auto"
              priority
            />
          </Link>

          {/* Center links */}
          <div className="flex items-center gap-8">
            <Link href="/experiences" className="text-sm font-semibold text-[#2B3B1A] hover:text-[#3A4F24] transition-colors tracking-widest">
              Experiences
            </Link>
            <Link href="/villas" className="text-sm font-semibold text-[#2B3B1A] hover:text-[#3A4F24] transition-colors tracking-widest">
              Stays
            </Link>
            <Link href="/#about" className="text-sm font-semibold text-[#2B3B1A] hover:text-[#3A4F24] transition-colors tracking-widest">
              About
            </Link>
            <Link href="/contact" className="text-sm font-semibold text-[#2B3B1A] hover:text-[#3A4F24] transition-colors tracking-widest">
              Contact
            </Link>
          </div>

          {/* Right: Auth */}
          <div className="flex items-center gap-4">
            {status === "loading" ? (
              <button className="bg-[#3A4F24] text-[#F2EDE4] text-sm font-bold py-2 pl-5 pr-2 rounded-full flex items-center gap-3">
                <span>Loading...</span>
                <div className="bg-[#F2EDE4] rounded-full p-1.5"><span className="block w-4 h-4" /></div>
              </button>
            ) : status === "authenticated" && session.user ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDashboard}
                  className="flex items-center gap-2 bg-[#3A4F24] hover:bg-[#2B3B1A] text-[#F2EDE4] pl-5 pr-2 py-2 rounded-full transition-all"
                >
                  {session.user.image ? (
                    <Image src={session.user.image} alt={session.user.name || "User"} width={26} height={26} className="rounded-full" />
                  ) : (
                    <div className="bg-[#F2EDE4] rounded-full p-1"><User size={16} className="text-[#3A4F24]" /></div>
                  )}
                  <span className="text-sm font-semibold">{session.user.name || "Dashboard"}</span>
                </button>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transition-all"
                  title="Sign Out"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="bg-[#9db47d] hover:bg-[#2B3B1A] text-[#2c331f] hover:text-[#f7eedb] text-sm font-bold pl-5 pr-5 py-2 rounded-xl flex items-center gap-3 transition-all shadow-[2px_2px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] border-2 border-[#2c331f] hover:border-[#2c331f]"
              >
                <span>Login</span>
                
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden flex justify-between items-center">
          <Link href="/">
            <Image
              src="/images/deden-logo-dark.png"
              alt="DEDEN Logo"
              width={100}
              height={35}
              className="h-12 w-auto rounded-md"
              priority
            />
          </Link>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-lg bg-[#3A4F24] transition-colors z-10"
          >
            {isMenuOpen ? <X size={20} className="text-white" /> : <Menu size={20} className="text-white" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      <div className="">
        {isMenuOpen && (
          <div className="font-inter z-50 absolute md:hidden rounded-2xl bg-[#2B3B1A] border border-[#3A4F24] px-8 py-6 space-y-4 shadow-2xl right-6 mt-2 w-64">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="block text-center text-sm font-semibold text-[#C8D8A4] hover:text-white py-2 rounded-lg hover:bg-[#3A4F24] transition-colors uppercase tracking-wide"
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
                    className="bg-[#3A4F24] hover:bg-[#4A5C2F] text-white py-3 px-6 rounded-full transition-all w-full"
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
                  className="bg-[#F2EDE4] text-[#2B3B1A] text-sm font-bold py-3 px-6 rounded-full transition-all hover:bg-white shadow-lg w-full"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        )}
      </div>

    </nav>
  );
}
