// The things to do on a page (Phase 10 M92): the god's acts on a land and on a place, the
// hand laid on a town and lifted, a family met, and the acts on one under the hand. A page
// names its tools; they are drawn here, and each asks twice before it acts (what it will do,
// then "confirm"), because what follows is history's.
import type { HostClient } from "../bridge/index.ts";
import { el } from "./why.ts";
import { HandView } from "./hand.ts";

export type ToolContext = {
  readonly client: HostClient;
  /** Read the page again (after an act, or a family met). */
  readonly refresh: () => void;
  /** Open a thing's page. */
  readonly open: (ref: string) => void;
};

type Settlement = {
  ref: string;
  name: string;
  cell: number;
  shrine: string | null;
  spring: string | null;
  city: unknown;
};

/** A button that asks before it acts: its label, then what it will do and "confirm". */
function twice(
  tools: HTMLElement,
  note: HTMLElement,
  label: string,
  effect: string,
  act: () => Promise<void>,
): HTMLButtonElement {
  const b = el("button", "tool", label);
  b.dataset.label = label;
  b.onclick = async () => {
    if (b.dataset.sure !== "yes") {
      for (const other of tools.children) {
        const o = other as HTMLButtonElement;
        if (o !== b && o.dataset.sure === "yes") {
          o.dataset.sure = "";
          o.textContent = o.dataset.label ?? o.textContent;
        }
      }
      b.dataset.sure = "yes";
      b.textContent = `${label} — confirm`;
      note.hidden = false;
      note.textContent = `${effect} What follows is theirs, and history will remember it was your hand.`;
      return;
    }
    b.disabled = true;
    try {
      await act();
    } catch (error) {
      note.textContent = (error as Error).message;
      b.disabled = false;
    }
  };
  tools.append(b);
  return b;
}

/** Draw a page's tool into `into`. */
export function drawTool(
  into: HTMLElement,
  tool: string,
  args: Readonly<Record<string, unknown>>,
  ctx: ToolContext,
): void {
  switch (tool) {
    case "acts.land": {
      const hand = new HandView(ctx.client);
      hand.onWhy = (ref) => ctx.open(ref);
      void hand.show(into, args.cell as number);
      return;
    }
    case "acts.place":
      void placeActs(into, args.town as string, ctx);
      return;
    case "hand.town":
      void handOn(into, args.town as string, ctx);
      return;
    case "meet.town":
    case "meet.land": {
      const b = el("button", "act", "Meet a family");
      b.title = "Meet one of the families that live here: their names, lives and memories.";
      b.onclick = async () => {
        b.disabled = true;
        try {
          const hh = await ctx.client.query<{ ref: string }>({
            type: "observe.meet",
            args: { cell: args.cell, village: args.town ?? null },
          });
          ctx.open(hh.ref);
        } finally {
          b.disabled = false;
        }
      };
      into.append(b);
      return;
    }
    case "acts.agent":
      void agentActs(into, args.id as number, ctx);
      return;
    default:
      return;
  }
}

/** The god's hand on a place: a shrine raised, a spring opened, fire sent on a city. */
async function placeActs(into: HTMLElement, ref: string, ctx: ToolContext): Promise<void> {
  const s = await ctx.client.query<Settlement>({ type: "settlement", args: { ref } });
  const tools = el("div", "tools"),
    note = el("p", "note"),
    done: HTMLElement[] = [];
  note.hidden = true;
  const act = (type: string) => async () => {
    await ctx.client.command(type, { village: ref });
    ctx.refresh();
  };
  const line = (text: string, event: string) => {
    const b = el("button", "line act-line", text);
    b.onclick = () => ctx.open(event);
    done.push(b);
  };
  if (s.shrine) line("A shrine you raised stands here", s.shrine);
  else
    twice(
      tools,
      note,
      "Raise a shrine",
      `A shrine will rise in ${s.name}: the devout will read it as a sign.`,
      act("act.shrine"),
    );
  if (s.spring) line("A spring you opened rises here", s.spring);
  else
    twice(
      tools,
      note,
      "Open a spring",
      `Water will well up at ${s.name}, and those who settle the land will be drawn to it.`,
      act("act.spring"),
    );
  if (s.city)
    twice(
      tools,
      note,
      "Send fire",
      `Fire will sweep ${s.name}: a fifth of its quarters will burn, and some of its people die.`,
      act("act.fire"),
    );
  into.replaceChildren(el("h3", undefined, "Your hand on this place"), tools, note, ...done);
}

/** The god's hand laid on a town (every one of its people someone), or lifted. */
async function handOn(into: HTMLElement, ref: string, ctx: ToolContext): Promise<void> {
  const [hand, s] = await Promise.all([
    ctx.client.query<{ village: string; name: string; people: number; since: number } | null>({
      type: "hand",
    }),
    ctx.client.query<Settlement>({ type: "settlement", args: { ref } }),
  ]);
  const tools = el("div", "tools"),
    note = el("p", "note");
  note.hidden = true;
  const parts: HTMLElement[] = [el("h3", undefined, "Your hand")];
  if (hand && hand.village === ref) {
    parts.push(
      el(
        "div",
        "fact act-line",
        `Your hand has rested here since year ${hand.since}: its ${hand.people} people live as themselves.`,
      ),
    );
    twice(
      tools,
      note,
      "Lift your hand",
      "They will go back to being counted; nothing that happened under it is undone.",
      async () => {
        await ctx.client.command("hand.lift", {});
        ctx.refresh();
      },
    );
  } else if (hand)
    parts.push(el("p", "muted", `Your hand rests on ${hand.name}; lift it there to lay it here.`));
  else
    twice(
      tools,
      note,
      "Lay your hand here",
      `Every one of ${s.name}'s people will be someone, born and dying one by one, until you lift your hand.`,
      async () => {
        await ctx.client.command("hand.lay", { village: ref });
        ctx.refresh();
      },
    );
  into.replaceChildren(...parts, tools, note);
}

/** The god's acts on one under the hand: inspire them, bless them. */
async function agentActs(into: HTMLElement, id: number, ctx: ToolContext): Promise<void> {
  const a = await ctx.client.query<{ name: string; blessedUntil: number | null } | null>({
    type: "agent",
    args: { id },
  });
  if (!a) {
    into.replaceChildren(el("p", "muted", "They are no longer among the living."));
    return;
  }
  const tools = el("div", "tools"),
    note = el("p", "note"),
    first = a.name.split(" ")[0];
  note.hidden = true;
  const act = (type: string) => async () => {
    await ctx.client.command(type, { agent: id });
    ctx.refresh();
  };
  twice(
    tools,
    note,
    "Inspire them",
    `${first} will come upon the next thing their land could know, and be remembered for it.`,
    act("act.inspire-one"),
  );
  const parts: HTMLElement[] = [el("h3", undefined, "Your hand on them"), tools, note];
  if (a.blessedUntil === null)
    twice(
      tools,
      note,
      "Bless them",
      `${first} will be spared death for twenty years, while your hand rests here.`,
      act("act.bless-one"),
    );
  else parts.push(el("div", "fact act-line", `Blessed: spared death until year ${a.blessedUntil}`));
  into.replaceChildren(...parts);
}
