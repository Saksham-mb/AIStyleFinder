/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // App palette
        sand:       "#E7D4AE",
        maroon: {
          DEFAULT:  "#512223",
          dark:     "#371617",
          deep:     "#4B2020",
          deeper:   "#3D1818",
        },
        espresso:   "#2C1810",
        gold:       "#D4A017",
      },
      fontFamily: {
        jost:           ["'Jost'", "sans-serif"],
        montserrat:     ["'Montserrat'", "sans-serif"],
        "mont-alt":     ["'Montserrat Alternates'", "sans-serif"],
        bokor:          ["'Bokor'", "cursive"],
        instrument:     ["'Instrument Serif'", "serif"],
      },
      keyframes: {
        barPulse: {
          "0%, 100%": { transform: "scaleX(0.25)", opacity: "0.5" },
          "50%":       { transform: "scaleX(1)",    opacity: "1"   },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to:   { opacity: "1", transform: "translateY(0)"    },
        },
        lbFadeIn: {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
      },
      animation: {
        barPulse: "barPulse 1.1s ease-in-out infinite",
        fadeUp:   "fadeUp 0.38s ease both",
        lbFadeIn: "lbFadeIn 0.2s ease",
      },
    },
  },
  plugins: [],
}