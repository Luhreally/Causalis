// War past the line, W1: the scene of a town at war before the magazine, pinned to what it was before
// order came from fire. Spears, swords, bows, muskets and rifles, at every doing, draw bit for bit as they did.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { VillagePlan, WarsMap } from "../../src/bridge/index.ts";
import { townWarScene, type TownDoing, type TownHost, type TownWar } from "../../src/view/index.ts";
import { OCC } from "../../src/rules/index.ts";

type Side = WarsMap["wars"][number]["attacker"];
const town: VillagePlan = {
  ref: "town:0:5",
  name: "Fieldham",
  population: 90,
  market: false,
  hand: false,
  districts: null,
  biome: 8,
  seed: 4,
  homes: Array.from({ length: 12 }, (_, k) => {
    const a = k * 2.399963,
      r = 16 + 8.5 * Math.sqrt(k);
    return { x: r * Math.cos(a), z: r * Math.sin(a), yaw: a, household: null };
  }),
  fields: [{ x: 160, z: 20, w: 40, d: 25, yaw: 0 }],
  pasture: { x: -300, z: 0, r: 90 },
  wild: 400,
  water: null,
  house: { walls: "wattle", roof: "thatch", form: "round", pitch: 45, design: null },
  body: null,
  road: { x: 0, z: 1100 },
  people: [
    { ref: "prsn:0:1", name: "A B", home: 0, age: 30, occupation: OCC.farmer, child: false },
  ],
};
const side = (name: string, arm: string | null, color: [number, number, number]): Side => ({
  ref: `pol:0:${name}`,
  name,
  color,
  fields: 3000,
  arms: null,
  host: arm === null ? null : { arm, guard: "leather", mount: "foot" },
});
const host = (s: 0 | 1, doing: TownDoing, k = 0.5, more: Partial<TownHost> = {}): TownHost => ({
  side: s,
  doing,
  k,
  gathered: 1,
  words: doing,
  ...more,
});
const base = (a: string | null, d: string | null): Omit<TownWar, "hosts"> => ({
  ref: "war:0:7",
  sides: [side("the Reds", a, [0.8, 0.2, 0.2]), side("the Blues", d, [0.2, 0.3, 0.8])],
  fight: null,
  fought: null,
  placed: null,
  eve: false,
  siege: false,
  burning: 0,
  words: "",
});
const fought = (walls: boolean, won = true): NonNullable<TownWar["fought"]> => ({
  event: "evt:0:9",
  won,
  fallen: 700,
  outcome: walls ? "stormed" : "taken",
  walls,
  buried: false,
});
const fight = (stage: "drawn" | "engaged" | "rout", k: number): NonNullable<TownWar["fight"]> => ({
  stage,
  k,
  key: "war:0:7:301",
});
/** Every doing a host has at a town, as its land plays them. */
const CASES: readonly (readonly [string, Partial<TownWar> & { hosts: readonly TownHost[] }])[] = [
  ["mustering", { hosts: [host(0, "mustering")] }],
  ["leaving", { hosts: [host(0, "leaving", 0.4)] }],
  ["leaving the field", { hosts: [host(0, "leaving", 0.4, { field: true })] }],
  ["coming", { hosts: [host(0, "coming", 0.6), host(1, "coming", 0.6)] }],
  [
    "drawn",
    {
      fight: fight("drawn", 0.2),
      eve: true,
      hosts: [host(0, "drawn", 1), host(1, "drawn", 1, { out: true })],
    },
  ],
  ...[0.1, 0.5, 0.95].map(
    (k) =>
      [
        `engaged ${k}`,
        { fight: fight("engaged", k), hosts: [host(0, "engaged", 1), host(1, "engaged", 1)] },
      ] as const,
  ),
  ["guard", { hosts: [host(1, "guard", 1)] }],
  ["holding", { hosts: [host(0, "holding", 1)] }],
  [
    "holding the field won",
    {
      fight: fight("rout", 0.5),
      fought: fought(false),
      hosts: [host(0, "holding", 1), host(1, "fleeing", 0.5)],
    },
  ],
  [
    "entering",
    {
      fought: fought(false),
      burning: 0.35,
      hosts: [host(0, "entering", 0.5)],
    },
  ],
  ["besieging", { siege: true, hosts: [host(0, "besieging", 0.5), host(1, "besieged", 1)] }],
  ...[0.1, 0.5, 0.95].map(
    (k) =>
      [
        `assaulting ${k}`,
        {
          siege: true,
          fight: fight("engaged", k),
          hosts: [host(0, "assaulting", 1), host(1, "besieged", 1)],
        },
      ] as const,
  ),
  [
    "stormed",
    {
      fought: fought(true),
      burning: 1,
      siege: true,
      hosts: [host(0, "entering", 0.5), host(1, "fleeing", 0.5, { inward: true })],
    },
  ],
  ["home", { hosts: [host(0, "home", 0.6)] }],
  [
    "fought in place",
    {
      placed: { event: "evt:0:9", turn: 301, stage: "battle", s: 40, borne: 0 },
      fought: fought(false),
      hosts: [host(0, "engaged", 1), host(1, "engaged", 1)],
    },
  ],
];
/** The hash of all a scene draws, to six places. */
const digest = (value: unknown): string => {
  const text = JSON.stringify(value, (_k, v: unknown) =>
    typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v,
  );
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16).padStart(8, "0");
};
const sceneDigest = (a: string | null, d: string | null, each: number): string =>
  digest(
    CASES.map(([, c]) => {
      const s = townWarScene(
          town,
          { ...base(a, d), ...c } as TownWar,
          each,
          c.placed !== undefined,
        ),
        { soldiers, tents, fires, camp, middles } = s;
      return { soldiers, tents, fires, camp, middles };
    }),
  );

/** The scene's digest as it stood before order came from fire (base d346193). */
const PINNED: readonly (readonly [string | null, string | null, number, string])[] = [
  ["spear", "spear", 10, "071faf5a"],
  ["spear", "spear", 28, "212758ab"],
  ["sword", "sword", 10, "071faf5a"],
  ["sword", "sword", 28, "212758ab"],
  ["musket", "musket", 18, "ba2c059b"],
  ["rifle", "rifle", 18, "ba2c059b"],
  ["rifle", "rifle", 44, "0fda1350"],
  ["sword", "rifle", 18, "ba2c059b"],
  ["bow", "axe", 18, "ba2c059b"],
  [null, "spear", 18, "ba2c059b"],
];

for (const [a, d, each, pin] of PINNED)
  test(`before the magazine the scene is as it was: ${a} against ${d}, ${each} a side`, () => {
    assert.equal(sceneDigest(a, d, each), pin);
  });
