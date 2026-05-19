import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["Cormorant Garamond", "Georgia", "serif"],
        mono: ["DM Mono", "Courier New", "monospace"],
        sans: ["DM Sans", "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          DEFAULT: "#0C0C10",
          2: "#13131A",
          3: "#1A1A24",
          4: "#22222E",
        },
        violet: {
          DEFAULT: "#7C6FD4",
          soft: "#A99EE8",
          dim: "rgba(124,111,212,0.1)",
          glow: "rgba(124,111,212,0.25)",
        },
        jade: {
          DEFAULT: "#3DBFA0",
          dim: "rgba(61,191,160,0.09)",
        },
        amber: {
          DEFAULT: "#E8A74A",
          dim: "rgba(232,167,74,0.09)",
        },
        crimson: {
          DEFAULT: "#E05C5C",
          dim: "rgba(224,92,92,0.09)",
        },
        emerald: {
          DEFAULT: "#5CB87A",
          dim: "rgba(92,184,122,0.09)",
        },
        fog: "#9896B4",
        ghost: "#5C5A78",
        snow: "#F0EFF8",
      },
      animation: {
        "block-in": "blockIn 0.3s cubic-bezier(0.16,1,0.3,1)",
        "pulse-dot": "pulseDot 2s ease infinite",
        "spin-slow": "spin 1.5s linear infinite",
      },
      keyframes: {
        blockIn: {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.99)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        pulseDot: {
          "0%,100%": { opacity: "1", boxShadow: "0 0 0 0 rgba(61,191,160,0.4)" },
          "50%": { opacity: "0.7", boxShadow: "0 0 0 4px rgba(61,191,160,0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
