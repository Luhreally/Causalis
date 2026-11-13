// A ruler ruled by the god's hand, on the phone (Lives L4): the bar at the top (who, the months, the realm at a glance,
// its wealth against those it meets), a tray along the bottom (decrees, war and peace, marriage, the realm, walk), a sheet
// for each of those, and a window when their rule ends. The middle takes no touches. A choice that cannot be made can
// still be pressed: the world says why in words. Every control a finger's size. Nothing here decides.
// One of a court held instead (2026-11-13): the bar names them, the tray puts things to the realm rather than decreeing
// them, and courts groups or moves on the seat; and a switch on the bar, as a mortal or the god in them, says which.
import type {
  ReignCourt,
  ReignGod,
  ReignDecrees,
  ReignDrama,
  ReignFall,
  ReignMatch,
  ReignEnvoys,
  ReignMatches,
  ReignNow,
  ReignWars,
} from "../bridge/index.ts";
import { el } from "./why.ts";

const put = (e: HTMLElement, text: string) => {
  if (e.textContent !== text) e.textContent = text;
};
const YEAR_DAYS = 365;
/** The year and month of the world, as a ruler counts time. */
const dated = (t: number) => {
  const day = Math.floor(t / 86_400);
  return `Year ${Math.floor(day / YEAR_DAYS)}, month ${Math.floor((day % YEAR_DAYS) / 30) + 1}`;
};
const many = (n: number) =>
  n >= 1e6
    ? `${(n / 1e6).toFixed(1)}M`
    : n >= 1e4
      ? `${Math.round(n / 1000)}k`
      : Math.round(n).toLocaleString("en-US");
const worth = (n: number) => (n >= 100 ? `${Math.round(n)}` : n.toFixed(1));
/** The sheets the tray opens. */
export type ReignSheet = "decrees" | "wars" | "matches" | "envoys" | "factions" | "god";
const ROLE_ICON: Readonly<Record<string, string>> = {
  heir: "👪",
  rival: "🗡️",
  general: "🛡️",
  voice: "🏛️",
  kin: "👪",
};

/** A chip of the realm at a glance: tapped, its page. */
function chip(kind: string, title: string): HTMLButtonElement {
  const b = el("button", "reign-chip");
  b.dataset.chip = kind;
  b.title = title;
  return b;
}

export class ReignHud {
  readonly element = el("div", "reign-hud");
  private readonly strip = el("div", "life-strip reign-strip");
  private readonly who = el("strong", "life-name");
  private readonly what = el("span", "life-what");
  private readonly letGo = el("button", "life-letgo reign-letgo", "✋ Let go");
  private readonly time = el("span", "life-time");
  private readonly stop = el("button", "life-pace reign-pace", "❚❚");
  private readonly slow = el("button", "life-pace reign-pace", "▶");
  private readonly quick = el("button", "life-pace reign-pace", "▶▶");
  /** As a mortal, or the god in them: what is lifted, said when it is pressed. */
  private readonly channel = el("button", "reign-channel", "🧍 As a mortal");
  private readonly people = chip("people", "Their people");
  private readonly host = chip("host", "Their host");
  private readonly order = chip("order", "Their standing and their lands' grievance");
  private readonly warsChip = chip("wars", "Their wars");
  private readonly heir = chip("heir", "Their court: heir and rivals");
  private readonly wealth = chip("wealth", "Worth a head, and its place");
  private readonly bars = el("button", "reign-bars");
  private readonly told = el("div", "life-told reign-told");
  private readonly tray = el("div", "life-tray reign-tray");
  private readonly sheet = el("div", "life-book reign-sheet");
  private readonly win = el("div", "life-window reign-window");
  private readonly said = el("p", "reign-said");
  private readonly bound = el("button", "life-offer reign-act reign-bound");
  private last: ReignNow | null = null;
  private fallKey = "";
  private toldPage: string | null = null;
  private toldFor: ReturnType<typeof setTimeout> | null = null;
  onPage: (ref: string) => void = () => {};
  onPace: (pace: "stop" | "slow" | "quick") => void = () => {};
  onLetGo: () => void = () => {};
  onWalk: () => void = () => {};
  onSheet: (kind: ReignSheet) => void = () => {};
  /** The god let into them, or let go. */
  onChannel: () => void = () => {};
  /** A group courted, a move on the seat (one of a court). */
  onBack: (group: string) => void = () => {};
  onPlot: () => void = () => {};
  /** The god's hand through them: a thing done, the realm it is aimed at, the god's own palette opened. */
  onGod: (args: Readonly<Record<string, unknown>>, label: string) => void = () => {};
  onGodAim: (realm: string) => void = () => {};
  onPalette: () => void = () => {};
  /** One of a court gone from it: rule as them (they hold the seat), or the one who rules. */
  onRuleAfter: (seated: boolean) => void = () => {};
  onEnvoy: (to: string, errand: string, name: string) => void = () => {};
  onDecree: (law: string, to: number) => void = () => {};
  onWar: (against: string, prize: number) => void = () => {};
  onPeace: (foe: string, offer: string) => void = () => {};
  onRise: () => void = () => {};
  onWed: (m: ReignMatch) => void = () => {};
  onHeir: () => void = () => {};
  /** A plot or an heir's death answered (Lives L5): "let" sends nothing. */
  onDrama: (d: ReignDrama, choice: string) => void = () => {};

