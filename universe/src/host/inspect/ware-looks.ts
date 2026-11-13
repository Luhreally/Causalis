// What each named thing at a market looks like (asked 2026-11-12: "generaritv emergent visuals for like the stuff their selling"), as a
// small picture drawn from what it is and what its land has: a land's own sown grain as an ear on its stalk, in its world's own leaf colour
// and as heavy in the seed as the lineage is; the beast its meat, milk, wool or hides come from, as its species page draws it; a tool of the
// metal its smiths head them with this year; an arm of its realm's design, of its metal; a motor car of the land's own steel or bronze, a
// radio in a case of its wood; its clay's ware as it fires; its cloth in its fibre's colour. Each is a Portrait the interface already draws
// (ui/specimen.ts, ui/portrait.ts): nothing here is kept, nothing per tick, read once a moment for a page that shows it.
import { worldChemistry, type Species } from "../../gen/index.ts";
import { hashString, type World } from "../../kernel/index.ts";
import type { Portrait } from "../../bridge/index.ts";
import { G, METALS, PIGMENT_WORDS, findSubstance, metalOf, type Metal } from "../../rules/index.ts";
import { designsOf, homePlanet, loreOf, marketsOf, politiesOf } from "../../sim/index.ts";
import { realmArms } from "../arms.ts";
import { clothLife, lifeHere } from "../biochem.ts";
import { landCloth, landClay, landStone, landWood } from "../chain.ts";
import { elementPortrait, madeHowOf, matterPortrait, thingPortrait } from "../looks.ts";
import { toolForm } from "./wares.ts";

type Rgb = readonly [number, number, number];
/** A thing sold, as a page names it: its kind's key ("grass:12", "machine:cars", "arms:arm:rifle"), its page. */
type Named = { readonly key: string; readonly ref: string | null };

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const unit = (s: string, salt: number) => (hashString(s, salt) >>> 0) / 4294967296;

/** Earth's leaf, and straw ripe: the colours a grass is drawn in where life is green. */
const LEAF: Rgb = [0.3, 0.5, 0.2],
  STRAW: Rgb = [0.85, 0.71, 0.36],
  /** A wood's colour by its name: a keyed shade between pale ash and dark yew (none is kept per wood). */
  WOOD_PALE: Rgb = [0.66, 0.52, 0.34],
  WOOD_DARK: Rgb = [0.36, 0.22, 0.13],
  /** The dark resin a case is moulded of, once a land's works make solid-state sets. */
  RESIN: Rgb = [0.2, 0.17, 0.15],
  PALE_CASE: Rgb = [0.82, 0.8, 0.74],
  LEATHER: Rgb = [0.5, 0.33, 0.2],
  WOOL: Rgb = [0.86, 0.82, 0.72],
  COAL: Rgb = [0.11, 0.11, 0.12];

/** A land's leaf and ripe-seed colours: its world's own pigment (Phase 57), Earth's green and straw. */
function leafOf(world: World): { readonly leaf: Rgb; readonly ear: Rgb } {
  const c = cacheOf(world);
  if (c.leaf) return c.leaf;
  const l = lifeHere(world),
    pigment = l.earth ? undefined : findSubstance(PIGMENT_WORDS[l.pigment].subst)?.colour,
    leaf: Rgb = pigment ? mix(pigment, LEAF, 0.25) : LEAF;
  return (c.leaf = { leaf, ear: pigment ? mix(STRAW, leaf, 0.35) : STRAW });
}

/** A lineage by its page, once a world. */
function speciesOf(world: World, ref: string | null): Species | null {
  if (!ref) return null;
  const c = cacheOf(world);
  if (!c.species) {
    c.species = new Map();
    for (const s of homePlanet(world).generated.life.species) c.species.set(s.ref, s);
  }
  return c.species.get(ref) ?? null;
}

