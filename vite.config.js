import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// base: './' so bundled assets resolve when the panel is loaded as chrome-extension://.../panel.html
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        panel: resolve(__dirname, "panel.html"),
      },
      output: {
        assetFileNames: "assets/[name].[ext]",
        chunkFileNames: "assets/[name].js",
        entryFileNames: "assets/[name].js",
      },
    },
  },
});