  constructor(parent: HTMLElement) {
    this.element.hidden = true;
    const top = el("div", "life-line"),
      paces = el("div", "life-paces"),
      glance = el("div", "reign-glance");
    top.append(this.who, this.what, this.letGo);
    paces.append(this.time, this.stop, this.slow, this.quick, this.channel);
    this.channel.dataset.on = "0";
    this.channel.onclick = () => this.onChannel();
    glance.append(this.people, this.wealth, this.host, this.order, this.warsChip, this.heir);
    this.strip.append(top, paces, glance, this.bars);
    this.win.hidden = this.sheet.hidden = true;
    this.letGo.onclick = () => this.onLetGo();
    this.told.onclick = () => {
      if (this.toldPage) this.onPage(this.toldPage);
    };
    this.stop.onclick = () => this.onPace("stop");
    this.slow.onclick = () => this.onPace("slow");
    this.quick.onclick = () => this.onPace("quick");
    const page = (b: HTMLElement, of: (l: ReignNow) => string) => {
      b.onclick = () => {
        if (this.last) this.onPage(of(this.last));
      };
    };
    page(this.people, (l) => l.realm);
    page(this.wealth, (l) => `${l.realm}#wealth`);
    page(this.host, (l) => l.realm);
    page(this.order, (l) => l.realm);
    page(this.heir, (l) => `${l.realm}#court`);
    this.warsChip.onclick = () => this.onSheet("wars");
    this.bars.onclick = () => {
      const l = this.last,
        n = l?.neighbours[0];
      if (l && n) this.onPage(`compare:${l.realm}|${n.ref}`);
    };
    for (const [icon, label, kind] of [
      ["📜", "Decrees", "decrees"],
      ["⚔️", "War, peace", "wars"],
      ["💍", "Marry", "matches"],
      ["🕊️", "Envoy", "envoys"],
      ["🤝", "Factions", "factions"],
      ["🌟", "God's hand", "god"],
    ] as const) {
      const b = el("button", "life-offer reign-act");
      b.dataset.act = kind;
      b.append(el("span", "life-icon", icon), el("span", "life-label", label));
      b.onclick = () => this.onSheet(kind);
      this.tray.append(b);
    }
    const court = el("button", "life-offer reign-act");
    court.dataset.act = "court";
    court.append(el("span", "life-icon", "🏛️"), el("span", "life-label", "Court"));
    court.onclick = () => {
      if (this.last) this.onPage(`${this.last.realm}#court`);
    };
    this.tray.append(court);
    const realm = el("button", "life-offer reign-act");
    realm.dataset.act = "realm";
    realm.append(el("span", "life-icon", "📖"), el("span", "life-label", "The realm"));
    realm.onclick = () => {
      if (this.last) this.onPage(this.last.realm);
    };
    const walk = el("button", "life-offer reign-act");
    walk.dataset.act = "walk";
    walk.append(el("span", "life-icon", "🕹"), el("span", "life-label", "Walk"));
    walk.onclick = () => this.onWalk();
    // (What a peace has bound the realm to, shown only while something does: W7.)
    this.bound.dataset.act = "bonds";
    this.bound.hidden = true;
    this.bound.onclick = () => this.onSheet("wars");
    this.tray.append(realm, this.bound, walk);
    this.element.append(this.strip, this.told, this.tray, this.sheet, this.win);
    parent.append(this.element);
  }

