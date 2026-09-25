import { defineConfig } from "vite";

// GitHub Pages serves Classic at /Causalis/ and this app at /Causalis/universe/.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/Causalis/universe/" : "/",
  build: { outDir: "dist", target: "es2022", sourcemap: true },
  worker: { format: "es" },
});
