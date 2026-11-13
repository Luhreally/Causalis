// A ruler ruled by the god's hand (Lives L4), the page's part. Taking a ruler submits nothing: it is this page knowing whom
// it rules, so a world under a ruler who does nothing goes on exactly as it would have. The eye goes to their home; the
// clock runs months (view/lived.ts ruledSpeed) and is held whenever a choice is open; each thing done is a command, and a
// refusal comes back in the world's words. When their rule ends the bar says how, and offers whoever holds the seat.
// One of the realm's court can be taken instead (2026-11-13): what they do goes through role.* commands, put to the
// realm rather than decreed. A switch, as a mortal or the god in them, is sent with each thing done; nothing else is.
import "./life.css";
import "./reign.css";
import type {
  HostClient,
  Leader,
  LeaderList,
  ReignCourt,
  ReignGod,
  ReignDecrees,
  ReignEnvoys,
  ReignMatches,
  ReignNow,
  ReignWars,
} from "../bridge/index.ts";
import { ReignHud, type PageWindow, type ReignSheet, type TimeBar } from "../ui/index.ts";
import { ruledSpeed } from "../view/index.ts";
import type { Leaders } from "./leaders.ts";
import type { Possession } from "./possess.ts";

export type ReignDeps = {
  readonly stage: { onUpdate(f: (dt: number) => void): unknown };
  readonly hud: HTMLElement;
  readonly client: HostClient;
  readonly time: TimeBar;
  readonly pages: PageWindow;
  readonly possession: Possession;
  readonly leaders: Leaders;
  /** The god's own palette and brushes, opened over a realm ruled with the god in them, and shut. */
  readonly palette: { open(): void; shut(): void };
};
export type ReignFlow = {
  /** Take a realm's ruler, or one of its court by number: nothing is recorded until something is done. */
  take(realm: string, fig?: number): Promise<string | null>;
  /** Let them go: back to the world as it was. */
  leave(): void;
  readonly on: boolean;
  /** Whose word it is, while one is ruled (H1). */
  who(): { realm: string; ruler: string } | null;
};

const refused = (e: Error) => e.message.replace(/^(reign|role)\.\w+: /, "");
/** What the god in them lifts, said when the switch is pressed. */
const CHANNEL_ON =
  "🌟 The god is in them. Their word carries past the voices, their standing and what others will hear: history can be turned. Each thing done so is an omen the realm remembers. Nothing comes from nothing: no host where none can go, no land where none lies between.";
const CHANNEL_OFF = "🧍 As a mortal: everything is bounded by their station again.";

