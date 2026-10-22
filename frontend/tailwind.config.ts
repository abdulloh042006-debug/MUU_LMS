import type { Config } from "tailwindcss"
import tailwindcssAnimate from "tailwindcss-animate"

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {sans: ["Inter", "sans-serif"], heading: ["Sora", "sans-serif"]},
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        navy: {
          50: "#f1f3f9",
          100: "#e2e7f2",
          200: "#c6cfe4",
          300: "#9aa9cc",
          400: "#6b7fb0",
          500: "#44588a",
          600: "#2e4070",
          700: "#1b2a4a",
          800: "#14213b",
          900: "#101d34",
          950: "#0a1324",
        },
        gold: {
          50: "#fbf8ee",
          100: "#f5eed6",
          200: "#ebdcae",
          300: "#dfc785",
          400: "#d1b26a",
          500: "#c5a55a",
          600: "#a98a3f",
          700: "#876b30",
          800: "#6b5529",
          900: "#554523",
        },
        teal: {
          50: "#f8f7f4",
          100: "#efebe1",
          200: "#dfd3b8",
          300: "#d3bd89",
          400: "#c5a55a",
          500: "#ab8940",
          600: "#856924",
          700: "#1b2a4a",
          800: "#16233e",
          900: "#0f1a2e",
          950: "#0a1628",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,29,52,0.04), 0 4px 16px -6px rgba(16,29,52,0.08)",
        pop: "0 12px 40px -12px rgba(16,29,52,0.28)",
        lift: "0 2px 4px rgba(16,29,52,0.05), 0 12px 28px -10px rgba(16,29,52,0.18)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config

export default config
