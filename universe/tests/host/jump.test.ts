// A far year chosen at the start (Phase 63): the world runs there a slice at a time, telling how far
// it has come, may be stopped where it stands, and is the same world however it got there.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { HostClient, inlinePair, type JumpProgress } from "../../src/bridge/index.ts";
import { MemoryByteStore, SimHost, UNIVERSES } from "../../src/host/index.ts";
import { PEOPLE_ACT_EVENTS, fortunesOf, makeToyWorld, politiesOf } from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { phoneMinutesTo } from "../../src/ui/jump.ts";

const turn = () => new Promise<void>((r) => setImmediate(r));

/** A host whose clock moves as it is read: each slice of a jump ends, as it does on a device. */
function moving(perRead = 5) {
  const [page, end] = inlinePair(),
    clock = { now: 0, reads: 0, frozenAt: -1 },
    /** The page freezes for an hour, the slice after this one in. */
    freeze = () => {
      clock.frozenAt = clock.reads + 2;
    },
    host = new SimHost(end, UNIVERSES, {
      clock: () => {
        if (++clock.reads === clock.frozenAt) clock.now += 3_600_000;
        return (clock.now += perRead);
      },
      storage: new MemoryByteStore(),
      budgetMs: 1e9,
      statusEveryMs: 50,
    }),
    client = new HostClient(page);
  const settle = async <T>(p: Promise<T>, each?: (pumps: number) => void): Promise<T> => {
    let done = false,
      value: T | undefined,
      error: unknown;
    p.then(
      (v) => {
        done = true;
        value = v;
      },
      (e) => {
        done = true;
        error = e;
      },
    );
    for (let i = 0; i < 100_000 && !done; i++) {
      await turn();
      await host.pump();
      each?.(i);
      await turn();
    }
    if (!done) throw new Error("the host never answered");
    if (error) throw error;
    return value as T;
  };
  return { client, host, settle, freeze };
}

test("a jump tells how far it has come, and arrives at the same world as running there at once", async () => {
  const r = moving();
  await r.settle(r.client.start("sandbox", "alpha"));
  const told: JumpProgress[] = [];
  const end = await r.settle(r.client.jump(6 * YEAR, (p) => told.push(p)));
  assert.deepEqual(end, { t: 6 * YEAR, stopped: false });
  assert.ok(told.length >= 3, `told ${told.length} times`);
  // Onward only, bound for the year asked, the work so far growing.
  for (let k = 1; k < told.length; k++) {
    assert.ok(told[k]!.t >= told[k - 1]!.t);
    assert.ok(told[k]!.ms > told[k - 1]!.ms);
    assert.equal(told[k]!.to, 6 * YEAR);
  }
  const direct = makeToyWorld("alpha");
  direct.runTo(6 * YEAR);
  assert.deepEqual(await r.settle(r.client.query({ type: "hashes" })), direct.domainHashes());
});

test("a jump stopped stands where it was, whole, and takes up from there as if never stopped", async () => {
  const r = moving();
  await r.settle(r.client.start("sandbox", "beta"));
  let stoppedAt = 0;
  const end = await r.settle(
    r.client.jump(40 * YEAR, (p) => {
      // Once it has come a little way.
      if (!stoppedAt && p.t >= YEAR) {
        stoppedAt = p.t;
        r.client.stopJump();
      }
    }),
  );
  assert.equal(end.stopped, true);
  assert.ok(end.t > 0 && end.t < 40 * YEAR, `it stopped at ${end.t / YEAR}`);
  // The world answers, at the end of a whole moment.
  const now = await r.settle(r.client.query<{ t: number }>({ type: "now" }));
  assert.equal(now.t, end.t);
  const hashes = await r.settle(r.client.query({ type: "hashes" })),
    direct = makeToyWorld("beta");
  direct.runTo(end.t);
  assert.deepEqual(hashes, direct.domainHashes());
  // And another jump takes up from there, to the same world as one that never stopped.
  const again = await r.settle(r.client.jump(6 * YEAR));
  assert.deepEqual(again, { t: 6 * YEAR, stopped: false });
  direct.runTo(6 * YEAR);
  assert.deepEqual(await r.settle(r.client.query({ type: "hashes" })), direct.domainHashes());
});

