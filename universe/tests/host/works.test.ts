import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { MOULDS, floorOf, foundryOf, leanOn } from "../../src/view/errands.ts";
import {
  BENCH_MOST,
  floorNow,
  foundryNow,
  legsTold,
  townDay,
  villageSolids,
} from "../../src/view/index.ts";
import type { Line, PageModel, VillagePlan } from "../../src/bridge/index.ts";

// Phase 51 M215: things seen made at scale. The first light's world in the age of engines (800):
// its towns with works keep a foundry, its founders breaking out the last day's castings, ramming
// the sand and pouring the moulds at their taps; and in the modern age (1050) the works' floor, its
// machinists at the presses and lathes, the finished parts set on the bench.
const world = EARTH.build(seedFromText("first light"));
world.runTo(800 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;
const DAY = 86_400,
  HOUR = 3_600;
const words = (l: Line) => l.map((s) => (typeof s === "string" ? s : s.text)).join("");
const plansNow = (): VillagePlan[] =>
  ask<{ ref: string }[]>("towns.map")
    .slice(0, 40)
    .map((t) => ask<VillagePlan>("village.plan", { ref: t.ref, folk: 220 }));
// A made thing's page: its title, and its facts by label.
const pageOf = (ref: string) => {
  const page = ask<PageModel>("page", { ref }),
    blocks = page.tabs.flatMap((t) => t.blocks),
    facts = blocks.find((b) => b.type === "facts"),
    fact = (label: string) => {
      const row = facts?.type === "facts" ? facts.rows.find((r) => r.label === label) : undefined;
      return row ? words(typeof row.value === "string" ? [row.value] : row.value) : "";
    };
  return { page, blocks, fact };
};

test("a town's founders break out the last day's castings, pour each mould at its tap, and stack what they broke out", () => {
  // (Towns whose stores are lean that week work at no craft: the foundry towns that are fed.)
  const towns = plansNow().filter((p) => !!foundryOf(p) && !leanOn(p, 800 * 365 + 120));
  assert.ok(towns.length > 0, "a fed town with a foundry by its works at 800");
  let days = 0,
    pages = 0;
  for (const plan of towns.slice(0, 2)) {
    const ground = villageSolids(plan);
    for (let d = 0; d < 6; d++) {
      const day = 800 * 365 + 120 + d,
        founders = townDay(plan, day, ground).roles.flatMap((r, i) =>
          r.kind === "foundry" ? [i] : [],
        );
      if (!founders.length) continue;
      days++;
      const dawn = foundryNow(plan, ground, day * DAY + 5 * HOUR)!,
        night = foundryNow(plan, ground, day * DAY + 23.9 * HOUR)!,
        eve = foundryNow(plan, ground, (day - 1) * DAY + 23.9 * HOUR)!;
      // At dawn the moulds hold what the last working day poured, cold; the stack is empty.
      assert.equal(dawn.blowing, false, `${plan.name} ${day}: cold at dawn`);
      assert.equal(dawn.stacked, 0, `${plan.name} ${day}: nothing stacked at dawn`);
      if (eve.moulds.some((m) => m.since !== null && m.day === day - 1))
        assert.deepEqual(
          dawn.moulds.map((m) => (m.since === null ? null : m.form)),
          eve.moulds.map((m) => (m.since === null ? null : m.form)),
          `${plan.name} ${day}: the moulds at dawn as the day before left them`,
        );
      // Every founder no rite called away pours both moulds of each of their taps; each pour and
      // break-out names its mould, and the casting there is what was poured.
      let broken = 0,
        poured = 0;
      for (const i of founders) {
        const legs = legsTold(plan, i, day),
          away = legs.some((l) => l.why === "Back to their day"),
          pours = legs.filter((l) => l.why?.startsWith("Pouring the iron into mould "));
        broken += legs.filter((l) =>
          l.why?.startsWith("Breaking the last casting out of mould "),
        ).length;
        poured += pours.length;
        if (!away)
          assert.ok(
            pours.length >= 2 && pours.length % 2 === 0,
            `${plan.name} ${day}: ${plan.people[i]!.name} pours`,
          );
        for (const l of pours) {
          const [, n, form] = /^Pouring the iron into mould (\d+), for (?:an? )?(.+)$/.exec(
              l.why!,
            )!,
            m = Number(n) - 1;
          assert.ok(m >= 0 && m < MOULDS, l.why!);
          assert.equal(
            night.moulds[m]!.form,
            form,
            `${plan.name} ${day}: mould ${n} holds its ${form}`,
          );
          assert.equal(night.moulds[m]!.day, day, `${plan.name} ${day}: mould ${n} poured today`);
        }
      }
      assert.ok(poured > 0, `${plan.name} ${day}: the foundry poured`);
      assert.equal(
        night.moulds.filter((m) => m.since !== null && m.day === day).length,
        poured,
        `${plan.name} ${day}: one casting a pour`,
      );
      // The stack holds as many castings as were broken out, and no more.
      assert.equal(night.stacked, broken, `${plan.name} ${day}: stacked as broken out`);
      // While the cupola blows: from its first charge to past its last pour; tapped at some minute.
      let blown = false,
        tapped = false;
      for (let s = 6 * HOUR; s < 18 * HOUR; s += 60) {
        const f = foundryNow(plan, ground, day * DAY + s)!;
        blown ||= f.blowing;
        tapped ||= f.tapping;
      }
      assert.ok(blown && tapped, `${plan.name} ${day}: the cupola blown and tapped`);
      // A casting's page: cast iron, by its founder, traced from the ground to the mould.
      const m = night.moulds.findIndex((x) => x.day === day && x.index >= 0);
      if (m >= 0 && pages < 2) {
        pages++;
        const mould = night.moulds[m]!,
          founder = plan.people[mould.index]!,
          { page, blocks, fact } = pageOf(
            `made:${plan.ref}:${day}:founder:${founder.trade?.seat ?? 0}:${m}:${mould.form}`,
          ),
          chain = blocks.find(
            (b) => b.type === "list" && b.title === "From the ground to the mould",
          );
        assert.equal(page.title, `A cast iron ${mould.form}`);
        assert.ok(fact("By").startsWith(`${founder.name}, a founder`), fact("By"));
        assert.ok(chain?.type === "list" && chain.items.length >= 2, "its chain");
        assert.match(
          chain.items.map((it) => words(it.line)).join(" | "),
          /Remelted in the cupola .* poured into a sand mould by/,
        );
      }
    }
  }
  assert.ok(days >= 4, `${days} foundry days`);
  assert.ok(pages > 0, "a casting's page");
});

test("in the modern age the works' machinists make parts at the presses and lathes and set them on the bench", () => {
  world.runTo(1050 * YEAR);
  const towns = plansNow().filter((p) => !!floorOf(p));
  assert.ok(towns.length > 0, "a town with works in the modern age at 1050");
  let days = 0,
    pages = 0;
  for (const plan of towns.slice(0, 2)) {
    const ground = villageSolids(plan);
    for (let d = 0; d < 4; d++) {
      const day = 1050 * 365 + 120 + d,
        hands = townDay(plan, day, ground).roles.flatMap((r, i) =>
          r.kind === "machine" ? [i] : [],
        );
      if (!hands.length) continue;
      days++;
      let made = 0;
      for (const i of hands) {
        const legs = legsTold(plan, i, day),
          away = legs.some((l) => l.why === "Back to their day"),
          making = legs.filter((l) =>
            /^Making (a|an) [a-z ]+ at the (lathe|press)$/.test(l.why ?? ""),
          ),
          set = legs.filter((l) => /^Setting the finished [a-z ]+ on the bench$/.test(l.why ?? ""));
        if (!away)
          assert.ok(
            making.length >= 2,
            `${plan.name} ${day}: ${plan.people[i]!.name} at their machine`,
          );
        made += set.length;
      }
      // Through the day some machine runs with its part in it, and the bench fills.
      let running = false;
      for (let s = 8 * HOUR; s < 17 * HOUR && !running; s += 300)
        running = floorNow(plan, ground, day * DAY + s)!.machines.some(
          (m) => m.running && !!m.part,
        );
      assert.ok(running, `${plan.name} ${day}: a machine at work`);
      const night = floorNow(plan, ground, day * DAY + 23 * HOUR)!,
        noon = floorNow(plan, ground, day * DAY + 12 * HOUR)!;
      assert.equal(
        night.benched.length,
        Math.min(made, BENCH_MOST),
        `${plan.name} ${day}: the bench`,
      );
      assert.ok(
        noon.benched.length <= night.benched.length,
        `${plan.name} ${day}: the bench fills`,
      );
      // A finished part's page: steel, by its machinist, traced from the ground to the bench.
      const part = night.benched[0];
      if (part && pages < 2) {
        pages++;
        const hand = plan.people[part.index]!,
          { page, blocks, fact } = pageOf(
            `made:${plan.ref}:${day}:machinist:${hand.trade?.seat ?? 0}:${part.n}:${part.form}`,
          ),
          chain = blocks.find(
            (b) => b.type === "list" && b.title === "From the ground to the bench",
          );
        assert.equal(page.title, `A steel ${part.form}`);
        assert.ok(fact("By").startsWith(`${hand.name}, a machinist`), fact("By"));
        assert.ok(chain?.type === "list", "its chain");
        assert.match(
          chain.items.map((it) => words(it.line)).join(" | "),
          /Blown to steel .* converter.*Turned and pressed at the machines/,
        );
      }
    }
  }
  assert.ok(days >= 2, `${days} days at the works`);
  assert.ok(pages > 0, "a part's page");
});