  get open(): boolean {
    return !this.element.hidden;
  }
  /** A sheet or a window is up: a choice is open, and the clock is held. */
  get waiting(): boolean {
    return !this.win.hidden || !this.sheet.hidden;
  }

  show(): void {
    this.element.hidden = false;
    document.body.classList.add("ruling");
  }
  hide(): void {
    this.element.hidden = true;
    this.win.hidden = this.sheet.hidden = true;
    this.fallKey = "";
    document.body.classList.remove("ruling");
  }
  closeSheet(): void {
    this.sheet.hidden = true;
  }
  /** A page is being read: all but the bar stands aside for it. */
  underPage(open: boolean): void {
    this.element.classList.toggle("under-page", open);
  }
  say(words: string, page: string | null = null): void {
    this.toldPage = page;
    put(this.told, words);
    if (this.toldFor) clearTimeout(this.toldFor);
    this.toldFor = setTimeout(() => put(this.told, ""), 7000);
  }
  /** In the sheet that is up: what the world answered. */
  answer(words: string): void {
    put(this.said, words);
    this.said.scrollIntoView({ block: "nearest" });
  }

  /** As a mortal, or the god in them: the switch, the bar's glow. */
  setChannel(on: boolean): void {
    this.channel.dataset.on = on ? "1" : "0";
    put(this.channel, on ? "🌟 The god in them" : "🧍 As a mortal");
    this.channel.title = on
      ? "The god's will carries their word past their station's bounds; press to be a mortal again"
      : "Everything is bounded by their station; press to channel the god into them";
    this.channel.setAttribute("aria-pressed", on ? "true" : "false");
    this.strip.classList.toggle("channelled", on);
    const hand = this.tray.querySelector<HTMLElement>('.reign-act[data-act="god"]');
    if (hand) hand.hidden = !on;
    this.element.classList.toggle("godhand", on);
  }

  /** The god's hand through them: whom it is aimed at, and what it can do to them. */
  god(d: ReignGod): void {
    const body: HTMLElement[] = [el("p", "life-winwords reign-godwords", d.words)];
    const palette = el("button", "life-choice reign-palette", "✋ The god's palette and brushes");
    palette.onclick = () => this.onPalette();
    body.push(palette);
    const aims = el("div", "reign-aims");
    for (const t of d.targets) {
      const b = el(
        "button",
        `life-choice reign-aim${t.ref === d.target ? " on" : ""}`,
        `${t.own ? "👑 Your realm" : t.short}${t.atWar ? " ⚔️" : ""}`,
      );
      b.dataset.ref = t.ref;
      b.setAttribute("aria-pressed", t.ref === d.target ? "true" : "false");
      b.style.borderLeft = `6px solid rgb(${t.color.map((x) => Math.round(x * 255)).join(",")})`;
      b.onclick = () => this.onGodAim(t.ref);
      aims.append(b);
    }
    body.push(aims);
    for (const g of d.groups) {
      const box = el("div", "reign-law reign-godgroup");
      box.append(el("div", "reign-lawtitle", g.title));
      for (const o of g.offers) {
        const b = el("button", `life-choice reign-god${o.can ? "" : " refused"}`, o.label);
        b.dataset.what = String(o.args.what);
        if (o.args.arms) b.dataset.arms = String(o.args.arms);
        if (o.args.men) b.dataset.men = String(o.args.men);
        b.dataset.can = o.can ? "1" : "0";
        b.onclick = () => (o.can ? this.onGod(o.args, o.label) : this.answer(o.words));
        box.append(b, el("div", "reign-optwords", o.words));
      }
      body.push(box);
    }
    this.open_("🌟 The god's hand", ...body);
  }

