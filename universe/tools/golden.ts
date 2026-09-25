// node tools/golden.ts [--write] — compare (or rewrite) tests/golden/kernel.json.
// Rewrite only when a kernel change is meant to change every universe, and say
// so in the commit: the golden file is what the other engines are held to.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { kernelDigest, kernelVectors } from "../tests/vectors/kernel.ts";

const path = fileURLToPath(new URL("../tests/golden/kernel.json", import.meta.url));
const vectors = kernelVectors(),
  digest = kernelDigest(vectors);
if (process.argv.includes("--write")) {
  mkdirSync(fileURLToPath(new URL("../tests/golden/", import.meta.url)), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify({ digest, vectors }, null, 0).replace(/\],\[/g, "],\n[") + "\n",
  );
  console.log(`wrote ${vectors.length} vectors, digest ${digest}`);
} else {
  const golden = JSON.parse(readFileSync(path, "utf8")) as {
    digest: string;
    vectors: [string, string][];
  };
  const diffs = vectors.filter(
    ([label, value], i) => golden.vectors[i]?.[0] !== label || golden.vectors[i]?.[1] !== value,
  );
  console.log(`digest ${digest} (golden ${golden.digest}), ${diffs.length} differing vectors`);
  for (const d of diffs.slice(0, 20)) console.log("  ", d.join(" = "));
  if (diffs.length || digest !== golden.digest) process.exitCode = 1;
}
