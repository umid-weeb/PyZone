import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "/arena-spa/" : "/",
  publicDir: false,
  build: {
    outDir: path.resolve(__dirname, "../public/arena-spa"),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
  },
}));
