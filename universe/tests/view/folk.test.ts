import { test } from "node:test";
import assert from "node:assert/strict";
import type { FolkFacts } from "../../src/bridge/index.ts";
import {
  HAIRS,
  clothes,
  figureOf,
  figurePaint,
  folkLook,
  type FigureBody,
} from "../../src/view/index.ts";

// Phase 34 M176–M177: a people's own look, made of their world.

const facts = (over: Partial<FolkFacts> = {}): FolkFacts => ({
  key: 1234567,
  gravity: 1,
  star: 5600,
  warmth: 14,
  rain: 900,
  biome: 9,
  forebears: null,
  ...over,
});
const body = (clade: string, over: Partial<FigureBody> = {}): FigureBody => {
  const plans: Record<string, Omit<FigureBody, "size">> = {
    ape: {
      clade: "ape",
      medium: "land",
      symmetry: "bilateral",
      manipulators: "hands",
      limbs: 2,
      skin: "skin",
    },
    shaggy: {
      clade: "shaggy",
      medium: "land",
      symmetry: "bilateral",
      manipulators: "hands",
      limbs: 4,
      skin: "fur",
    },
    crawler: {
      clade: "crawler",
      medium: "land",
      symmetry: "bilateral",
      manipulators: "claws",
      limbs: 2,
      skin: "scales",
    },
    swimmer: {
      clade: "swimmer",
      medium: "water",
      symmetry: "radial",
      manipulators: "tentacles",
      limbs: 8,
      skin: "skin",
    },
    strider: {
      clade: "strider",
      medium: "land",
      symmetry: "bilateral",
      manipulators: "hands",
      limbs: 2,
      skin: "feathers",
    },
    trunk: {
      clade: "trunk",
      medium: "land",
      symmetry: "bilateral",
      manipulators: "trunk",
      limbs: 1,
      skin: "skin",
    },
    shore: {
      clade: "shore",
      medium: "shore",
      symmetry: "bilateral",
      manipulators: "claws",
      limbs: 2,
      skin: "shell",
    },
    burrower: {
      clade: "burrower",
      medium: "land",
      symmetry: "bilateral",
      manipulators: "mandibles",
      limbs: 2,
      skin: "shell",
    },
  };
  return { ...plans[clade]!, size: 60, ...over };
};
const light = (c: readonly number[]) => 0.3 * c[0]! + 0.59 * c[1]! + 0.11 * c[2]!;
const hex = (c: readonly number[]) => c.map((x) => Math.round(x * 255)).join(",");

test("Earth's people are its upright apes, as ever: no look of their own, the same figure", () => {
  assert.equal(folkLook(body("ape")), null);
  assert.equal(folkLook(null), null);
  assert.deepEqual(figureOf(body("ape"), 2), figureOf(null, 2));
  const paint = figurePaint(body("ape"), "farm", 1);
  assert.equal(paint.folk, false);
  assert.deepEqual(paint.tones[0], clothes("farm", 1).body);
  assert.equal(paint.hairs, HAIRS);
});

test("a people's look is made of their world: the same facts, the same people; another world, another people", () => {
  const a = body("shaggy", { folk: facts() }),
    b = body("shaggy", { folk: facts({ key: 98765 }) });
  assert.deepEqual(folkLook(a), folkLook(body("shaggy", { folk: facts() })));
  assert.deepEqual(figureOf(a, 2), figureOf(body("shaggy", { folk: facts() }), 2));
  assert.notEqual(hex(folkLook(a)!.hide), hex(folkLook(b)!.hide));
  // Forty worlds of furred climbers: nearly every one its own hide.
  const hides = new Set(
    Array.from({ length: 40 }, (_, k) =>
      hex(folkLook(body("shaggy", { folk: facts({ key: k * 7919 + 13 }) }))!.hide),
    ),
  );
  assert.ok(hides.size >= 36, `${hides.size} hides of 40`);
});

