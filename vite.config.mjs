import { createRequire } from "node:module";
import { cp, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";

const require = createRequire(import.meta.url);
const { composeRuntime } = require("./scripts/compose-runtime.cjs");
const virtualId = "virtual:causalis-game";
const resolvedVirtualId = `\0${virtualId}`;
const sectionsRoot = path.resolve("src/game/sections");

function sitesStaticOutput() {
  return {
    name: "causalis-sites-static-output",
    apply: "build",
    async closeBundle() {
      const outputDirectory = path.resolve("dist"),
        clientDirectory = path.join(outputDirectory, "client"),
        serverDirectory = path.join(outputDirectory, "server"),
        metadataDirectory = path.resolve("dist/.openai"),
        hostingSource = path.resolve(".openai/hosting.json");
      await mkdir(clientDirectory, { recursive: true });
      for (const entry of await readdir(outputDirectory, { withFileTypes: true })) {
        if (["client", "server", ".openai"].includes(entry.name)) continue;
        await rename(
          path.join(outputDirectory, entry.name),
          path.join(clientDirectory, entry.name),
        );
      }
      await mkdir(serverDirectory, { recursive: true });
      await mkdir(metadataDirectory, { recursive: true });
      await cp(hostingSource, path.join(metadataDirectory, "hosting.json"));
      await writeFile(
        path.join(serverDirectory, "index.js"),
        `const worker = {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || !request.headers.get("accept")?.includes("text/html")) {
      return response;
    }
    const fallback = new URL("/index.html", request.url);
    return env.ASSETS.fetch(new Request(fallback, request));
  },
};

export default worker;
`,
        "utf8",
      );
      // Read after copying so a missing or malformed project ID fails the build.
      const hosting = JSON.parse(
        await readFile(path.join(metadataDirectory, "hosting.json"), "utf8"),
      );
      if (!hosting.project_id)
        throw new Error("Sites project_id is required for a production build.");
    },
  };
}

export default defineConfig({
  plugins: [
    {
      name: "causalis-section-runtime",
      resolveId(id) {
        return id === virtualId ? resolvedVirtualId : null;
      },
      load(id) {
        return id === resolvedVirtualId ? composeRuntime({ format: "module" }) : null;
      },
      handleHotUpdate({ file, server }) {
        if (!path.resolve(file).startsWith(sectionsRoot)) return;
        const module = server.moduleGraph.getModuleById(resolvedVirtualId);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: "full-reload" });
        return [];
      },
    },
    sitesStaticOutput(),
  ],
  build: {
    outDir: "dist",
    target: "es2022",
    sourcemap: true,
    // The deterministic engine is intentionally composed into one shared closure.
    chunkSizeWarningLimit: 650,
  },
});
