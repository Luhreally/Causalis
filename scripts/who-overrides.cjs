// Which sections define, wrap, or replace a function, in the order they run.
//
// The runtime is one closure of a hundred and thirty-odd sections, and a
// function's behaviour is the last assignment to its name, wrapped round the
// ones before it: `const fooBase = foo; foo = function () { ...fooBase()... }`.
// Nothing in the source lists a chain, so to know what `performCivilLabor`
// does you read seven layers in manifest order and compose them in your head —
// and a layer that never calls its captured base has quietly replaced
// everything before it. This prints the chain: where the name is declared,
// every capture of it as a `...Base` alias, every reassignment, and whether
// each reassignment calls a base or not.
//
// node scripts/who-overrides.cjs <name> [<name>...]
// node scripts/who-overrides.cjs --dead        every reassignment that calls no base
// node scripts/who-overrides.cjs --most [n]    the n most-layered functions
const { readSections } = require("./compose-runtime.cjs");

const sections = readSections().map(({ name, source }) => ({ name, lines: source.split(/\r?\n/) }));
const identifier = /^[A-Za-z_$][\w$]*$/;

// The extent of a top-level statement that starts at `from`: to the first line
// that closes at column zero (`}` or `};` or `});`), inclusive.
function statementEnd(lines, from) {
  for (let n = from; n < lines.length; n++) if (/^\}\)?;?\s*$/.test(lines[n])) return n;
  return from;
}

function chainOf(name) {
  const escaped = name.replace(/[$]/g, "\\$"),
    declares = new RegExp(`^(?:async\\s+)?function\\s+${escaped}\\s*\\(`),
    reassigns = new RegExp(`^${escaped}\\s*=\\s*(?:async\\s+)?function\\b`),
    captures = new RegExp(`^(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${escaped}\\s*;`),
    calls = new RegExp(`(?<![\\w$.])${escaped}\\s*\\(`),
    links = [],
    aliases = [];
  let callSites = 0;
  for (const { name: section, lines } of sections) {
    for (let n = 0; n < lines.length; n++) {
      const line = lines[n];
      if (declares.test(line)) links.push({ kind: "declares", section, line: n + 1 });
      else {
        const captured = line.match(captures);
        if (captured) {
          aliases.push(captured[1]);
          links.push({ kind: "captures as " + captured[1], section, line: n + 1 });
        } else if (reassigns.test(line)) {
          const end = statementEnd(lines, n),
            body = lines.slice(n, end + 1).join("\n"),
            called = aliases.filter((alias) => new RegExp(`(?<![\\w$.])${alias.replace(/[$]/g, "\\$")}\\s*(\\(|\\.call|\\.apply|\\))`).test(body));
          links.push({
            kind: called.length ? "wraps, calls " + called.join(", ") : "REPLACES (calls no base)",
            section,
            line: n + 1,
            span: end - n + 1,
          });
        }
      }
      if (calls.test(line) && !declares.test(line)) callSites++;
    }
  }
  return { name, links, callSites };
}

function everyReassignedName() {
  const names = new Set();
  for (const { lines } of sections)
    for (const line of lines) {
      const m = line.match(/^([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\b/);
      if (m) names.add(m[1]);
    }
  return [...names].sort();
}

function print(chain) {
  console.log(`${chain.name}: ${chain.links.length} link${chain.links.length === 1 ? "" : "s"}, ${chain.callSites} call site${chain.callSites === 1 ? "" : "s"}`);
  for (const link of chain.links)
    console.log(`  ${link.section}:${String(link.line).padEnd(5)} ${link.kind}${link.span ? ` (${link.span} lines)` : ""}`);
  if (!chain.links.length) console.log("  (never declared or assigned as a function)");
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error("usage: node scripts/who-overrides.cjs <name> [<name>...] | --dead | --most [n]");
  process.exit(2);
}
if (args[0] === "--dead") {
  let dead = 0;
  for (const name of everyReassignedName()) {
    const chain = chainOf(name),
      replacing = chain.links.filter((l) => l.kind.startsWith("REPLACES"));
    if (!replacing.length) continue;
    dead += replacing.length;
    for (const link of replacing) console.log(`${name.padEnd(36)} ${link.section}:${link.line}  (${link.span} lines)`);
  }
  console.log(`${dead} reassignment${dead === 1 ? "" : "s"} call no captured base`);
} else if (args[0] === "--most") {
  const n = Number(args[1] || 12),
    layers = (chain) => chain.links.filter((l) => l.kind.startsWith("wraps") || l.kind.startsWith("REPLACES")).length,
    chains = everyReassignedName().map(chainOf).sort((a, b) => layers(b) - layers(a) || a.name.localeCompare(b.name));
  for (const chain of chains.slice(0, n)) console.log(`${String(layers(chain)).padStart(3)} layers  ${chain.name}`);
} else {
  for (const name of args) {
    if (!identifier.test(name)) {
      console.error(`not an identifier: ${name}`);
      process.exitCode = 2;
      continue;
    }
    print(chainOf(name));
  }
}