test("their star and their land colour them; their planet's pull builds them", () => {
  const under = (star: number) => folkLook(body("ape", { folk: facts({ star }) }))!;
  assert.ok(
    light(under(7200).hide) > light(under(3500).hide),
    "pale under a hot star, dark under a red one",
  );
  const cold = folkLook(body("shaggy", { folk: facts({ warmth: -15 }) }))!,
    warm = folkLook(body("shaggy", { folk: facts({ warmth: 20 }) }))!;
  assert.ok(light(cold.hide) > 0.55 && light(cold.hide) > light(warm.hide), "pale fur on the ice");
  const light1 = folkLook(body("ape", { folk: facts({ gravity: 0.6 }) }))!,
    heavy = folkLook(body("ape", { folk: facts({ gravity: 1.8 }) }))!;
  assert.ok(
    light1.tall > heavy.tall && light1.girth < heavy.girth,
    "tall and slight, low and broad",
  );
  const high = (b: FigureBody) => Math.max(...figureOf(b, 0).parts.map((p) => p.y + p.sy / 2));
  assert.ok(
    high(body("ape", { folk: facts({ gravity: 0.6 }) })) >
      high(body("ape", { folk: facts({ gravity: 1.8 }) })),
  );
});

test("what their forebears grew they bear: a crest, horns, feelers, more eyes, a tail, a spotted hide", () => {
  const plain = body("ape", {
      folk: facts({
        forebears: {
          neck: 0.2,
          tail: 0,
          grows: [],
          eyes: 2,
          feelers: false,
          pattern: "plain",
          covering: "slick",
          legs: 2,
        },
      }),
    }),
    marked = body("ape", {
      folk: facts({
        forebears: {
          neck: 0.6,
          tail: 0.9,
          grows: ["crest", "horns"],
          eyes: 4,
          feelers: true,
          pattern: "spots",
          covering: "slick",
          legs: 2,
        },
      }),
    });
  const a = folkLook(plain)!,
    b = folkLook(marked)!;
  assert.ok(b.crest > 0.5 && b.horns >= 1 && b.feelers && b.eyes === 4 && b.pattern === "spots");
  assert.ok(b.tail > a.tail && b.neck > a.neck);
  const f = figureOf(marked, 2),
    eyes = f.parts.filter((p) => p.tone === 4);
  assert.equal(eyes.length, 4, "four eyes in the face");
  assert.ok(f.parts.length > figureOf(plain, 2).parts.length + 6, "more grows on them");
  assert.ok(
    f.parts.some((p) => p.tone === 3 && p.shape === "cone"),
    "horns",
  );
  // (Eyes drawn from a balanced setting up; the shape, crest and horns at every setting.)
  assert.equal(figureOf(marked, 0).parts.filter((p) => p.tone === 4).length, 0);
});

test("each stance has its limbs, swinging as the upright apes' do; their clothes over their hide", () => {
  const roles = (b: FigureBody) => {
    const parts = figureOf(b, 0).parts;
    return {
      arms: parts.filter((p) => p.role === "arm").length,
      legs: parts.filter((p) => p.swing && p.role !== "arm").length,
      cloth: parts.filter((p) => p.tone === 5).length,
      swinging: parts.every((p) => !p.swing || p.pivot !== undefined),
    };
  };
  const f = facts();
  assert.deepEqual(roles(body("shaggy", { folk: f })), {
    arms: 4,
    legs: 2,
    cloth: 1,
    swinging: true,
  });
  assert.deepEqual(roles(body("ape", { folk: f })), { arms: 2, legs: 2, cloth: 1, swinging: true });
  assert.deepEqual(roles(body("crawler", { folk: f })), {
    arms: 2,
    legs: 4,
    cloth: 1,
    swinging: true,
  });
  assert.deepEqual(roles(body("burrower", { folk: f })), {
    arms: 2,
    legs: 6,
    cloth: 1,
    swinging: true,
  });
  assert.deepEqual(roles(body("shore", { folk: f })), {
    arms: 2,
    legs: 4,
    cloth: 1,
    swinging: true,
  });
  assert.deepEqual(roles(body("trunk", { folk: f })), {
    arms: 1,
    legs: 4,
    cloth: 1,
    swinging: true,
  });
  assert.deepEqual(roles(body("strider", { folk: f })), {
    arms: 2,
    legs: 2,
    cloth: 1,
    swinging: true,
  });
  const sea = roles(body("swimmer", { folk: f }));
  assert.ok(sea.arms + sea.legs === 8 && sea.cloth === 1, JSON.stringify(sea));
  // Their hide, their clothes over it in their group's colour, their markings each person's own.
  const b = body("crawler", { folk: f }),
    look = folkLook(b)!,
    paint = figurePaint(b, "metal", 2);
  assert.equal(paint.folk, true);
  assert.deepEqual(paint.tones[0], look.hide);
  assert.deepEqual(paint.tones[5], clothes("metal", 2).body);
  assert.equal(paint.hairs.length, HAIRS.length);
  assert.notDeepEqual(paint.hairs[0], paint.hairs[3]);
});
