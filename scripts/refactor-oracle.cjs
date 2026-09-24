// Did a refactor change the game? This records what the game does and says,
// so a change meant to leave it alone can be checked against a golden copy.
//
// The baseline test hashes one young world at year eight, and nothing a grown
// town does happens by then: a swap of two late systems moved the year-66
// city within 128 ticks and left the baseline hash where it was. So the oracle
// also runs both grown fixtures, and it reads what the player reads: every
// event's sentence and category, and the pages and panels a grown world shows.
//
//   node scripts/refactor-oracle.cjs --out golden.json      record
//   node scripts/refactor-oracle.cjs --compare golden.json  record and diff
//
// Parts run in parallel, one process each (--part road|battery|phone).
const fs = require("node:fs");
const zlib = require("node:zlib");
const path = require("node:path");
const { spawn } = require("node:child_process");

const PARTS = ["road", "battery", "phone"];
const argv = process.argv.slice(2);
const option = (name) => {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : null;
};

// FNV-1a over a string: a short, stable name for a long text.
function digest(text) {
  let h = 2166136261 >>> 0;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

async function runPart(part) {
  const { loadRuntime } = require("./runtime-probe.cjs");
  const rt = loadRuntime(),
    get = rt.get,
    window = rt.sandbox.window,
    out = { part };
  if (part === "road") {
    // The baseline test's road: battery causal-origin, lean, eight years.
    window.ALIFE_DEBUG.createTestWorld({
      seed: "causal-origin",
      size: "battery",
      complexity: "lean",
    });
    const year = get("TICKS_PER_YEAR"),
      tick = get("simTick"),
      hash = get("worldHash");
    out.hashes = [];
    for (let y = 1; y <= 8; y++) {
      for (let i = 0; i < year; i++) tick();
      out.hashes.push(hash());
    }
    out.audit = get("auditMatter().delta");
    out.people = get("biospherePopulation(KINDS.PERSON)");
    return out;
  }
  const fixture = path.join(__dirname, "..", "tests", "fixtures", `launch-${part}.json.gz`);
  rt.sandbox.localStorage.setItem(
    "causalis.save.oracle",
    zlib.gunzipSync(fs.readFileSync(fixture)).toString("utf8"),
  );
  if (!(await window.ALIFE_SAVE_DEBUG.load("oracle")))
    throw new Error(`the ${part} fixture did not load`);
  const tick = get("simTick"),
    hash = get("worldHash");
  out.loadHash = hash();
  out.hashes = [];
  const started = performance.now();
  for (let i = 1; i <= 512; i++) {
    tick();
    if (i % 64 === 0) out.hashes.push(hash());
  }
  out.msPerTick = +((performance.now() - started) / 512).toFixed(2);
  out.audit = get("auditMatter().delta");
  out.people = get("biospherePopulation(KINDS.PERSON)");
  out.tick = get("W.tick");

  // What the chronicle says: every retained event's sentence, grouped by type,
  // and the category each type was filed under.
  const events = get("W.events"),
    sentence = get("eventSentence"),
    byType = {};
  for (const e of events) (byType[e.type] ||= []).push(`${e.id}|${e.category}|${sentence(e)}`);
  out.events = { count: events.length };
  out.sentences = Object.fromEntries(
    Object.keys(byType)
      .sort()
      .map((type) => [type, digest(byType[type].join("\n"))]),
  );
  // One sentence for every type the game names, on borrowed data, so a type
  // this world never emitted is still read.
  const categories = get("EVENT_CATEGORY"),
    sample = events[events.length - 1];
  out.synthetic = {};
  for (const type of Object.keys(categories).sort()) {
    const data = { ...(events.find((x) => x.type === type)?.data || {}) };
    let text;
    try {
      text = sentence({ ...sample, type, data });
    } catch (error) {
      text = "THROW " + error.message;
    }
    out.synthetic[type] = digest(`${categories[type]}|${text}`);
  }

  // What the pages say. Last, because some page builders still write W.
  const pages = {},
    page = (name, fn) => {
      try {
        pages[name] = digest(fn());
      } catch (error) {
        pages[name] = "THROW " + error.message;
      }
    };
  const settlements = get("W.settlements"),
    factions = get("W.factions"),
    people = get("W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON).slice(0, 12)");
  page("legend-index", () => get("renderLegendIndex")(""));
  for (const s of settlements) page(`place-${s.id}`, () => get("renderPlacePage")(s.id));
  for (const f of factions) page(`faction-${f.id}`, () => get("renderFactionPage")(f.id));
  for (const id of people) page(`person-${id}`, () => get("organismInspector")(id));
  for (const s of settlements.slice(0, 4))
    page(`tile-${s.id}`, () => get("tileInspector")(get("idx")(s.x, s.y)));
  const panes = {
    chronicle: "refreshChronicle",
    worldinfo: "refreshWorldInfo",
    stats: "refreshStats",
  };
  for (const [name, fn] of Object.entries(panes))
    page(`pane-${name}`, () => {
      get(fn)();
      const pane = get(
        `DOM.${name === "chronicle" ? "chroniclePane" : name === "worldinfo" ? "worldPane" : "statsBody"}`,
      );
      return pane ? pane.innerHTML : "";
    });
  out.pages = pages;
  return out;
}

function diff(golden, now, at = "", lines = []) {
  if (golden === now) return lines;
  if (golden && now && typeof golden === "object" && typeof now === "object") {
    for (const key of new Set([...Object.keys(golden), ...Object.keys(now)]))
      if (key !== "msPerTick") diff(golden[key], now[key], at ? `${at}.${key}` : key, lines);
    return lines;
  }
  lines.push(`${at}: ${JSON.stringify(golden)} -> ${JSON.stringify(now)}`);
  return lines;
}

async function main() {
  const part = option("--part");
  if (part) {
    const result = await runPart(part);
    process.stdout.write(JSON.stringify(result));
    return;
  }
  const started = Date.now();
  const results = await Promise.all(
    PARTS.map(
      (name) =>
        new Promise((resolve, reject) => {
          const child = spawn(process.execPath, [__filename, "--part", name], { env: process.env });
          let text = "",
            error = "";
          child.stdout.on("data", (d) => (text += d));
          child.stderr.on("data", (d) => (error += d));
          child.on("close", (code) =>
            code ? reject(new Error(`part ${name} failed:\n${error}`)) : resolve(JSON.parse(text)),
          );
        }),
    ),
  );
  const record = Object.fromEntries(results.map((r) => [r.part, r]));
  const summary = results.map(
    (r) =>
      `${r.part} ${r.hashes[r.hashes.length - 1]}${r.msPerTick ? ` ${r.msPerTick} ms/tick` : ""}`,
  );
  console.log(`oracle: ${summary.join(" · ")} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  if (option("--out")) fs.writeFileSync(option("--out"), JSON.stringify(record, null, 1));
  if (option("--compare")) {
    const golden = JSON.parse(fs.readFileSync(option("--compare"), "utf8")),
      lines = diff(golden, record);
    if (!lines.length) console.log("identical to the golden record");
    else {
      console.log(
        `${lines.length} difference${lines.length === 1 ? "" : "s"} from the golden record:`,
      );
      for (const line of lines.slice(0, 80)) console.log("  " + line);
      process.exitCode = 1;
    }
  }
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
