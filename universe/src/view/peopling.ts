// The peopling (Phase 28): the first people's bands spreading from the cradle over the land
// before the chronicle opens, as the world is begun from — land after land in the order they
// came, each in the colour of the family of tongues it would speak at the opening — and the
// god's hand on it: the seas lowered for the bands to walk over, a kind age or a hard one, the
// people bidden to rise elsewhere. Pure: the plan's peopling and the clock in; colours, counts
// and words out.
import type { GenesisPlan } from "../bridge/index.ts";

export { cradleAct, peoplingAct, type PeoplingAct } from "../rules/index.ts";

export type Peopling = NonNullable<GenesisPlan["peopling"]>;

/** How far through its stage the bands have come to every land they ever would (the rest, a pause before the chronicle). */
export const ALL_REACHED = 0.85;

/** The farthest step from the cradle the bands' front has come to, `through` its stage (0 to 1). */
export function peoplingFront(p: Peopling, through: number): number {
  return (farthest(p) + 1) * Math.min(1, Math.max(0, through) / ALL_REACHED);
}

/** How far through the stage the front came to a step (the inverse of peoplingFront). */
export function peoplingThrough(p: Peopling, step: number): number {
  return (ALL_REACHED * step) / (farthest(p) + 1);
}

const FAR = new WeakMap<Peopling, number>();
function farthest(p: Peopling): number {
  let far = FAR.get(p);
  if (far === undefined) {
    far = 0;
    for (const l of p.lands) far = Math.max(far, l[1]);
    FAR.set(p, far);
  }
  return far;
}

/**
 * Each family of tongues' colour (0–255), the first reached first: bright, and none of the land's
 * own greens, yellows and browns, nor the sea's blue-green or the ice's white.
 */
export const FAMILY_COLORS: readonly (readonly [number, number, number])[] = [
  [236, 64, 56],
  [60, 110, 246],
  [178, 72, 228],
  [255, 120, 196],
  [255, 136, 32],
  [40, 214, 236],
  [124, 84, 255],
  [228, 40, 132],
  [255, 92, 92],
  [96, 170, 255],
  [208, 112, 255],
  [255, 168, 120],
];

export function familyColor(f: number): readonly [number, number, number] {
  return FAMILY_COLORS[f % FAMILY_COLORS.length]!;
}

/** Each province's step (-1: never reached) and family, by province index (cached per peopling). */
const LOOKUP = new WeakMap<Peopling, { step: Int16Array; family: Int16Array }>();
function lookup(p: Peopling, provinces: number): { step: Int16Array; family: Int16Array } {
  let l = LOOKUP.get(p);
  if (!l || l.step.length < provinces) {
    l = { step: new Int16Array(provinces).fill(-1), family: new Int16Array(provinces).fill(-1) };
    p.lands.forEach(([cell, step], i) => {
      if (cell >= provinces) return;
      l!.step[cell] = step;
      l!.family[cell] = p.family[i]!;
    });
    LOOKUP.set(p, l);
  }
  return l;
}

const PROVINCES = new WeakMap<Int32Array, number>();
function provinceCount(province: Int32Array): number {
  let n = PROVINCES.get(province);
  if (n === undefined) {
    n = 0;
    for (const v of province) n = Math.max(n, v + 1);
    PROVINCES.set(province, n);
  }
  return n;
}

/**
 * The globe's colours (RGBA per fine cell, over `base`) with the bands' lands as far as the
 * front: each land reached in its family's colour over its ground, the newest bright; the lands
 * they will come to greyed, waiting; the land they will never walk to (given the ground's
 * heights) greyer still; the sea as it was.
 */
export function peoplingColors(
  base: Uint8Array,
  province: Int32Array,
  p: Peopling,
  front: number,
  elevation?: Float32Array,
): Uint8Array {
  const out = Uint8Array.from(base),
    { step, family } = lookup(p, provinceCount(province)),
    FRESH = 1.2,
    // (A cell's ground greyed toward its own lightness, and darkened.)
    mute = (at: number, dark: number) => {
      const l = 0.3 * base[at]! + 0.59 * base[at + 1]! + 0.11 * base[at + 2]!;
      for (let j = 0; j < 3; j++) out[at + j] = ((base[at + j]! * 0.4 + l * 0.6) * dark) | 0;
    };
  for (let c = 0; c < province.length; c++) {
    const prov = province[c]!,
      s = step[prov] ?? -1,
      at = c * 4;
    if (s < 0) {
      if (elevation && elevation[c]! > 0) mute(at, 0.55);
      continue;
    }
    if (s > front) {
      mute(at, 0.72);
      continue;
    }
    const [r, g, b] = familyColor(family[prov]!),
      fresh = front - s < FRESH ? 0.5 * (1 - (front - s) / FRESH) : 0;
    let x = base[at]! * 0.28 + r * 0.72,
      y = base[at + 1]! * 0.28 + g * 0.72,
      z = base[at + 2]! * 0.28 + b * 0.72;
    x += (255 - x) * fresh;
    y += (255 - y) * fresh;
    z += (255 - z) * fresh;
    out[at] = x | 0;
    out[at + 1] = y | 0;
    out[at + 2] = z | 0;
  }
  return out;
}

/** What the front has come to: lands, people in them, tongues and families of tongues. */
export function peoplingReached(
  p: Peopling,
  front: number,
): { lands: number; people: number; tongues: number; families: number } {
  let lands = 0,
    people = 0;
  const seen = new Set<number>();
  p.lands.forEach(([, step], i) => {
    if (step > front) return;
    lands++;
    people += p.sizes[i]!;
    seen.add(p.family[i]!);
  });
  let tongues = 0;
  for (const s of p.tongues) if (s <= front) tongues++;
  return { lands, people, tongues, families: seen.size };
}

