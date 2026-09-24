// The clock in slices (16, 38, 166): on the grown phone fixture, a world whose
// ticks run a step at a time, drawn and read between the steps (the map in
// two views, every panel, a person's inspector), ends each tick the same to
// the bit as a world ticked whole; a tick takes many slices; a tool laid
// part-way finishes the tick first; and the page's clock with a small budget
// runs the ticks it owes over several frames.
const fs = require("node:fs");
const zlib = require("node:zlib");
const path = require("node:path");
const { loadRuntime } = require("../scripts/runtime-probe.cjs");
const { report } = require("./lib/report.cjs");

const failures = [];
(async () => {
  const archive = zlib
    .gunzipSync(fs.readFileSync(path.join(__dirname, "fixtures", "launch-phone.json.gz")))
    .toString("utf8");
  const load = async () => {
    const rt = loadRuntime();
    rt.sandbox.localStorage.setItem("causalis.save.sliced", archive);
    if (!(await rt.sandbox.window.ALIFE_SAVE_DEBUG.load("sliced")))
      throw new Error("fixture did not load");
    return rt;
  };
  const whole = await load(),
    sliced = await load(),
    clock = sliced.sandbox.window.ALIFE_SLICED_CLOCK_DEBUG,
    visual = sliced.sandbox.window.ALIFE_VISUAL_DEBUG,
    wholeTick = whole.get("simTick"),
    refresh = sliced.get("refreshUI"),
    person = sliced.get(
      "W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id)) || 0",
    );
  // Ticks enough to cross a 128-tick pass (factions, war, inquiry) and the
  // 32- and 8-tick passes on the way.
  const start = whole.get("W.tick"),
    ticks = 128 - (start % 128) + 8;
  let slices = 0,
    most = 0,
    mismatch = null;
  for (let t = 0; t < ticks && !mismatch; t++) {
    wholeTick();
    let steps = 0;
    while (!clock.advance(-1)) {
      steps++;
      if (steps % 9 === 0)
        visual.renderOnly({
          view: steps % 18 ? "iso" : "top",
          quality: "high",
          zoom: 3,
          now: 6000 + t,
        });
      if (steps % 11 === 0) refresh(true);
      if (steps % 13 === 0 && person) sliced.get(`organismInspector(${person})`);
    }
    slices += steps + 1;
    most = Math.max(most, steps + 1);
    if (t % 8 === 7 || t === ticks - 1) {
      const a = whole.get("worldHash()"),
        b = sliced.get("worldHash()");
      if (a !== b) mismatch = { tick: whole.get("W.tick"), whole: a, sliced: b };
    }
  }
  if (mismatch)
    failures.push(
      `a world ticked in slices parted from one ticked whole: ${JSON.stringify(mismatch)}`,
    );
  if (!(most > 8)) failures.push(`a tick took at most ${most} slices; the life pass is not sliced`);
  // A tool laid part-way through a tick finishes the tick first.
  sliced.get("simTick");
  clock.advance(-1);
  const partWay = clock.inProgress();
  sliced.get(
    `(() => { UI.tool = "inspect"; applyTool(idx(W.width >> 1, W.height >> 1)); return 1; })()`,
  );
  if (!partWay) failures.push("one slice ended a whole tick");
  if (clock.inProgress())
    failures.push("a tool laid part-way through a tick left the tick unfinished");
  // The page's clock with a small budget owes eight ticks and pays them over frames.
  const before = sliced.get("W.tick");
  sliced.get(
    `(() => { UI.running = true; UI.clockInterrupted = false; UI.speed = 1; accumulator = 0; return 1; })()`,
  );
  let frames = 0;
  const run = sliced.get("runSimulationClock");
  sliced.get("(() => { accumulator = 800; return 1; })()");
  while (sliced.get("W.tick") - before < 8 && frames < 2000) {
    run(0, 1);
    frames++;
  }
  sliced.get("(() => { UI.running = false; return 1; })()");
  run(0, 1);
  const paid = sliced.get("W.tick") - before;
  if (paid !== 8) failures.push(`the clock paid ${paid} of the eight ticks it owed`);
  if (!(frames > 8))
    failures.push(`eight ticks took only ${frames} frames at a one-millisecond budget`);
  if (clock.inProgress()) failures.push("a stopped clock left a tick part-way");
  report(
    { ticks, slices, mostSlicesInATick: most, framesForEightTicks: frames, mismatch },
    failures,
  );
})().catch((error) => {
  report({ error: String(error?.stack || error) }, [String(error?.message || error)]);
});