/** A metal's colour as its world makes it: Earth's bronze and steel, a far world's arsenical copper or carbide iron. */
function metalColour(world: World, metal: Metal): Rgb {
  const chem = worldChemistry(homePlanet(world).generated);
  return chem.solar ? METALS[metal].colour : metalOf(chem, metal).stuff.colour;
}

/** The metal a land's works build of, by what its smiths forge: steel, else iron, else bronze. */
function worksMetal(world: World, cell: number): Metal {
  const m = marketsOf(world).get(cell),
    rank = ["stone", "copper", "bronze", "iron", "steel"],
    // (The better of what heads its tools and what its smiths forge this year.)
    best = [m?.forgedIn(), m?.toolMetalIn()].reduce<string>(
      (a, b) => (b && rank.indexOf(b) > rank.indexOf(a) ? b : a),
      "stone",
    );
  return best === "steel" || best === "iron" ? best : "bronze";
}

/** A land's wood's colour, by its wood. */
function woodColour(world: World, cell: number): Rgb {
  return mix(WOOD_PALE, WOOD_DARK, unit(landWood(world, cell), 0x776f));
}

/** The shape each machine is drawn as (ui/specimen.ts names each). */
const MACHINE_FORM: Readonly<Record<string, string>> = {
  clocks: "clock",
  looms: "power loom",
  steam: "steam engine",
  rails: "locomotive",
  ships: "marine engine",
  currents: "water wheel",
  sun: "sun engine",
  heat: "marine engine",
  dynamos: "dynamo",
  "sea-dynamos": "dynamo",
  "ground-dynamos": "dynamo",
  cars: "motor car",
  wings: "aeroplane",
  telegraph: "telegraph key",
  telephone: "telephone",
  radio: "radio set",
  "sea-sound": "radio set",
  computers: "computer",
  phones: "phone",
  minds: "thinking machine",
  bodies: "made body",
};

/** A machine as its land's works make it: of the land's metal; a clock or a radio in a case of its wood, later of resin. */
function machineLook(world: World, cell: number, id: string): Portrait {
  const form = MACHINE_FORM[id] ?? "casting",
    metal = metalColour(world, worksMetal(world, cell)),
    solid = !!loreOf(world).get(cell, "solid-state"),
    cased = form === "clock" || form === "radio set" || form === "telegraph key",
    pale = form === "computer" || form === "thinking machine",
    color = cased
      ? solid && form === "radio set"
        ? RESIN
        : woodColour(world, cell)
      : pale
        ? PALE_CASE
        : metal;
  return thingPortrait({
    form,
    made: cased || pale ? "carved" : "machined",
    color,
    lustre: cased ? (solid ? "resinous" : "waxy") : pale ? "dull" : "metallic",
    // (The second stuff: a cased set's fittings of the metal, a metal machine's trim of the wood.)
    haft: cased || pale ? metal : woodColour(world, cell),
    quality: 70,
    worn: 0,
    key: hashString(`${cell}:${id}`, 0x6d63),
  });
}

/** The shape each part of a host's kit is drawn as, where the part's own name is no shape. */
const KIT_FORM: Readonly<Record<string, string>> = {
  mail: "coat",
  scale: "coat",
  plate: "coat",
  leather: "coat",
  armoured: "armoured car",
  "driven-plate": "coat",
  "machine-host": "made body",
};
/** A design's worked material, as a metal its colour is of. */
const KIT_METAL: Readonly<Record<string, Metal>> = {
  copper: "copper",
  bronze: "bronze",
  iron: "iron",
  steel: "steel",
  machined: "steel",
};

/** A part of a realm's host's kit, as it is made for it here: its arm, guard or mount, of its metal. */
function armsLook(world: World, cell: number, key: string): Portrait | null {
  const [, role, id] = key.split(":");
  const realm = politiesOf(world).of(cell),
    d = realm ? designsOf(world).of(realm.ref) : undefined,
    part = d?.parts.find((p) => p.role === role && p.id === id);
  if (!part || !id) return null;
  const metal = KIT_METAL[part.material],
    color: Rgb = metal ? metalColour(world, metal) : [0.6, 0.66, 0.74];
  return thingPortrait({
    form: KIT_FORM[id] ?? id,
    made: madeHowOf(metal ?? part.material, "arms", part.material),
    color,
    haft: role === "arm" ? woodColour(world, cell) : null,
    quality: 65,
    worn: 0,
    key: hashString(`${cell}:${key}`, 0x6172),
  });
}

