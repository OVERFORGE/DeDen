import type { Metadata } from "next";
import { Inter, Dela_Gothic_One } from "next/font/google";
import "./globals.css";

import { Providers } from "@/app/providers";
import { Navbar } from "@/components/Navbar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const delaGothic = Dela_Gothic_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dela-gothic",
});

export const metadata: Metadata = {
  title: "Decentralized Den - Stay. Build. Connect.",
  description: "Web3 residencies and community stays, paid in crypto.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Add Google Fonts for New Rocker */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=New+Rocker&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${inter.variable} ${delaGothic.variable} font-sans bg-[#f5f5f3]`}
      >
        <Providers>
          <Navbar />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}