  set(l: ReignNow, t: number, pace: "stop" | "slow" | "quick"): void {
    this.last = l;
    const role = l.role;
    this.element.classList.toggle("as-role", !!role);
    put(this.who, role ? `${ROLE_ICON[role.kind]} ${role.name}` : `👑 ${l.ruler}`);
    put(
      this.what,
      role
        ? role.gone
          ? "no longer at court"
          : `${role.title}, ${role.age}`
        : l.fell
          ? "no longer rules"
          : `${l.title}, ${l.age}`,
    );
    for (const b of this.tray.querySelectorAll<HTMLElement>(".reign-act")) {
      const act = b.dataset.act ?? "",
        hide =
          act === "god"
            ? this.channel.dataset.on !== "1"
            : role
              ? act === "matches" || act === "envoys"
              : act === "factions";
      if (b.hidden !== hide && act !== "bonds") b.hidden = hide;
      if (act === "decrees") put(b.querySelector(".life-label")!, role ? "Propose" : "Decrees");
    }
    put(this.time, dated(t));
    for (const [b, p] of [
      [this.stop, "stop"],
      [this.slow, "slow"],
      [this.quick, "quick"],
    ] as const)
      b.classList.toggle("on", p === pace);
    put(this.people, `👥 ${many(l.people)} · ${l.lands} land${l.lands === 1 ? "" : "s"}`);
    put(this.wealth, `💰 ${worth(l.head)} a head · ${l.rank} of ${l.of}`);
    put(this.host, `🛡️ ${many(l.host)} in the host`);
    put(
      this.order,
      `⚖️ ${Math.round(l.legitimacy * 100)}% rightful · ${Math.round(l.unrest * 100)}% sore`,
    );
    this.order.classList.toggle("low", l.legitimacy < 0.3);
    put(
      this.warsChip,
      l.wars.length
        ? `⚔️ ${l.wars.length} war${l.wars.length === 1 ? "" : "s"}: ${l.wars[0]!.foeName}`
        : "🕊️ At peace",
    );
    this.warsChip.classList.toggle("low", l.wars.length > 0);
    this.drawBound(l);
    put(this.heir, role ? `👪 Rules: ${l.ruler}` : `👪 ${l.heir}`);
    this.drawBars(l);
    if (role) this.drawGone(l);
    else this.drawFall(l.fell);
  }

  /** One of a court gone from it: how, and whom to go on as. */
  private drawGone(l: ReignNow): void {
    const g = l.role?.gone ?? null,
      key = g ? `gone|${g.how}|${l.role!.name}` : "";
    if (key === this.fallKey) return;
    this.fallKey = key;
    this.win.hidden = !g;
    if (!g) return;
    this.sheet.hidden = true;
    const acts = el("div", "life-choices");
    if (l.role && !/fell/.test(g.how)) {
      const b = el(
        "button",
        "life-choice reign-heir",
        g.seated ? `👑 Rule as ${l.role.name}` : `👑 Rule as ${l.ruler}, who holds the seat`,
      );
      b.onclick = () => this.onRuleAfter(g.seated);
      acts.append(b);
    }
    const go = el("button", "life-choice reign-end", "✋ Let go");
    go.onclick = () => this.onLetGo();
    acts.append(go);
    if (g.event) {
      const event = g.event,
        why = el("button", "life-choice", "📄 How it happened");
      why.onclick = () => this.onPage(event);
      acts.append(why);
    }
    this.win.replaceChildren(
      el("div", "life-wintitle", g.seated ? `👑 ${l.role!.name} holds the seat` : `🕯️ ${g.words}`),
      el("p", "life-winwords", g.words),
      acts,
    );
  }

