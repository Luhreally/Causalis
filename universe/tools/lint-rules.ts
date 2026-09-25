// The two lints that hold the architecture in place (docs/architecture §2, §6):
// module boundaries (who may import whom) and determinism (what simulation code
// may not touch). Both read the syntax tree from oxc-parser; tools/lint.ts runs
// them over src/, and tests/lint.test.ts pins what they catch.
import { posix } from "node:path";
import { builtinModules } from "node:module";
import { parseSync } from "oxc-parser";

export type Violation = {
  file: string;
  line: number;
  column: number;
  rule: string;
  message: string;
};

export const MODULES = [
  "kernel",
  "rules",
  "gen",
  "sim",
  "causal",
  "bridge",
  "host",
  "view",
  "render",
  "ui",
  "app",
] as const;
export type ModuleName = (typeof MODULES)[number];

// The modules each module may import, always through that module's index.ts.
// Inside its own folder a module imports freely.
export const ALLOWED: Record<ModuleName, readonly ModuleName[]> = {
  kernel: [],
  rules: ["kernel"],
  gen: ["kernel", "rules"],
  sim: ["kernel", "rules", "gen"],
  causal: ["kernel", "rules", "gen", "sim"],
  bridge: ["kernel"],
  host: ["kernel", "rules", "gen", "sim", "causal", "bridge"],
  view: ["kernel", "rules", "bridge"],
  render: ["kernel", "bridge", "view"],
  ui: ["kernel", "bridge", "view"],
  app: ["kernel", "bridge", "view", "render", "ui", "host"],
};

// Third-party packages a module may import. Everything else is written here.
export const PACKAGES: Partial<Record<ModuleName, readonly string[]>> = {
  render: ["playcanvas"],
};

// Modules whose code decides the authoritative history.
export const DETERMINISTIC: ReadonlySet<ModuleName> = new Set([
  "kernel",
  "rules",
  "gen",
  "sim",
  "causal",
]);

// Not bit-identical across JavaScript engines (V8, JavaScriptCore, SpiderMonkey).
export const FORBIDDEN_MATH: ReadonlySet<string> = new Set([
  "random",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "atan2",
  "sinh",
  "cosh",
  "tanh",
  "asinh",
  "acosh",
  "atanh",
  "exp",
  "expm1",
  "log",
  "log1p",
  "log2",
  "log10",
  "pow",
  "cbrt",
  "hypot",
]);

// Clocks, platform, locale, garbage collection and the page: none may reach history.
export const FORBIDDEN_GLOBALS: ReadonlySet<string> = new Set([
  "Date",
  "performance",
  "Intl",
  "crypto",
  "WeakMap",
  "WeakSet",
  "WeakRef",
  "FinalizationRegistry",
  "setTimeout",
  "setInterval",
  "setImmediate",
  "requestAnimationFrame",
  "requestIdleCallback",
  "queueMicrotask",
  "window",
  "document",
  "navigator",
  "globalThis",
  "self",
  "location",
  "fetch",
  "XMLHttpRequest",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "postMessage",
  "SharedArrayBuffer",
  "Atomics",
  "process",
  "require",
  "eval",
  "Function",
]);

export const FORBIDDEN_MEMBERS: ReadonlySet<string> = new Set([
  "localeCompare",
  "toLocaleString",
  "toLocaleDateString",
  "toLocaleTimeString",
  "toLocaleUpperCase",
  "toLocaleLowerCase",
]);

// Subtrees that only describe types; nothing in them runs.
const TYPE_ONLY: ReadonlySet<string> = new Set([
  "TSTypeAnnotation",
  "TSTypeReference",
  "TSInterfaceDeclaration",
  "TSTypeAliasDeclaration",
  "TSTypeParameterInstantiation",
  "TSTypeParameterDeclaration",
  "TSDeclareFunction",
  "TSModuleDeclaration",
  "TSImportType",
  "TSTypeQuery",
]);

type Node = { type: string; start: number; end: number; [key: string]: unknown };

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && typeof (value as Node).type === "string";
}

function walk(
  node: unknown,
  visit: (n: Node, parent: Node | null) => boolean,
  parent: Node | null,
) {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit, parent);
    return;
  }
  if (!isNode(node)) return;
  if (!visit(node, parent)) return;
  for (const key of Object.keys(node)) {
    if (key === "type" || key === "start" || key === "end") continue;
    const value = node[key];
    if (typeof value === "object" && value !== null) walk(value, visit, node);
  }
}

function lineIndex(text: string): (offset: number) => { line: number; column: number } {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return (offset) => {
    let lo = 0,
      hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((starts[mid] ?? 0) <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, column: offset - (starts[lo] ?? 0) + 1 };
  };
}

function parse(file: string, text: string) {
  const result = parseSync(file, text, { sourceType: "module", lang: "ts" });
  return { program: result.program as unknown as Node, errors: result.errors };
}

/** The module a src/ path belongs to, or null outside src/. Paths use forward slashes. */
export function moduleOf(file: string): ModuleName | null {
  const parts = file.split("/");
  if (parts[0] !== "src" || parts.length < 3) return null;
  const name = parts[1] as ModuleName;
  return (MODULES as readonly string[]).includes(name) ? name : null;
}

function name(node: unknown): string | null {
  return isNode(node) && node.type === "Identifier" ? (node.name as string) : null;
}