test("a jump to where the world already is answers at once; a second at once is refused", async () => {
  const r = moving();
  await r.settle(r.client.start("sandbox", "alpha"));
  await r.settle(r.client.advance(2 * YEAR));
  assert.deepEqual(await r.settle(r.client.jump(YEAR)), { t: 2 * YEAR, stopped: false });
  const first = r.client.jump(20 * YEAR),
    second = r.client.jump(30 * YEAR);
  await assert.rejects(r.settle(second), /on its way/);
  r.client.stopJump();
  assert.equal((await r.settle(first)).stopped, true);
});

test("a new world ends a jump under way, and the jump is answered", async () => {
  const r = moving();
  await r.settle(r.client.start("sandbox", "alpha"));
  const jump = r.client.jump(40 * YEAR);
  await r.settle(r.client.query({ type: "now" }));
  const started = r.client.start("sandbox", "beta");
  assert.equal((await r.settle(jump)).stopped, true);
  await r.settle(started);
  const direct = makeToyWorld("beta");
  assert.deepEqual(await r.settle(r.client.query({ type: "hashes" })), direct.domainHashes());
});

test("a page frozen in the middle of a jump (a phone locked) does not count as the jump's work", async () => {
  const r = moving(),
    told: JumpProgress[] = [];
  await r.settle(r.client.start("sandbox", "alpha"));
  await r.settle(
    r.client.jump(6 * YEAR, (p) => {
      if (told.push(p) === 2) r.freeze();
    }),
  );
  assert.ok(told.length >= 4, `told ${told.length} times`);
  assert.ok(told.at(-1)!.ms < 60_000, `an hour frozen came to ${told.at(-1)!.ms} ms of work`);
});

test("a jump goes a slice at a time, the host turning between", async () => {
  const r = moving(20);
  await r.settle(r.client.start("sandbox", "alpha"));
  let pumps = 0;
  await r.settle(r.client.jump(3 * YEAR), () => pumps++);
  assert.ok(pumps > 2, `the jump took ${pumps} turns of the host`);
});

test("the title's estimate grows with the year, some minutes for a far one", () => {
  assert.ok(phoneMinutesTo(100) < 1);
  assert.ok(phoneMinutesTo(1500) > phoneMinutesTo(1000));
  assert.ok(phoneMinutesTo(3000) > 2 * phoneMinutesTo(1500) * 0.9);
  assert.ok(phoneMinutesTo(3000) < 60);
});

// 2026-11-14: a spell laid for years is the world's own from then on, so a jump over it is the same world as the years
// run one by one: it lifts in its year, neither early nor never.
test("a jump over a blessing laid for years ends it in its year, the same world as running there", async () => {
  const AT = 40,
    SPELL = 30,
    TO = 110,
    direct = EARTH.build(seedFromText("first light"));
  direct.runTo(AT * YEAR);
  const realm = [...politiesOf(direct).living()].sort(
      (a, b) => b.members.length - a.members.length || (a.ref < b.ref ? -1 : 1),
    )[0]!.ref,
    args = { realm, strength: 1.5, years: SPELL };
  direct.submit("act.bless", args);
  direct.runTo(TO * YEAR);
  const ends = direct.events.all().filter((e) => e.type === PEOPLE_ACT_EVENTS.fortuneEnd.type);
  assert.equal(ends.length, 1);
  assert.equal(fortunesOf(direct)!.all().length, 0);
  // (At the turn that closes its thirtieth year, to the day; or with its realm if that fell first.)
  const lifted = ends[0]!.t / YEAR,
    fallen = politiesOf(direct).get(realm)!.ended;
  assert.ok(
    fallen !== null && fallen < AT + SPELL
      ? lifted <= fallen + 1
      : Math.abs(lifted - (AT + SPELL)) < 1 / 365,
    `lifted at ${lifted}`,
  );
  const hosted = async (how: "jump" | "advance") => {
    const r = moving();
    await r.settle(r.client.start("earth", "first light"));
    await r.settle(r.client.advance(AT * YEAR));
    await r.settle(r.client.command("act.bless", args));
    await r.settle(how === "jump" ? r.client.jump(TO * YEAR) : r.client.advance(TO * YEAR));
    return r.settle(r.client.query({ type: "hashes" }));
  };
  const jumped = await hosted("jump");
  assert.deepEqual(jumped, await hosted("advance"));
  assert.deepEqual(jumped, direct.domainHashes());
});
