import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // AKSU Vice-Chancellor's Cup — design tokens
        base: "#08090B",        // page background — near-black
        surface: "#15171C",     // card background
        surface2: "#1D2027",    // raised card / hover
        surface3: "#262A32",    // pitch card frame
        line: "#262A32",        // hairline borders
        win: "#1FD97A",         // winning score / live
        loss: "#FF4757",        // losing score / red card
        gold: "#F4B740",        // yellow card / mid rating
        accent: "#F2661F",      // AKSU crest orange — brand, active state, links
        accent2: "#FF8A50",     // lighter orange for gradients/hover
        pitch: "#0E1F16",       // formation pitch turf
        pitchLine: "#22402E",   // pitch markings
      },
      fontFamily: {
        // Closest free stand-in for D-DIN — condensed, geometric, technical.
        sans: ["var(--font-din)", "system-ui", "sans-serif"],
        score: ["var(--font-din)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
      },
      boxShadow: {
        premium: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 10px 30px -12px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};
export default config;