/** The arm a realm's host carries, as its seat's smiths make it (null: a realm with no design of arms, or none for an arm). */
export function realmArmLook(world: World, realm: string): Portrait | null {
  const r = politiesOf(world).get(realm as never),
    arm = r ? designsOf(world).of(r.ref)?.parts.find((p) => p.role === "arm") : undefined;
  return r && arm ? armsLook(world, r.seat, `arms:arm:${arm.id}`) : null;
}

/** The symbol of each of the three metals a market sells, its tin as its world's hardener. */
const HARDENER: Readonly<Record<string, string>> = { tin: "Sn", arsenic: "As", nickel: "Ni" };

/** A plant as it is sold: an ear (its seed as heavy as the lineage's), a frond, a tuber, leaves. */
function plantLook(
  world: World,
  form: Extract<Portrait, { kind: "plant" }>["form"],
  seed: number,
  key: string,
): Portrait {
  const { leaf, ear } = leafOf(world);
  return {
    kind: "plant",
    form,
    seed: Math.max(0, Math.min(1, seed)),
    leaf,
    ear,
    key: hashString(key, 0x706c),
  };
}

/** A stuff as it is sold, where no thing is made of it: coal's lump, a fibre's hank, a hide laid flat. */
function stuff(
  form: "lump" | "fibre" | "sheet",
  color: Rgb,
  lustre: "vitreous" | "silky" | "dull",
  key: string,
): Portrait {
  return {
    kind: "matter",
    form,
    habit: null,
    color,
    lustre,
    clarity: 0,
    hardness: null,
    key: hashString(key, 0x7374),
  };
}

/** A beast as its species page draws it (none: a lineage with no body to draw). */
function beastLook(world: World, ref: string | null): Portrait | null {
  const s = speciesOf(world, ref);
  return s?.body ? { kind: "creature", body: s.body, name: s.name, wool: s.wool } : null;
}

/**
 * The picture of a thing sold under a good, as the land that made it makes it (null: nothing to draw: "and others", a good told only by
 * its name). Read once a moment, by its land and its kind.
 */
export function wareLook(world: World, cell: number, good: number, w: Named): Portrait | null {
  if (w.key === "others" || w.key.startsWith("from:")) return null;
  const c = cacheOf(world),
    at = `${cell}:${good}:${w.key}`;
  if (c.looks.has(at)) return c.looks.get(at)!;
  const look = lookOf(world, cell, good, w);
  c.looks.set(at, look);
  return look;
}