  /** The tray's own word for what binds the realm: who has knelt, who kneels, what is paid. */
  private drawBound(l: ReignNow): void {
    const sworn = l.bonds.filter((b) => b.kind === "vassal").length,
      oath = l.bonds.some((b) => b.kind === "oath"),
      paying = l.bonds.some((b) => b.kind === "pays"),
      paid = l.bonds.some((b) => b.kind === "paid"),
      shown = oath
        ? "⛓️ Sworn"
        : sworn
          ? `🤝 ${sworn} sworn`
          : paying
            ? "🌾 You pay"
            : paid
              ? "🌾 Paid"
              : "";
    this.bound.hidden = !shown;
    const key = shown;
    if (this.bound.dataset.key === key) return;
    this.bound.dataset.key = key;
    const [icon, ...rest] = shown.split(" ");
    this.bound.replaceChildren(
      el("span", "life-icon", icon ?? ""),
      el("span", "life-label", rest.join(" ")),
    );
  }

  private drawBars(l: ReignNow): void {
    const rows = [
        { short: "You", head: l.head, me: true },
        ...l.neighbours.map((n) => ({ short: n.short, head: n.head, me: false })),
      ],
      top = Math.max(1e-6, ...rows.map((r) => r.head));
    this.bars.hidden = rows.length < 2;
    const key = rows.map((r) => `${r.short}:${worth(r.head)}`).join("|");
    if (this.bars.dataset.key === key) return;
    this.bars.dataset.key = key;
    this.bars.replaceChildren(
      ...rows.map((r) => {
        const row = el("span", `reign-bar${r.me ? " me" : ""}`),
          fill = el("span", "reign-fill");
        fill.style.width = `${Math.max(3, Math.round((r.head / top) * 100))}%`;
        row.append(
          el("span", "reign-barname", r.short),
          el("span", "reign-bartrack", ""),
          el("span", "reign-barworth", worth(r.head)),
        );
        row.children[1]!.append(fill);
        return row;
      }),
    );
  }

  private open_(title: string, ...body: HTMLElement[]): void {
    const close = el("button", "life-choice reign-close", "Close");
    close.onclick = () => this.closeSheet();
    put(this.said, "");
    this.sheet.replaceChildren(el("div", "life-wintitle", title), ...body, this.said, close);
    this.sheet.hidden = false;
    this.sheet.scrollTop = 0;
  }

  decrees(d: ReignDecrees): void {
    const body: HTMLElement[] = [el("p", "life-winwords", d.words)];
    for (const law of d.laws) {
      const box = el("div", "reign-law");
      box.dataset.law = law.law;
      box.append(
        el("div", "reign-lawtitle", law.title),
        el("div", "reign-lawnow", `Now: ${law.now}`),
      );
      for (const o of law.options) {
        const b = el("button", `life-choice reign-opt${o.can ? "" : " refused"}`, o.label);
        b.dataset.law = law.law;
        b.dataset.to = `${o.to}`;
        b.dataset.can = o.can ? "1" : "0";
        b.onclick = () => this.onDecree(law.law, o.to);
        box.append(b, el("div", "reign-optwords", o.words));
      }
      body.push(box);
    }
    this.open_(this.last?.role ? "📜 Put to the realm" : "📜 Decrees", ...body);
  }

