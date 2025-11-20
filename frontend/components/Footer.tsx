"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";
import { Inter, Dela_Gothic_One } from "next/font/google";
import { usePathname } from "next/navigation";

const delaGothic = Dela_Gothic_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dela-gothic",
});

const Footer = () => {
  const pathname = usePathname();

  // Active route checker
  const isActive = (route: String) => pathname === route;

  return (
    <footer
      className={`bg-[#172a46] text-white pt-10 pb-12 relative ${delaGothic.variable} overflow-hidden`}
    >
      {/* Top Wave (Inverted) */}

      <div className=" w-full mx-6 md:mx-30 px-6 z-10 relative">
        {/* Footer content */}
        <div className=" grid md:grid-cols-5 gap-12 mb-16">
          <div className=" col-span-2 md:col-span-1">
            <div className="mb-2">
              <Image
                src="/images/logo-no-bg.png"
                alt="DEDEN Logo"
                width={140}
                height={50}
                className=" w-auto -mb-2"
              />
              <div className="flex gap-3 md:w-9/12  md:justify-end invert">
                <a
                  href="https://www.instagram.com/decentralizedden/"
                  target="_blank"
                >
                  <Image
                    src="/insta_icon.png"
                    alt="DEDEN Logo"
                    width={140}
                    height={50}
                    className=" w-[40px] cursor-pointer"
                  />
                </a>
                <a
                  href="https://chat.whatsapp.com/IXzTVWE40zGDrKxoDTVHv5"
                  target="_blank"
                >
                  <Image
                    src="/wp_icon.png"
                    alt="DEDEN Logo"
                    width={140}
                    height={50}
                    className=" w-[40px] cursor-pointer"
                  />
                </a>

                <a href="https://x.com/TheDeDenn" target="_blank">
                  <Image
                    src="/x_icon.png"
                    alt="DEDEN Logo"
                    width={140}
                    height={50}
                    className=" w-[40px] cursor-pointer"
                  />
                </a>
              </div>
            </div>
          </div>
          <div className="col-span-2 md:col-span-1"></div>
          <div className="col-span-2 md:col-span-1">
            <h4 className="font-bold text-lg mb-5 text-gray-400">Explore</h4>
            <ul className="space-y-3 text-sm text-gray-200">
              <li>
                <Link
                  href="/#about"
                  className="hover:text-white transition-colors"
                >
                  About DeDen
                </Link>
              </li>
              <li>
                <Link
                  href="/villas"
                  className="hover:text-white transition-colors"
                >
                  Upcoming Stays
                </Link>
              </li>

              <li>
                <Link
                  href="/#gallery"
                  className="hover:text-white transition-colors"
                >
                  The Experience
                </Link>
              </li>
              <li>
                <a
                  href="https://drive.google.com/drive/folders/1TcaTYpXnxF_1QUmIzUA3Db6May78WTX4?usp=sharing"
                  target="_blank"
                  className="hover:text-white transition-colors"
                >
                  Brand Assets
                </a>
              </li>

              <li>
                <Link
                  href="/contact"
                  className="hover:text-white transition-colors"
                >
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>
          <div className="col-span-2 md:col-span-2">
            <p className="text-sm text-gray-400 mb-3">Get in touch</p>
            <p className="text-sm text-gray-200 mb-1">+91 91615 56758</p>
            <p className="text-sm text-gray-200">support@deden.space</p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-center text-gray-400 text-sm mb-4">
          2025 DecentralizedDen. All rights reserved.
        </p>

        {/* Bottom Navigation Bar */}
        <div
          className=" hidden md:flex bg-[#E7E4DF] text-black rounded-full py-2 px-3 
          max-w-2xl mx-auto  justify-between items-center mb-14 shadow-lg"
        >
          {/* HOME */}
          <Link
            href="/"
            className={`font-bold text-base py-5 px-10 rounded-full transition-all
              ${
                isActive("/")
                  ? "bg-[#172a46] text-[#E7E4DF]"
                  : "text-[#172a46] hover:opacity-70"
              }`}
          >
            Home
          </Link>

          {/* VILLAS */}
          <Link
            href="/villas"
            className={`font-semibold text-base py-5 px-10 rounded-full transition-all
              ${
                isActive("/villas")
                  ? "bg-[#172a46] text-[#E7E4DF]"
                  : "text-gray-700 hover:text-[#172a46]"
              }`}
          >
            Villas
          </Link>

          {/* EXPERIENCES */}
          <Link
            href="/#gallery"
            className={`font-semibold text-base py-5 px-10 rounded-full transition-all
              ${
                isActive("/experiences")
                  ? "bg-[#172a46] text-[#E7E4DF]"
                  : "text-gray-700 hover:text-[#172a46]"
              }`}
          >
            Experiences
          </Link>

          {/* CAREERS */}
          <Link
            href="/careers"
            className={`font-semibold text-base py-5 px-10 rounded-full transition-all
              ${
                isActive("/careers")
                  ? "bg-[#172a46] text-[#E7E4DF]"
                  : "text-gray-700 hover:text-[#172a46]"
              }`}
          >
            Careers
          </Link>
        </div>
      </div>

      <div className="w-full text-center bg-[#172a46] mt-16 -mb-14 md:-mb-20">
        <h1
          className="text-2xl md:text-8xl lg:text-8xl font-medium text-[#E7E4DF] leading-[0.95] tracking-tight"
          style={{
            fontFamily: "'New Rocker', cursive",
            letterSpacing: "-0.07em",
          }}
        >
          Where Web3 lives and Builders Connect
        </h1>
      </div>
    </footer>
  );
};

export default Footer;
