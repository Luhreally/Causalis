// A ruler ruled by the god's hand (Lives L4), the page's part. Taking a ruler submits nothing: it is this page knowing whom
// it rules, so a world under a ruler who does nothing goes on exactly as it would have. The eye goes to their home; the
// clock runs months (view/lived.ts ruledSpeed) and is held whenever a choice is open; each thing done is a command, and a
// refusal comes back in the world's words. When their rule ends the bar says how, and offers whoever holds the seat.
import "./life.css";
import "./reign.css";
import type {
  HostClient,
  Leader,
  LeaderList,
  ReignDecrees,
  ReignMatches,
  ReignNow,
  ReignWars,
} from "../bridge/index.ts";
import { ReignHud, type PageWindow, type TimeBar } from "../ui/index.ts";
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
};
export type ReignFlow = {
  /** Take a realm's ruler: nothing is recorded until something is done. */
  take(realm: string): Promise<string | null>;
  /** Let them go: back to the world as it was. */
  leave(): void;
  readonly on: boolean;
};

const refused = (e: Error) => e.message.replace(/^reign\.\w+: /, "");

export function installReign(d: ReignDeps): ReignFlow {
  const hud = new ReignHud(d.hud);
  let on: { realm: string; ruler: string } | null = null,
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
    sheet: "decrees" | "wars" | "matches" | null = null,
    /** What has been put to them already (Lives L5): asked once. */
    asked: string | null = null;

  const clockNow = (): number => d.client.status?.t ?? 0;

  const refresh = async (): Promise<void> => {
    if (asking || !on) return;
    asking = true;
    try {
      const l = await d.client.query<ReignNow | null>({
        type: "reign.now",
        args: { realm: on.realm, ruler: on.ruler },
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

  const take = async (realm: string): Promise<string | null> => {
    const list = await d.client.query<LeaderList | null>({
        type: "leaders.of",
        args: { realm },
      }),
      l: Leader | undefined = list?.leaders.find((x) => x.ref === `rule:${realm}`);
    if (!l) return "no one rules there";
    if (!l.town && l.cannot && /fallen/.test(l.cannot)) return l.cannot;
    if (d.possession.on) await d.possession.letGo();
    on = { realm, ruler: l.name };
    toldLast = null;
    asked = null;
    was ??= d.time.speed;
    pace = "slow";
    sent = 0;
    d.pages.close();
    hud.show();
    await refresh();
    if (now) hud.say(now.station);
    if (l.town) await d.leaders.home(l);
    return null;
  };

  const leave = (): void => {
    on = null;
    now = null;
    walking = false;
    hud.hide();
    d.leaders.clear();
    d.time.release("reign");
    if (was !== null) d.client.setSpeed(was);
    was = null;
    sent = 0;
  };

  /** A sheet read and put up. */
  const open = async (kind: "decrees" | "wars" | "matches"): Promise<void> => {
    if (!on) return;
    sheet = kind;
    const args = { realm: on.realm };
    if (kind === "decrees") {
      const s = await d.client.query<ReignDecrees | null>({ type: "reign.decrees", args });
      if (s) hud.decrees(s);
    } else if (kind === "wars") {
      const s = await d.client.query<ReignWars | null>({ type: "reign.wars", args });
      if (s) hud.wars(s);
    } else {
      const s = await d.client.query<ReignMatches | null>({ type: "reign.matches", args });
      if (s) hud.matches(s);
    }
  };

  /** Something done: gone through the world's own door, or refused in its words in the sheet. */
  const act = async (type: string, args: Record<string, unknown>, done: string): Promise<void> => {
    if (!on) return;
    try {
      await d.client.command(type, { realm: on.realm, ruler: on.ruler, ...args });
      hud.closeSheet();
      sheet = null;
      hud.say(done);
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
  hud.onDecree = (law, to) => void act("reign.decree", { law, to }, "Your word has gone out.");
  hud.onWar = (against, prize) =>
    void act(
      "reign.war",
      { against, prize },
      "War is declared. The host goes out, and the first battle comes at the end of next year.",
    );
  hud.onPeace = (foe, offer) =>
    void act(
      "reign.peace",
      { with: foe, offer },
      offer === "truce"
        ? "They heard you: the war is over, and a truce holds."
        : offer.startsWith("give")
          ? "They took what you offered: the war is over."
          : "They gave way: the war is over, on your terms.",
    );
  hud.onRise = () =>
    void act("reign.rise", {}, "You have thrown off your oath. It is war, or it will be soon.");
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
      state: () => now,
      pace: () => pace,
      sheet: () => sheet,
      on: () => !!on,
    },
  });

  return {
    take,
    leave,
    get on() {
      return !!on;
    },
  };
}
