import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      name: "BrowserAiVue",
      entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      formats: ["es", "cjs"],
      fileName: (format, entryName = "index") => {
        if (format === "es") return `${entryName}.mjs`;
        return `${entryName}.cjs`;
      },
    },
    rolldownOptions: {
      external: ["vue", "markdown-it"],
      output: {
        exports: "named",
        globals: {
          vue: "Vue",
        },
        minify: true,
      },
    },
  },
});
