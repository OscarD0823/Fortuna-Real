import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  base: process.env.VITE_WEB_BASE || "/",
  plugins: [react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  build: {
    outDir: process.env.VITE_WEB_BUILD === "true" ? "dist-web" : "dist",
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks: (id) => id.includes("node_modules/three") ? "three-engine" : undefined,
      },
    },
  },
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
