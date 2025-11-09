import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        display: ["var(--font-dela-gothic)", "sans-serif"],
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