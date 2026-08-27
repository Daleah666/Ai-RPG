import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#070708",
        panel: "#121214",
        line: "#2a2824",
        gold: "#c4a35a",
        cream: "#efe7d6",
        mist: "#9a9488",
        ember: "#d4785a",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Outfit", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(196, 163, 90, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
