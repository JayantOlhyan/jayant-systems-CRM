import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        app: {
          bg: "var(--bg-app)",
          sidebar: "var(--bg-sidebar)",
          surface: "var(--bg-surface)",
          secondary: "var(--bg-secondary)",
          elevated: "var(--bg-elevated)",
          border: "var(--border-subtle)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        accent: {
          DEFAULT: "#7958F5",
          hover: "#6846E8",
          subtle: "var(--accent-subtle)",
        },
        status: {
          success: "#32B881",
          warning: "#E9AE50",
          error: "#E56B73",
          info: "#659BFA",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        heading: ["var(--font-manrope)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
