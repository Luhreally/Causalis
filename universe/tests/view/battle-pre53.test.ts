// The battles before the magazine stay as they were (Phase 53 M220): every arm a host bore before
// the repeating rifle — spears, bows, blades, beasts' arms, the musket and the rifle, riders and
// chariots, cannon — on open ground, a ridge, across a river and at a seat's walls, drawn up,
// fought and told exactly as before the later arms came. The digests were taken from the battle
// view before the arms table (view/arms.ts) and the later arms' open order, rushes and armour.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { BattleNear, BattleOutcome, BattleSideNear } from "../../src/bridge/index.ts";
import { BATTLE_LENGTH, battleAt, menAt, newBattle, trooperWords } from "../../src/view/index.ts";

const side = (
  name: string,
  fielded: number,
  fallen: number,
  host: [string, string, string] | null,
  extra: Partial<BattleSideNear> = {},
): BattleSideNear => ({
  ref: `realm:${name}`,
  name: `the realm of ${name}`,
  color: [0.8, 0.2, 0.2],
  arms: null,
  fielded,
  fallen,
  host: host && { arm: host[0], guard: host[1], mount: host[2] },
  kit: host ? `${host[0]}s` : "spears, on foot",
  ...extra,
});

function near(
  outcome: BattleOutcome,
  a: BattleSideNear,
  d: BattleSideNear,
  ground: { hills?: boolean; river?: boolean; walls?: 0 | 1 | 2 } = {},
): BattleNear {
  return {
    event: `ev:0:${outcome}${a.fielded}`,
    war: "war:1",
    title: "The battle at the test land",
    cell: 1,
    land: "The test land",
    year: 100,
    attacker: a,
    defender: { ...d, color: [0.2, 0.3, 0.85] },
    won: outcome !== "held",
    outcome,
    civil: null,
    hills: ground.hills ?? false,
    river: ground.river ?? false,
    walls: ground.walls ?? 0,
    town: ground.walls ? "Testholt" : null,
    figure: null,
    plan: {
      seed: "test battle",
      ages: [
        { index: 0, from: 0, to: 0, kind: "quiet", seaLevel: 0, warmth: 0, forests: true },
      ] as never,
      lineages: [],
    },
  };
}

/** Battles of every arm before the magazine, on every ground, at both detail levels. */
const CASES: readonly [string, BattleNear, number][] = [
  [
    "spears in the field",
    near(
      "field",
      side("Ash", 900, 120, ["spear", "shield", ""]),
      side("Elm", 700, 160, ["spear", "shield", ""]),
    ),
    360,
  ],
  [
    "bows on a ridge, held",
    near(
      "held",
      side("Ash", 2400, 400, ["bow", "shield", ""]),
      side("Elm", 1800, 200, ["sword", "mail", ""]),
      { hills: true },
    ),
    360,
  ],
  [
    "muskets and rifles across a river, with cannon",
    near(
      "taken",
      side("Ash", 5200, 700, ["musket", "mail", ""], { cannon: true }),
      side("Elm", 4100, 900, ["rifle", "plate", ""], { cannon: true }),
      { river: true },
    ),
    360,
  ],
  [
    "rifle cavalry storm stone walls",
    near(
      "stormed",
      side("Ash", 12000, 1500, ["rifle", "plate", "cavalry"], { cannon: true }),
      side("Elm", 6000, 2600, ["musket", "mail", "horse"], { cannon: true }),
      { walls: 2 },
    ),
    360,
  ],
  [
    "horse bows against chariots",
    near(
      "field",
      side("Ash", 3000, 300, ["horn-bow", "hide", "horse"]),
      side("Elm", 2500, 600, ["spear", "shield", "chariot"]),
    ),
    120,
  ],
  [
    "a siege laid at a palisade",
    near(
      "siege",
      side("Ash", 1500, 200, ["axe", "hide", ""]),
      side("Elm", 600, 90, ["bow", "shield", ""]),
      { walls: 1 },
    ),
    120,
  ],
  [
    "beasts held",
    near(
      "held",
      side("Ash", 300, 80, ["claws", "hide", ""]),
      side("Elm", 280, 40, ["mandibles", "shell", ""]),
    ),
    360,
  ],
  [
    "rifles held at the walls, the attackers part armed",
    near(
      "held",
      side("Ash", 30000, 4000, ["rifle", "plate", "cavalry"], { cannon: true, armed: 0.7 }),
      side("Elm", 20000, 3000, ["rifle", "plate", ""], { cannon: true }),
      { walls: 2 },
    ),
    120,
  ],
  [
    "a host with no design",
    near("field", side("Ash", 400, 50, null), side("Elm", 300, 80, ["club", "hide", ""])),
    360,
  ],
  [
    "shell darts in the open",
    near(
      "taken",
      side("Ash", 800, 90, ["shell-darts", "shell", ""]),
      side("Elm", 900, 300, ["grapple", "hide", ""]),
    ),
    360,
  ],
];

/** FNV-1a of a text, with its length. */
function digest(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return `${h.toString(16)}:${text.length}`;
}

/** A battle's field, its moments and what each one is told at, as one line. */
function battleDigest(n: BattleNear, most: number): string {
  const f = newBattle(n, most),
    field = digest(JSON.stringify({ ...f, near: null })),
    seconds = [0, 12, 20, 33, 41, 47, 52, 70, 101, 109, 115, 131, BATTLE_LENGTH],
    nows = digest(
      seconds
        .map((s) => {
          const now = battleAt(f, s);
          return JSON.stringify(now) + JSON.stringify(menAt(f, now));
        })
        .join("|"),
    ),
    words = digest(
      f.troopers
        .filter((t) => t.id % 7 === 0)
        .map((t) => seconds.map((s) => trooperWords(f, t.id, s)).join("/"))
        .join("|"),
    );
  return `${field} ${nows} ${words}`;
}

/** Each case's digests, from the battle view as it was before Phase 53. */
const BEFORE: Readonly<Record<string, string>> = {
  "spears in the field": "765f5571:185508 6e2ab5ae:1377885 621b846f:94495",
  "bows on a ridge, held": "9e1430e4:247236 74aa48aa:1772087 9a311ddb:104409",
  "muskets and rifles across a river, with cannon":
    "ccf136de:303100 8cd4dc23:1691225 4de72370:111223",
  "rifle cavalry storm stone walls": "afdb779c:275400 fe7fa136:1433077 946894c3:92766",
  "horse bows against chariots": "966b9bbe:113067 29601458:718202 3fa18a74:40370",
  "a siege laid at a palisade": "bff2b336:90582 77f333d:583609 2367083b:28236",
  "beasts held": "4481f047:203885 50803852:1518099 d0fc532e:80639",
  "rifles held at the walls, the attackers part armed":
    "82674b03:152489 63ae4b5d:571521 add8c09d:35334",
  "a host with no design": "23d1dca2:121965 e330fc15:908641 a90c890e:58307",
  "shell darts in the open": "948ff9ec:239122 65c63a3b:1637226 e2ed5d16:98096",
};

test("every battle before the magazine is drawn up, fought and told exactly as before", () => {
  for (const [name, n, most] of CASES) assert.equal(battleDigest(n, most), BEFORE[name], name);
});
