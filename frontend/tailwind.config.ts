import { Caveat } from "next/font/google";
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        berlin: ["var(--font-berlin)", "sans-serif"],
        sans: ["var(--font-inter)", "sans-serif"],
        display: ["var(--font-dela-gothic)", "sans-serif"],
        inter: ["Inter", "sans-serif"],
        Caveat: ["var(--font-caveat)", "sans-serif"]
      },
      colors: {
        "den-blue": "#172a46",
        "den-beige": "#f5f5f3",
      },
    },
  },
  plugins: [],
};

export default config;
