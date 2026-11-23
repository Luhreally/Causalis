import { readFileSync, readdirSync } from "node:fs";
import { defineConfig } from "vite";

/**
 * Every character past plain ASCII the game's sources hold (its words' signs, emoji and letters of other scripts), for the
 * screen to lay out once ahead, so the fonts they fall back to are found before they are first shown (src/ui/glyphs.ts).
 */
function hudGlyphs(): string {
  const seen = new Set<string>();
  for (const f of readdirSync("src", { recursive: true }) as string[])
    if (/\.(ts|css|html)$/.test(f))
      for (const ch of readFileSync(`src/${f}`, "utf8"))
        if (ch.codePointAt(0)! > 127 && !/\s/.test(ch)) seen.add(ch);
  return [...seen].sort().join("");
}

// GitHub Pages serves Classic at /Causalis/ and this app at /Causalis/universe/.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/Causalis/universe/" : "/",
  build: { outDir: "dist", target: "es2022", sourcemap: true },
  worker: { format: "es" },
  define: { __HUD_GLYPHS__: JSON.stringify(hudGlyphs()) },
});
