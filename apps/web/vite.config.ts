import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

// The root package.json is the single source of the app version (Tauri reads it too).
const { version } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  // Relative asset paths so the build also works from file:// or inside a desktop shell later.
  base: "./",
  worker: { format: "es" },
  // Monaco is large but lazy-loaded with the Raw XML view only.
  build: { chunkSizeWarningLimit: 3000 },
});