/** Determinism rules for one file of a deterministic module. */
export function lintDeterminism(file: string, text: string): Violation[] {
  const { program, errors } = parse(file, text);
  const at = lineIndex(text),
    out: Violation[] = [],
    seen = new Set<string>();
  // A shorthand property ({ Date }) is visited as its key and as its value; report it once.
  const report = (node: Node, rule: string, message: string) => {
    const key = `${rule}:${node.start}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ file, ...at(node.start), rule, message });
  };
  for (const error of errors)
    out.push({ file, line: 1, column: 1, rule: "parse", message: error.message });
  walk(
    program,
    (n, parent) => {
      if (TYPE_ONLY.has(n.type)) return false;
      if (n.type === "ImportDeclaration" && n.importKind === "type") return false;
      if (n.type === "MemberExpression") {
        const object = name(n.object),
          property = n.computed ? null : name(n.property);
        if (object === "Math") {
          if (n.computed) report(n, "math", "computed access on Math hides which function runs");
          else if (property && FORBIDDEN_MATH.has(property))
            report(n, "math", `Math.${property} is not bit-identical across engines; use dmath`);
        }
        if (property && FORBIDDEN_MEMBERS.has(property))
          report(n, "locale", `${property} depends on the device's locale`);
      }
      if (n.type === "Identifier" && FORBIDDEN_GLOBALS.has(n.name as string)) {
        const p = parent,
          isKey =
            p !== null &&
            (((p.type === "MemberExpression" || p.type === "JSXMemberExpression") &&
              p.property === n &&
              !p.computed) ||
              ((p.type === "Property" ||
                p.type === "MethodDefinition" ||
                p.type === "PropertyDefinition") &&
                p.key === n &&
                !p.computed &&
                !p.shorthand));
        if (!isKey)
          report(
            n,
            "global",
            `${n.name as string} is outside the simulation's inputs (clock, platform or page)`,
          );
      }
      if (n.type === "CallExpression" && isNode(n.callee) && n.callee.type === "MemberExpression") {
        const method = n.callee.computed ? null : name(n.callee.property);
        if ((method === "sort" || method === "toSorted") && (n.arguments as unknown[]).length === 0)
          report(
            n,
            "sort",
            `${method}() without a comparator sorts as strings; pass a total-order comparator`,
          );
      }
      if (n.type === "BinaryExpression" && n.operator === "**") {
        const left = n.left as Node,
          right = n.right as Node,
          exact =
            left.type === "Literal" &&
            right.type === "Literal" &&
            typeof right.value === "number" &&
            Number.isInteger(right.value) &&
            right.value >= 0;
        if (!exact)
          report(n, "math", "** is Math.pow; use dmath (literal integer powers are allowed)");
      }
      if (n.type === "AssignmentExpression" && n.operator === "**=")
        report(n, "math", "**= is Math.pow; use dmath");
      return true;
    },
    null,
  );
  return out;
}

function importSources(program: Node): Node[] {
  const sources: Node[] = [];
  walk(
    program,
    (n) => {
      if (
        (n.type === "ImportDeclaration" ||
          n.type === "ExportNamedDeclaration" ||
          n.type === "ExportAllDeclaration" ||
          n.type === "ImportExpression") &&
        isNode(n.source)
      )
        sources.push(n.source);
      if (n.type === "TSImportType" && isNode(n.argument)) {
        const literal = (n.argument as Node).literal;
        if (isNode(literal)) sources.push(literal);
        else sources.push(n.argument as Node);
      }
      return true;
    },
    null,
  );
  return sources;
}

const NODE_BUILTINS: ReadonlySet<string> = new Set(builtinModules);

/** Module-boundary rules for one file under src/. */
export function lintBoundaries(file: string, text: string): Violation[] {
  const from = moduleOf(file);
  if (!from) return [];
  const { program } = parse(file, text);
  const at = lineIndex(text),
    out: Violation[] = [];
  for (const source of importSources(program)) {
    const spec = source.value;
    const report = (rule: string, message: string) =>
      out.push({ file, ...at(source.start), rule, message });
    if (typeof spec !== "string") {
      report("import", "imports must name a literal path");
      continue;
    }
    if (spec.startsWith("node:") || NODE_BUILTINS.has(spec.split("/")[0] ?? "")) {
      report("platform", `${spec}: src runs in the browser and the worker, not in Node`);
      continue;
    }
    if (spec.startsWith("./") || spec.startsWith("../")) {
      if (!/\.(ts|css|json)$/.test(spec)) {
        report("extension", `${spec}: relative imports name their file with its extension (.ts)`);
        continue;
      }
      const target = posix.normalize(posix.join(posix.dirname(file), spec));
      const to = moduleOf(target);
      if (!target.startsWith("src/") || !to) {
        report("outside", `${spec}: src may only import from src`);
        continue;
      }
      if (to === from) continue;
      if (!ALLOWED[from].includes(to)) {
        report(
          "boundary",
          `${from} may not import ${to} (allowed: ${ALLOWED[from].join(", ") || "nothing"})`,
        );
        continue;
      }
      if (target !== `src/${to}/index.ts`)
        report("index", `${spec}: import ${to} through src/${to}/index.ts, not its inside`);
      continue;
    }
    const pkg = spec.startsWith("@")
      ? spec.split("/").slice(0, 2).join("/")
      : (spec.split("/")[0] ?? spec);
    if (!(PACKAGES[from] ?? []).includes(pkg))
      report("package", `${from} may not import the package ${pkg}`);
  }
  return out;
}
