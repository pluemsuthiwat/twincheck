import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative asset paths so the build also works from file:// or inside a desktop shell later.
  base: "./",
  worker: { format: "es" },
  // Monaco is large but lazy-loaded with the Raw XML view only.
  build: { chunkSizeWarningLimit: 3000 },
});
