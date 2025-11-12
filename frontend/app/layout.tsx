import type { Metadata } from "next";
import { Inter, Dela_Gothic_One } from "next/font/google";
import localFont from "next/font/local";
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

const berlin = localFont({
  src: "./fonts/berlin.ttf",
  weight: "600",
  style: "normal",
  variable: "--font-berlin",
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=New+Rocker&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${inter.variable} ${delaGothic.variable} ${berlin.variable} font-berlin bg-[#E7E4DF]`}
      >
        <Providers>
          <Navbar />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
