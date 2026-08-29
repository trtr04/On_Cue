import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    outDir: "frontend-dist",
    emptyOutDir: true,
    assetsDir: "assets",
    rollupOptions: {
      output: {
        entryFileNames: "assets/oncue.js",
        assetFileNames: (assetInfo) =>
          assetInfo.name?.endsWith(".css") ? "assets/oncue.css" : "assets/[name]-[hash][extname]",
      },
    },
  },
});