  wars(d: ReignWars): void {
    const body: HTMLElement[] = [el("p", "life-winwords", d.words)];
    // (First, what a peace has bound the realm to: W7.)
    for (const b of d.bonds) {
      const box = el("div", `reign-law reign-bond reign-bond-${b.kind}`),
        name = el("button", "life-choice reign-foename", b.otherName);
      box.dataset.bond = b.kind;
      name.onclick = () => this.onPage(b.other);
      box.append(name, el("div", "reign-optwords", b.words));
      if (b.kind === "oath") {
        const rise = el(
          "button",
          `life-choice reign-rise${b.can ? "" : " refused"}`,
          `⚔️ Rise against ${b.otherName}`,
        );
        rise.dataset.can = b.can ? "1" : "0";
        rise.onclick = () => this.onRise();
        box.append(rise, el("div", "reign-optwords", b.why ?? ""));
      }
      body.push(box);
    }
    for (const w of d.wars) {
      const box = el("div", "reign-law reign-warline");
      box.dataset.war = w.ref;
      const page = el(
          "button",
          "life-choice reign-warpage",
          `⚔️ ${w.foeName}, since year ${w.since}`,
        ),
        last = w.last;
      page.onclick = () => this.onPage(w.ref);
      box.append(
        page,
        el(
          "div",
          "reign-optwords",
          `${w.words}. Fallen: ${many(w.fallen[0])} of yours, ${many(w.fallen[1])} of theirs, in ${w.battles} battle${w.battles === 1 ? "" : "s"}.`,
        ),
      );
      if (last) {
        const b = el("button", "life-choice reign-battle", `⚔️ ${last.words}`);
        b.onclick = () => this.onPage(last.ref);
        box.append(b);
      }
      // What could be offered or demanded: one the other would refuse can still be pressed, and they say why.
      if (!w.offers.length) box.append(el("div", "reign-optwords", w.peace));
      for (const o of w.offers) {
        const b = el("button", `life-choice reign-peace${o.can ? "" : " refused"}`, o.label);
        b.dataset.foe = w.foe;
        b.dataset.offer = o.id;
        b.dataset.can = o.can ? "1" : "0";
        b.onclick = () => this.onPeace(w.foe, o.id);
        box.append(b, el("div", "reign-optwords", o.words));
      }
      body.push(box);
    }
    for (const w of d.lately) {
      const box = el("div", "reign-law reign-lately"),
        page = el("button", "life-choice reign-warpage", `🕊️ ${w.foeName}, since year ${w.since}`),
        last = w.last;
      box.dataset.war = w.ref;
      page.onclick = () => this.onPage(w.ref);
      box.append(
        page,
        el(
          "div",
          "reign-optwords",
          `${w.came} Fallen: ${many(w.fallen[0])} of yours, ${many(w.fallen[1])} of theirs, in ${w.battles} battle${w.battles === 1 ? "" : "s"}.`,
        ),
      );
      if (last) {
        const b = el("button", "life-choice reign-battle", `⚔️ ${last.words}`);
        b.onclick = () => this.onPage(last.ref);
        box.append(b);
      }
      body.push(box);
    }
    for (const f of d.foes) {
      const box = el("div", "reign-law reign-foe");
      box.dataset.foe = f.ref;
      const name = el("button", "life-choice reign-foename", `${f.name}: ${f.regard}`);
      name.onclick = () => this.onPage(f.ref);
      box.append(name, el("div", "reign-optwords", f.words));
      if (f.known) box.append(el("div", "reign-optwords reign-known", f.known));
      for (const aim of f.aims.length ? f.aims : []) {
        const b = el(
          "button",
          `life-choice reign-declare${f.can ? "" : " refused"}`,
          `⚔️ War for ${aim.name}`,
        );
        b.dataset.foe = f.ref;
        b.dataset.can = f.can ? "1" : "0";
        b.onclick = () => this.onWar(f.ref, aim.cell);
        box.append(b);
      }
      body.push(box);
    }
    this.open_("⚔️ War and peace", ...body);
  }

  envoys(d: ReignEnvoys): void {
    const body: HTMLElement[] = [el("p", "life-winwords reign-envoywords", d.words)];
    for (const r of d.realms) {
      const box = el("div", "reign-law reign-envoy");
      box.dataset.to = r.ref;
      box.append(
        el("div", "reign-lawtitle", `${r.name}: ${r.regard}`),
        el("div", "reign-optwords", r.known),
      );
      for (const e of r.errands) {
        const b = el("button", `life-choice reign-send${e.can ? "" : " refused"}`, e.label);
        b.dataset.can = e.can ? "1" : "0";
        b.dataset.errand = e.errand;
        b.onclick = () => {
          if (e.can) this.onEnvoy(r.ref, e.errand, r.name);
          else this.say(e.words);
        };
        box.append(b, el("div", "reign-optwords", e.words));
      }
      body.push(box);
    }
    this.open_("🕊️ An envoy", ...body);
  }

