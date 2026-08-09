import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1C1B19",
        paper: "#FAFAF8",
        card: "#FFFFFF",
        line: "#E7E4DD",
        teal: {
          DEFAULT: "#215A4C",
          soft: "#E4EEEA",
        },
        amber: {
          DEFAULT: "#C87A1A",
          soft: "#FBEDD9",
        },
        red: {
          DEFAULT: "#B3453A",
          soft: "#F7E7E5",
        },
        muted: {
          DEFAULT: "#8A8578",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
