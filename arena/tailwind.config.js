/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        arena: "0 24px 64px rgba(0, 0, 0, 0.34)",
      },
      colors: {
        arena: {
          bg: "#050c18",
          surface: "rgba(10, 18, 34, 0.88)",
          strong: "rgba(15, 25, 47, 0.96)",
          soft: "rgba(255, 255, 255, 0.03)",
          border: "rgba(122, 158, 255, 0.18)",
          borderStrong: "rgba(122, 158, 255, 0.34)",
          text: "#edf2ff",
          muted: "#8ca3c9",
          primary: "#6c92ff",
          primaryStrong: "#96b4ff",
          success: "#57dfb4",
          warning: "#ffcc66",
          danger: "#ff7b8f",
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "sans-serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};