function lookOf(world: World, cell: number, good: number, w: Named): Portrait | null {
  const [kind, rest] = w.key.split(":") as [string, string | undefined];
  if (kind === "arms") return armsLook(world, cell, w.key);
  switch (kind) {
    case "grass":
      return plantLook(world, "ear", speciesOf(world, w.ref)?.seed ?? 0.4, w.key);
    case "gathered":
      return plantLook(world, "ear", 0.1, `${w.key}:${w.ref ?? ""}`);
    case "domes":
      return plantLook(world, "leaf", 0.5, w.key);
    case "beds":
      return plantLook(world, "frond", 0.5, w.key);
    case "gardens":
      return plantLook(world, "tuber", 0.5, w.key);
    case "vats": {
      const s = findSubstance("water"),
        p = s ? matterPortrait(s) : null;
      return p?.kind === "matter"
        ? { ...p, form: "liquid", color: mix(leafOf(world).leaf, [0.9, 0.9, 0.8], 0.4) }
        : null;
    }
    case "meat":
    case "milk":
    case "salted":
    case "fish":
    case "game":
      return beastLook(world, w.ref);
    // (A coat's fibre and a hide where no one beast is known: the fibre itself, a hide laid flat.)
    case "wool":
      return beastLook(world, w.ref) ?? stuff("fibre", WOOL, "silky", w.key);
    case "hide":
    case "skin":
      return beastLook(world, w.ref) ?? stuff("sheet", LEATHER, "dull", w.key);
    case "metal": {
      const chem = worldChemistry(homePlanet(world).generated);
      return elementPortrait(
        rest === "copper" ? "Cu" : rest === "iron" ? "Fe" : (HARDENER[chem.hardener] ?? "Sn"),
      );
    }
    case "coal":
      // (Coal is mostly carbon, black and a little glassy where it breaks: rules/matter.ts GOOD_MATTER.)
      return stuff("lump", COAL, "vitreous", `${cell}:coal`);
    case "oil": {
      const s = findSubstance("crude");
      return s ? matterPortrait(s) : null;
    }
    case "ware": {
      const clay = landClay(world, cell);
      return thingPortrait({
        form: "storage jar",
        made: "thrown",
        color: clay.fired,
        quality: 60,
        worn: 0,
        key: hashString(`${cell}:pot`, 0x706f),
      });
    }
    case "glass": {
      const s = findSubstance("glass"),
        p = s ? matterPortrait(s) : null;
      return p?.kind === "matter" ? { ...p, form: "glass" } : p;
    }
    case "cloth": {
      // (A garment of the land's own fibre, in its colour: "cloth:<fibre>:<garment>".)
      const cloth = landCloth(world, cell),
        form = w.key.split(":")[2] ?? "tunic";
      return thingPortrait({
        form,
        made: "woven",
        color: clothLife(world, cell, cloth).colour,
        // (A plaited sandal's straps, and a garment's buttons or clasp, are of its land's wood.)
        haft: woodColour(world, cell),
        quality: 60,
        worn: 0,
        key: hashString(`${cell}:cloth:${form}`, 0x636c),
      });
    }
    case "leather":
      return thingPortrait({
        form: rest ?? "coat",
        made: "sewn",
        color: LEATHER,
        haft: woodColour(world, cell),
        quality: 60,
        worn: 0,
        key: hashString(`${cell}:leather:${rest ?? ""}`, 0x6c65),
      });
    case "tools": {
      // ("tools:<metal>:<kind>": the one thing, of its metal, on a haft of its land's wood.)
      const [, metal = "stone", kind = "axe"] = w.key.split(":"),
        stone = metal === "stone" ? landStone(world, cell).stone : null;
      return thingPortrait({
        form: toolForm(kind),
        made: stone ? "knapped" : madeHowOf(metal, "tools"),
        color: stone ? stone.colour : metalColour(world, metal as Metal),
        haft: woodColour(world, cell),
        quality: 60,
        worn: 0,
        key: hashString(`${cell}:${w.key}`, 0x746f),
      });
    }
    case "machine":
      return machineLook(world, cell, rest ?? "");
    default:
      return good === G.machines ? machineLook(world, cell, "steam") : null;
  }
}

/** A company's mark: its realm's shield, and on it the thing it makes the most of. */
export function companyMark(world: World, cell: number, good: number, w: Named): Portrait | null {
  const realm = politiesOf(world).of(cell),
    arms = realm ? realmArms(world, realm.ref) : null;
  return arms ? { kind: "company", arms, good: wareLook(world, cell, good, w) } : null;
}

// —— Read once a moment ——————————————————————————————————————————————————————————————————————————

type Cache = {
  now: number;
  readonly looks: Map<string, Portrait | null>;
  species?: Map<string, Species>;
  leaf?: { readonly leaf: Rgb; readonly ear: Rgb };
};
const CACHES = new WeakMap<World, Cache>();
function cacheOf(world: World): Cache {
  let c = CACHES.get(world);
  if (!c || c.now !== world.now) {
    c = { now: world.now, looks: new Map() };
    CACHES.set(world, c);
  }
  return c;
}