const n = (x: number) => Math.round(x).toLocaleString("en");
const plural = (k: number, one: string, many = `${one}s`) => `${n(k)} ${k === 1 ? one : many}`;

/** What the front has come to, in a line. */
export function peoplingCounts(p: Peopling, front: number): string {
  const r = peoplingReached(p, front);
  return `${n(r.lands)} of ${plural(p.livable, "land")} they could live in reached · ${plural(r.people, "person", "people")} in their bands · ${plural(r.tongues, "tongue")} of ${plural(r.families, "family", "families")}`;
}

/** The families whose first land the front came to after `from` and by `to` (in the order reached). */
export function familiesReached(p: Peopling, from: number, to: number): number[] {
  const out: number[] = [],
    steps = new Map<number, number>(p.lands.map(([cell, step]) => [cell, step]));
  p.families.forEach((f, i) => {
    const s = steps.get(f.root) ?? Infinity;
    if (s > from && s <= to) out.push(i);
  });
  return out;
}

/** A family of tongues come to, in words: when, and what came of it by the chronicle's opening. */
export function familyWords(p: Peopling, f: number, when: string): string {
  const fam = p.families[f]!,
    lands = plural(fam.lands, "land");
  if (fam.root === p.cradle)
    return `${when}: in the cradle the first people spoke the first ${fam.name} — by the chronicle's opening ${lands} would speak its tongues.`;
  return `${when}: bands went on so far from the rest that their speech grew apart — the first of the ${fam.name} tongues, ${fam.tongues === 1 ? "one tongue" : `${fam.tongues} tongues`} of ${lands} by the chronicle's opening.`;
}

/** The peopling done, in words. */
export function peoplingDoneWords(p: Peopling): string {
  const r = peoplingReached(p, Infinity),
    left = p.livable - r.lands;
  return `By the chronicle's opening the bands had come to every land they could walk to — ${n(r.lands)} of them, ${plural(r.people, "person", "people")} in all, speaking ${plural(r.tongues, "tongue")} of ${plural(r.families, "family", "families")}${left > 0 ? `; ${plural(left, "land")} over the sea left for boats to find` : ""}.`;
}

/** A land tapped: the tongues its people speak, when their bands came, how many live there. */
export function peoplingLandWords(
  p: Peopling,
  province: number,
  front: number,
  whenOf: (step: number) => string,
): string {
  const i = p.lands.findIndex(([cell]) => cell === province);
  if (i < 0) return "No band came to this land before the chronicle.";
  const [, step] = p.lands[i]!,
    fam = p.families[p.family[i]!]!;
  if (step > front) return `The bands have not come here yet: they will, ${whenOf(step)}.`;
  return province === p.cradle
    ? `The cradle: the first people rose here, speaking the first ${fam.name}; ${plural(p.sizes[i]!, "person", "people")} here at the chronicle's opening.`
    : `Here: ${fam.name} tongues, their bands come ${whenOf(step)}, ${step} ${step === 1 ? "step" : "steps"} from the cradle; ${plural(p.sizes[i]!, "person", "people")} here at the chronicle's opening.`;
}

/** The god's hand on the peopling, as its buttons say it: icon, words, and what it does. */
export const PEOPLING_ACT_WORDS = {
  seas: ["🌊", "Lower the seas", "The seas fall as the ice grows: the bands walk over the straits"],
  kind: ["☀️", "A kind age", "Mild years and plenty: more of them in every band"],
  hard: ["❄️", "A hard age", "Cold, dry years: fewer of them in every band"],
} as const;

/** What a remade peopling did, against the peopling before it, in words. */
export function peoplingRemakeWords(before: GenesisPlan, after: GenesisPlan): string {
  const a = before.peopling,
    b = after.peopling;
  if (!a || !b) return "";
  const was = peoplingReached(a, Infinity),
    now = peoplingReached(b, Infinity),
    out: string[] = [],
    acts = [before.acts.peopling, after.acts.peopling] as const;
  if (acts[0].cradle !== acts[1].cradle || a.cradle !== b.cradle) {
    out.push(
      after.people
        ? `The ${after.people.name} rose instead in ${after.people.cradle}: their bands came to ${n(now.lands)} lands (${n(was.lands)} before), and at the chronicle's opening spoke ${plural(now.tongues, "tongue")} of ${plural(now.families, "family", "families")} (${n(was.tongues)} of ${n(was.families)} before).`
        : "No people rose there.",
    );
  }
  if (acts[0].seasLow !== acts[1].seasLow) {
    const more = now.lands - was.lands;
    out.push(
      acts[1].seasLow
        ? more > 0
          ? `With the seas low the bands walked over to ${plural(more, "land")} they would not have reached — ${n(now.lands)} in all, ${plural(now.people, "person", "people")} at the chronicle's opening.`
          : "The seas fell, but no land lay near enough over them that the bands had not come to already."
        : `The seas as they were: the bands came to ${n(now.lands)} lands (${n(was.lands)} with the seas low).`,
    );
  }
  if (acts[0].age !== acts[1].age)
    out.push(
      `${acts[1].age === "kind" ? "In a kind age" : acts[1].age === "hard" ? "In a hard age" : "In an ordinary age"} the bands numbered ${plural(now.people, "person", "people")} by the chronicle's opening, where they would have been ${n(was.people)}.`,
    );
  return out.join(" ");
}