  /** One of a court's own: the groups to court, and a move on the seat. */
  court(d: ReignCourt): void {
    const body: HTMLElement[] = [el("p", "life-winwords reign-courtwords", d.words)];
    for (const g of d.groups) {
      const box = el("div", "reign-law reign-group");
      box.dataset.group = g.group;
      const b = el(
        "button",
        `life-choice reign-back${g.can ? "" : " refused"}${g.behind ? " behind" : ""}`,
        g.behind ? `✅ ${g.group} stand behind you` : g.label,
      );
      b.dataset.group = g.group;
      b.dataset.can = g.can ? "1" : "0";
      b.onclick = () => (g.behind ? this.answer(g.words) : this.onBack(g.group));
      box.append(b, el("div", "reign-optwords", g.words));
      body.push(box);
    }
    const box = el("div", "reign-law reign-move"),
      b = el("button", `life-choice reign-plot${d.plot.can ? "" : " refused"}`, d.plot.label);
    b.dataset.can = d.plot.can ? "1" : "0";
    b.onclick = () => this.onPlot();
    box.append(b, el("div", "reign-optwords", d.plot.words));
    body.push(box);
    this.open_("🤝 Factions and the seat", ...body);
  }

  matches(d: ReignMatches): void {
    const body: HTMLElement[] = [el("p", "life-winwords reign-matchwords", d.words)];
    for (const m of d.matches) {
      const box = el("div", "reign-law reign-match");
      const b = el(
        "button",
        `life-choice reign-wed${m.can ? "" : " refused"}`,
        `💍 ${m.who.name} to ${m.partner.name} of ${m.toName}`,
      );
      b.dataset.can = m.can ? "1" : "0";
      b.dataset.to = m.to;
      b.onclick = () => this.onWed(m);
      box.append(b, el("div", "reign-optwords", m.words));
      body.push(box);
    }
    this.open_("💍 A marriage of state", ...body);
  }

  /** What must be answered: the clock is held until it is. A choice refused says why, and stays. */
  drama(d: ReignDrama): void {
    this.sheet.hidden = true;
    const acts = el("div", "life-choices"),
      said = el("p", "reign-said");
    for (const c of d.choices) {
      const b = el("button", `life-choice reign-drama${c.can ? "" : " refused"}`, c.label);
      b.dataset.choice = c.id.split(":")[0]!;
      b.dataset.can = c.can ? "1" : "0";
      b.onclick = () => {
        if (!c.can) {
          put(said, c.words);
          return;
        }
        this.win.hidden = true;
        this.onDrama(d, c.id);
      };
      acts.append(b, el("div", "reign-optwords", c.words));
    }
    const who = d.who;
    if (who) {
      const page = el("button", "life-choice reign-dramapage", "📄 Who they are");
      page.onclick = () => this.onPage(who);
      acts.append(page);
    }
    const why = el("button", "life-choice reign-dramawhy", "📄 Why");
    why.onclick = () => this.onPage(d.event);
    acts.append(why);
    this.win.replaceChildren(
      el(
        "div",
        "life-wintitle",
        `${d.kind === "fire" ? "☢️" : d.kind === "plot" ? "🗡️" : "🪦"} ${d.title}`,
      ),
      el("p", "life-winwords", d.words),
      said,
      acts,
    );
    this.win.hidden = false;
    this.win.scrollTop = 0;
  }

  private drawFall(f: ReignFall | null): void {
    const key = f ? `${f.how}|${f.title}` : "";
    if (key === this.fallKey) return;
    this.fallKey = key;
    this.win.hidden = !f;
    if (!f) return;
    this.sheet.hidden = true;
    const acts = el("div", "life-choices"),
      heir = f.heir;
    if (heir) {
      const b = el(
        "button",
        "life-choice reign-heir",
        `👑 Rule on as ${heir.name}, ${heir.age}, ${heir.tie}`,
      );
      b.onclick = () => this.onHeir();
      acts.append(b);
    }
    const go = el("button", "life-choice reign-end", "✋ Let go");
    go.onclick = () => this.onLetGo();
    acts.append(go);
    if (f.event) {
      const why = el("button", "life-choice", "📄 How it happened");
      const event = f.event;
      why.onclick = () => this.onPage(event);
      acts.append(why);
    }
    this.win.replaceChildren(
      el(
        "div",
        "life-wintitle",
        `${f.how === "died" ? "🪦" : f.how === "realm" ? "🏚️" : "⚔️"} ${f.title}`,
      ),
      el("p", "life-winwords", f.words),
      acts,
    );
  }
}