export function installReign(d: ReignDeps): ReignFlow {
  const hud = new ReignHud(d.hud);
  let on: { realm: string; ruler: string; role?: { fig: number; name: string } } | null = null,
    /** The god in them: sent with each thing done, and nothing else. */
    channel = false,
    /** The realm the god's hand is aimed at (null: their own). */
    aim: string | null = null,
    now: ReignNow | null = null,
    pace: "stop" | "slow" | "quick" = "slow",
    asking = false,
    askedAt = 0,
    was: number | null = null,
    sent = 0,
    walking = false,
    /** The newest thing told of the realm, once read. */
    toldLast: string | null = null,
    /** The sheet up, to read again when something is done. */
    sheet: ReignSheet | null = null,
    /** What has been put to them already (Lives L5): asked once. */
    asked: string | null = null;

  const clockNow = (): number => d.client.status?.t ?? 0;

  const refresh = async (): Promise<void> => {
    if (asking || !on) return;
    asking = true;
    try {
      const l = await d.client.query<ReignNow | null>({
        type: "reign.now",
        args: { realm: on.realm, ruler: on.ruler, ...(on.role ?? {}) },
      });
      if (!on || !l) return;
      // What has just happened in the realm, said as it comes, with its page a tap away.
      const newest = l.told[0];
      if (newest && newest.ref !== toldLast) {
        if (toldLast !== null) hud.say(`Year ${newest.year}: ${newest.words}`, newest.ref);
        toldLast = newest.ref;
      }
      now = l;
      hud.set(l, clockNow(), pace);
      // A plot against them, an heir dead: the clock stops, and they answer.
      if (l.drama && l.drama.key !== asked && !l.fell) {
        asked = l.drama.key;
        hud.drama(l.drama);
      }
    } finally {
      asking = false;
    }
  };

  const take = async (realm: string, fig?: number): Promise<string | null> => {
    const list = await d.client.query<LeaderList | null>({
        type: "leaders.of",
        args: { realm },
      }),
      ruler: Leader | undefined = list?.leaders.find((x) => x.ref === `rule:${realm}`);
    if (!ruler) return "no one rules there";
    if (!ruler.town && ruler.cannot && /fallen/.test(ruler.cannot)) return ruler.cannot;
    // (One of its court: found among those who live at its seat, by their page.)
    let l = ruler;
    if (fig !== undefined) {
      const court = await d.client
          .query<Leader[]>({ type: "leaders.court", args: { realm } })
          .catch(() => [] as Leader[]),
        held = court.find((x) => x.ref === `court:${realm}:${fig}`);
      if (!held) return "they are no longer at its court";
      l = held;
    }
    if (d.possession.on) await d.possession.letGo();
    on =
      fig !== undefined
        ? { realm, ruler: ruler.name, role: { fig, name: l.name } }
        : { realm, ruler: ruler.name };
    channel = false;
    hud.setChannel(false);
    toldLast = null;
    asked = null;
    was ??= d.time.speed;
    pace = "slow";
    sent = 0;
    d.pages.close();
    hud.show();
    await refresh();
    if (now) hud.say(now.role ? now.role.words : now.station);
    if (l.town) await d.leaders.home(l);
    return null;
  };

  const leave = (): void => {
    on = null;
    channel = false;
    aim = null;
    d.palette.shut();
    hud.setChannel(false);
    now = null;
    walking = false;
    hud.hide();
    d.leaders.clear();
    d.time.release("reign");
    if (was !== null) d.client.setSpeed(was);
    was = null;
    sent = 0;
  };

  /** A sheet read and put up, for whoever is held, as a mortal or with the god in them. */
  const open = async (kind: ReignSheet): Promise<void> => {
    if (!on) return;
    sheet = kind;
    const args = { realm: on.realm, channel, ...(on.role ? { fig: on.role.fig } : {}) };
    if (kind === "decrees") {
      const s = await d.client.query<ReignDecrees | null>({ type: "reign.decrees", args });
      if (s) hud.decrees(s);
    } else if (kind === "wars") {
      const s = await d.client.query<ReignWars | null>({ type: "reign.wars", args });
      if (s) hud.wars(s);
    } else if (kind === "envoys") {
      const s = await d.client.query<ReignEnvoys | null>({ type: "reign.envoys", args });
      if (s) hud.envoys(s);
    } else if (kind === "factions") {
      const s = await d.client.query<ReignCourt | null>({ type: "reign.court", args });
      if (s) hud.court(s);
    } else if (kind === "god") {
      if (!channel) {
        hud.closeSheet();
        sheet = null;
        return;
      }
      const s = await d.client.query<ReignGod | null>({
        type: "reign.godhand",
        args: { ...args, ...(aim ? { to: aim } : {}) },
      });
      if (s) hud.god(s);
    } else {
      const s = await d.client.query<ReignMatches | null>({ type: "reign.matches", args });
      if (s) hud.matches(s);
    }
  };

  /** Something done: gone through the world's own door, or refused in its words in the sheet. One of a court acts as themself. */
  const act = async (type: string, args: Record<string, unknown>, done: string): Promise<void> => {
    if (!on) return;
    const who = on.role
      ? { realm: on.realm, fig: on.role.fig, name: on.role.name }
      : { realm: on.realm, ruler: on.ruler };
    try {
      await d.client.command(type, { ...who, ...args, ...(channel ? { channel: true } : {}) });
      hud.closeSheet();
      sheet = null;
      hud.say(
        channel && type !== "reign.god"
          ? `🌟 ${done} The realm will speak of the omen for years.`
          : done,
      );
      await refresh();
    } catch (error) {
      hud.answer(refused(error as Error));
    }
  };

  hud.onDrama = (drama, choice) => {
    if (!on || choice === "let") {
      if (on) hud.say("You let it be. The realm decides it.");
      return;
    }
    void (
      drama.kind === "fire"
        ? d.client.command("fire.answer", { realm: on.realm, ruler: on.ruler, answer: choice })
        : choice.startsWith("name:")
          ? d.client.command("court.name", {
              realm: on.realm,
              ruler: on.ruler,
              fig: Number(choice.slice(5)),
            })
          : d.client.command("court.answer", { realm: on.realm, ruler: on.ruler, answer: choice })
    )
      .then(() => {
        hud.say(
          drama.kind === "fire"
            ? choice === "loose"
              ? "Your word has gone out. It cannot be called back."
              : "You hold your hand. The world breathes again."
            : drama.kind === "plot"
              ? "Your word has gone out: the plot goes no further."
              : "Your word has gone out: they will follow you.",
        );
        return refresh();
      })
      .catch((error: Error) => hud.say(refused(error)));
  };
  hud.onSheet = (kind) => void open(kind);
  hud.onDecree = (law, to) =>
    void (on?.role
      ? act(
          "role.propose",
          law === "tithe" ? { what: "tithe", to } : { what: "law", law, to },
          "You put it to the realm, and it carried: it is law.",
        )
      : act("reign.decree", { law, to }, "Your word has gone out."));
  hud.onWar = (against, prize) =>
    void (on?.role
      ? act(
          "role.propose",
          { what: "war", against, prize },
          "You put it to the realm, and it carried: war is declared. The first battle comes at the end of next year.",
        )
      : act(
          "reign.war",
          { against, prize },
          "War is declared. The host goes out, and the first battle comes at the end of next year.",
        ));
  hud.onBack = (group) =>
    void act(
      "role.back",
      { group },
      `${group[0]!.toUpperCase()}${group.slice(1)} stand behind you now.`,
    );
  hud.onPlot = () =>
    void act(
      "role.plot",
      {},
      "You have moved on the seat. It comes to its end within the year: hold the clock, or let it run.",
    );
  hud.onGod = (args, label) =>
    void act(
      "reign.god",
      args,
      `🌟 Done by the god in them: ${label.replace(/^\S+\s/, "")}. The annals will tell it.`,
    );
  hud.onGodAim = (realm) => {
    aim = realm === on?.realm ? null : realm;
    void open("god");
  };
  hud.onPalette = () => {
    hud.closeSheet();
    sheet = null;
    d.palette.open();
  };
  hud.onChannel = () => {
    channel = !channel;
    if (!channel) d.palette.shut();
    hud.setChannel(channel);
    hud.say(channel ? CHANNEL_ON : CHANNEL_OFF);
    if (sheet) void open(sheet);
  };
  hud.onRuleAfter = (seated) => {
    const realm = now?.realm,
      name = seated ? now?.role?.name : now?.ruler;
    if (!realm || !name) return;
    hud.hide();
    void take(realm);
  };
  hud.onPeace = (foe, offer) =>
    void act(
      on?.role ? "role.propose" : "reign.peace",
      on?.role ? { what: "peace", against: foe } : { with: foe, offer },
      offer === "truce"
        ? "They heard you: the war is over, and a truce holds."
        : offer.startsWith("give")
          ? "They took what you offered: the war is over."
          : "They gave way: the war is over, on your terms.",
    );
  hud.onRise = () =>
    void act("reign.rise", {}, "You have thrown off your oath. It is war, or it will be soon.");
  hud.onEnvoy = (to, errand, name) =>
    void act(
      "reign.envoy",
      { to, errand },
      errand === "embassy"
        ? `Your envoy has set out for ${name}. Your people will keep a house at their seat.`
        : errand === "pact"
          ? `Your envoy has set out for ${name}. They have sworn a pact with you.`
          : `Your envoy has set out for ${name}, with the grain.`,
    );
  hud.onWed = (m) =>
    void act(
      "reign.wed",
      { to: m.to, who: m.who, partner: m.partner },
      `${m.who.name} is wed to ${m.partner.name}. Your realms think the better of each other.`,
    );
  hud.onHeir = () => {
    const f = now?.fell,
      realm = now?.realm;
    if (!f?.heir || !realm) return;
    on = { realm, ruler: f.heir.name };
    hud.hide();
    hud.show();
    hud.say(`You rule on as ${f.heir.name}.`);
    void refresh();
  };
  hud.onLetGo = () => leave();
  hud.onPage = (ref) => void d.pages.open(ref);
  hud.onPace = (p) => {
    pace = p;
    sent = 0;
    if (now) hud.set(now, clockNow(), pace);
  };
  hud.onWalk = () => {
    walking = true;
    hud.hide();
    void d.leaders.possess().then((why) => {
      if (why) {
        walking = false;
        hud.show();
        hud.say(why);
      }
    });
  };

  // Back from their body: the bar again. (What was done there is history's.)
  const wasEnded = d.possession.onEnded;
  d.possession.onEnded = (town) => {
    wasEnded(town);
    if (!walking) return;
    walking = false;
    hud.show();
    sent = 0;
    void refresh();
  };

  d.stage.onUpdate(() => {
    if (!on || walking) return;
    const at = performance.now();
    if (at - askedAt > 400) {
      askedAt = at;
      void refresh();
    }
    // Held whenever a choice is open, or a page is being read; else the months go by.
    const reading = !d.pages.element.hidden;
    hud.underPage(reading);
    if (hud.waiting || pace === "stop" || reading) {
      d.time.hold("reign");
      sent = 0;
    } else {
      d.time.release("reign");
      const speed = ruledSpeed(pace === "quick");
      if (sent !== speed) {
        sent = speed;
        d.client.setSpeed(speed);
      }
    }
  });

  Object.assign((globalThis as unknown as { causalis: object }).causalis, {
    reign: {
      take,
      leave,
      channel: () => channel,
      as: () => on?.role ?? null,
      state: () => now,
      pace: () => pace,
      sheet: () => sheet,
      on: () => !!on,
    },
  });

  return {
    take,
    leave,
    who: () => on,
    get on() {
      return !!on;
    },
  };
}
