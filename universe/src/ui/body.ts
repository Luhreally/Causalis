// A body drawn whole (Phase 55 wave 5; asked for 2026-10-27: "...see they family and anatomy etc
// in town vieww"): the person's figure as their portrait draws it — their people's look, their
// land's clothes, their wounds as they show (a member lost drawn gone, linen bound, a sling, a
// crutch, a patch) — standing square to the eye, each member of their people's plan that is not
// whole marked where it is and named beside it: struck, abed, healing, healed, scarred, lame, lost,
// the blow that killed. Their left is the picture's right, as one facing you.
import type { Block, KinCard, MemberState, WoundMember } from "../bridge/index.ts";
import { figureAnatomy, figureOf, partExtent } from "../view/index.ts";
import { drawSolids, personSolids, surface, type V3 } from "./portrait.ts";
import { el } from "./why.ts";

type BodyBlock = Extract<Block, { type: "body" }>;

/** Each state's mark: its colour, and whether the member is drawn gone under it. */
const MARK: Readonly<Record<MemberState, { color: string; gone?: true } | null>> = {
  whole: null,
  healed: { color: "#8fd18b" },
  scarred: { color: "#e3a0a0" },
  lame: { color: "#f2c14e" },
  healing: { color: "#f59a3a" },
  abed: { color: "#ff5a4a" },
  struck: { color: "#ff3b3b" },
  lost: { color: "#c0262f", gone: true },
  killed: { color: "#ff1a1a" },
};
/** A state in a word or two beside its member. */
const WORD: Readonly<Record<MemberState, string>> = {
  whole: "whole",
  healed: "healed",
  scarred: "scarred",
  lame: "lame",
  healing: "healing",
  abed: "abed",
  struck: "struck",
  lost: "lost",
  killed: "death blow",
};

/** Where a member lies on the figure (its own metres), as the portrait places its parts. */
function memberPoint(b: BodyBlock, m: WoundMember): V3 | null {
  const figure = figureOf(b.person.body, 3),
    a = figureAnatomy(figure),
    k = b.person.child ? 0.7 : 1,
    at = (i: number): V3 | null => {
      const q = figure.parts[i];
      return q ? [q.x * k, q.y * k, q.z * k] : null;
    };
  if (m === "eye-l" || m === "eye-r") {
    const h = figure.parts[a.on.head];
    if (!h) return null;
    const e = partExtent(h);
    return [
      (h.x + (m === "eye-l" ? 0.28 : -0.28) * e[0]) * k,
      (h.y + 0.12 * e[1]) * k,
      (h.z + 0.5 * e[2]) * k,
    ];
  }
  // (A hand: the least part of its arm's chain; a limb of several parts, its first.)
  const i = a.on[m];
  return i >= 0 ? at(i) : null;
}

/**
 * Draw a body (w × h CSS pixels): the figure in the middle, each member not whole marked — a ring
 * where it is (dashed where the member is gone), its name and state beside it, its left on the
 * picture's right.
 */
export function drawBody(canvas: HTMLCanvasElement, b: BodyBlock, w: number, h: number): void {
  const ctx = surface(canvas, w, h),
    art = { x: w * 0.3, y: 12, w: w * 0.4, h: h - 30 },
    at = drawSolids(ctx, personSolids(b.person), { turn: 0, tilt: 0.1 }, art),
    marks = b.members
      .filter((m) => MARK[m.state])
      .map((m) => {
        const p = memberPoint(b, m.member);
        return p ? { m, p: at(p) } : null;
      })
      .filter((x) => x !== null);
  // (Their left on the picture's right; the head and the body on the emptier side.)
  const rightSide = (x: (typeof marks)[number]) =>
      x.m.member.endsWith("-l") ||
      (!x.m.member.endsWith("-r") &&
        marks.filter((y) => y.m.member.endsWith("-l")).length <=
          marks.filter((y) => y.m.member.endsWith("-r")).length),
    sides = [marks.filter((x) => !rightSide(x)), marks.filter(rightSide)];
  ctx.font = "11px Verdana, Tahoma, sans-serif";
  ctx.textBaseline = "middle";
  sides.forEach((list, s) => {
    const right = s === 1,
      sorted = list.sort(
        (x, y) =>
          x.p[1] - y.p[1] ||
          x.p[0] - y.p[0] ||
          (x.m.member < y.m.member ? -1 : x.m.member > y.m.member ? 1 : 0),
      ),
      // (Each label at its member's height, below the one above it, the lot kept on the canvas.)
      ys: number[] = [];
    sorted.forEach((x, i) => ys.push(Math.max(14, x.p[1], i ? ys[i - 1]! + 20 : 14)));
    const over = (ys.at(-1) ?? 0) - (h - 14);
    if (over > 0) for (let i = 0; i < ys.length; i++) ys[i] = Math.max(14, ys[i]! - over);
    sorted.forEach((x, row) => {
      const mark = MARK[x.m.state]!,
        [px, py] = x.p,
        text = `${x.m.words.replace(/^(his|her|their) /, "")}: ${WORD[x.m.state]}`,
        tw = ctx.measureText(text).width + 10,
        lx = right ? w - 6 - tw : 6,
        y = ys[row]!;
      // The ring on the member; dashed where it is gone.
      ctx.strokeStyle = mark.color;
      ctx.lineWidth = 2;
      ctx.setLineDash(mark.gone ? [3, 3] : []);
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
      if (x.m.state === "killed" || x.m.state === "struck") {
        ctx.fillStyle = mark.color;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, 2 * Math.PI);
        ctx.fill();
      }
      // Its name and state beside it, a line to it.
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(right ? lx : lx + tw, y);
      ctx.lineTo(px + (right ? 7 : -7), py);
      ctx.stroke();
      ctx.fillStyle = "rgba(8, 16, 44, 0.85)";
      ctx.fillRect(lx, y - 9, tw, 18);
      ctx.strokeRect(lx, y - 9, tw, 18);
      ctx.fillStyle = "#f2f6ff";
      ctx.textAlign = "left";
      ctx.fillText(text, lx + 5, y);
    });
  });
  if (!marks.length) {
    ctx.fillStyle = "#a9bbe2";
    ctx.textAlign = "center";
    ctx.fillText("whole", w / 2, h - 10);
  }
}

/** A body block's view: its canvas, drawn once it has its width (its border inside the block's). */
export function bodyView(b: BodyBlock): HTMLElement {
  const box = el("div", "body-view"),
    canvas = el("canvas", "body-figure");
  canvas.setAttribute(
    "aria-label",
    `A body: ${b.members.map((m) => `${m.words} ${WORD[m.state]}`).join(", ")}`,
  );
  box.append(canvas);
  box.dataset["members"] = b.members.map((m) => `${m.member}:${m.state}`).join(" ");
  requestAnimationFrame(() =>
    drawBody(canvas, b, Math.max(280, Math.min(520, (box.clientWidth || 322) - 2)), 260),
  );
  return box;
}

/** A card's family and body, a line each (Phase 55 wave 5): "Family: husband of Aela, father of three". */
export function kinLines(card: KinCard): HTMLElement[] {
  return [
    ...(card.family ? [el("div", "fact folk-family", `Family: ${card.family}`)] : []),
    ...(card.body ? [el("div", "fact folk-body", `Body: ${card.body}`)] : []),
  ];
}
