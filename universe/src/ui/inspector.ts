// The inspector (Phase 10 M92, docs/architecture §31): one window for every thing's page —
// Y2K chrome over a grand strategy game's window.
//
// Its title bar carries the thing's icon and name, back and forward through everything
// looked at, and the fold and close boxes. Under it come "go to it" and follow, the
// thing's headline numbers (a tap shows what makes each one and why), its tabs, and the
// blocks of the open tab. Every name in them is a link to its own page. On a phone it is a
// sheet at the foot of the screen, which grows tall at a tap; on a desk it is a window at
// the side.
//
// It follows the world as it runs without rebuilding under the pointer: the tab, the
// scroll, the whys and breakdowns opened stay as they were.
import type {
  Block,
  HostClient,
  Item,
  Line,
  PageModel,
  Place,
  Row,
  Stat,
} from "../bridge/index.ts";
import { el, WhyTree } from "./why.ts";
import { folder } from "./window.ts";
import { barsChart, lineChart, linesChart, timelineChart } from "./chart.ts";
import type { Tidings } from "./tidings.ts";
import { drawTool } from "./tools.ts";
import { drawAnatomy, drawPortrait, moves } from "./portrait.ts";

/** How often an open page is read again while the world runs (ms). */
const REFRESH_MS = 2000;
/** The rows a table shows before "show all". */
const TABLE_ROWS = 60;
/** How many pages back the history reaches. */
const HISTORY = 64;
/** What following a thing is said as, by its kind. */
const FOLLOW_WORDS: Readonly<Record<string, string>> = {
  land: "this land",
  colony: "these halls",
  town: "this town",
  realm: "this realm",
  person: "this life",
};

/** A number in words for a chart's unit. */
function unitFormat(unit: string | undefined): (y: number) => string {
  switch (unit) {
    case "share":
      return (y) => `${Math.round(y * 100)}%`;
    case "price":
      return (y) => y.toFixed(2);
    default:
      return (y) => Math.round(y).toLocaleString("en-US");
  }
}

export class PageWindow {
  /** The panel it stands in (so the scales' framing and label culling see it as theirs do). */
  readonly element: HTMLElement;
  readonly inspector: HTMLElement;
  private readonly client: HostClient;
  private readonly why: WhyTree;
  private readonly icon = el("span", "page-icon");
  private readonly name = el("span", "page-title");
  private readonly heading: HTMLElement;
  private readonly backButton = el("button", "nav-back", "◀");
  private readonly forwardButton = el("button", "nav-forward", "▶");
  private readonly tallButton = el("button", "tall", "⤢");
  private readonly portrait = el("canvas", "portrait");
  private readonly sub = el("div", "page-sub");
  private readonly crumbs = el("nav", "page-crumbs");
  private readonly live = el("div", "page-live");
  private readonly actions = el("div", "page-actions");
  private readonly stats = el("div", "stats");
  private readonly statDetail = el("div", "stat-detail");
  private readonly tabs = el("nav", "tabs");
  private readonly body = el("div", "page-body page");
  private history: string[] = [];
  private at = -1;
  private page: PageModel | null = null;
  private tab = "";
  private token = 0;
  private seen = "";
  private opened = new Set<string>();
  private openStat: string | null = null;
  /** The blocks drawn, by their tab and place, with what each said (to keep what is unchanged). */
  private blocks = new Map<string, { same: string; element: HTMLElement }>();
  /** Each table's sorting and whether it shows every row, kept as the page is read again. */
  private sorts = new Map<string, { by: number; down: boolean; all: boolean }>();
  private readAt = 0;
  private pressing = false;
  tidings: Tidings | null = null;
  /** Go to where a thing is to be seen. */
  onGoTo: (place: Place, ref: string) => void = () => {};
  /** Told as each page opens (the scales mark what it is). */
  onOpen: (page: PageModel) => void = () => {};
  onClose: () => void = () => {};
  /** Told when the viewer asks why (a fact's why, a number's parts). */
  onAsked: () => void = () => {};
  /**
   * The scene's own actions for a page (M94): keep a person in view, while they are in the
   * scene shown. Each its words, whether it is on, and what it does.
   */
  sceneActions: (
    page: PageModel,
  ) => { label: string; title: string; on: boolean; run: () => void }[] = () => [];

  constructor(parent: HTMLElement, client: HostClient) {
    this.client = client;
    this.why = new WhyTree(client);
    this.why.onOpen = (ref) => void this.open(ref);
    this.element = el("div", "panel page-panel");
    this.element.hidden = true;
    this.inspector = el("section", "inspector page-window");
    this.inspector.hidden = true;
    this.live.hidden = true;
    this.heading = el("h2");
    this.heading.append(this.icon, this.name);
    const close = el("button", "close", "×");
    close.setAttribute("aria-label", "Close");
    close.onclick = () => this.close();
    this.backButton.title = "Back";
    this.backButton.onclick = () => void this.step(-1);
    this.forwardButton.title = "Forward";
    this.forwardButton.onclick = () => void this.step(1);
    this.tallButton.title = "Taller";
    this.tallButton.onclick = () => this.inspector.classList.toggle("tall");
    // Under the title: its picture beside its words, its doings, its numbers.
    const head = el("div", "page-head"),
      words = el("div", "page-head-words");
    words.append(this.crumbs, this.sub, this.live, this.actions, this.stats);
    head.append(this.portrait, words);
    this.portrait.hidden = true;
    // The title bar: back and forward, the thing's icon and name, and the window's boxes.
    const boxes = el("span", "page-boxes");
    boxes.append(this.tallButton, folder(this.inspector, this.name), close);
    this.heading.replaceChildren(this.backButton, this.forwardButton, this.icon, this.name, boxes);
    this.inspector.append(this.heading, head, this.statDetail, this.tabs, this.body);
    this.element.append(this.inspector);
    parent.append(this.element);
    // (Not rebuilt while a finger or the pointer is down on it.)
    this.inspector.addEventListener("pointerdown", () => (this.pressing = true));
    addEventListener("pointerup", () => (this.pressing = false));
    addEventListener("pointercancel", () => (this.pressing = false));
    setInterval(() => void this.follow(), REFRESH_MS);
  }

  get visible(): boolean {
    return !this.inspector.hidden;
  }

  /** What the thing is doing now, as the scale shows it (a person at work), or nothing. */
  setLive(text: string | null): void {
    if ((this.live.textContent || null) === text) return;
    this.live.textContent = text ?? "";
    this.live.hidden = !text;
  }

  /** The ref of the page open, if one is. */
  get current(): string | null {
    return this.visible ? (this.history[this.at] ?? null) : null;
  }

  /** Open a thing's page (`ref#tab` opens a tab), after what is open now. */
  async open(ref: string): Promise<void> {
    if (this.history[this.at] !== ref) {
      this.history = this.history.slice(0, this.at + 1);
      this.history.push(ref);
      if (this.history.length > HISTORY) this.history.shift();
      this.at = this.history.length - 1;
    }
    await this.show(ref, true);
  }

  /** Back (-1) or forward (+1) through what has been looked at. */
  private async step(way: -1 | 1): Promise<void> {
    const next = this.at + way;
    if (next < 0 || next >= this.history.length) return;
    this.at = next;
    await this.show(this.history[next]!, true);
  }

  close(): void {
    this.setLive(null);
    this.inspector.hidden = true;
    // (Its panel goes too: "the panel open" then means the scale's own.)
    this.element.hidden = true;
    this.token++;
    this.page = null;
    this.onClose();
  }

  /** Read a page and draw it (afresh: its first tab; or kept as it was). */
  private async show(ref: string, fresh: boolean): Promise<void> {
    const token = ++this.token;
    this.inspector.hidden = false;
    this.element.hidden = false;
    if (fresh) {
      this.setLive(null);
      this.name.textContent = "…";
      this.body.replaceChildren(el("p", "muted", "…"));
    }
    const page = await this.client.query<PageModel>({ type: "page", args: { ref } });
    if (token !== this.token) return;
    this.readAt = performance.now();
    this.draw(page, fresh);
    if (fresh) this.onOpen(page);
  }

  /** Read the open page again as the world runs; redraw only if it says something new. */
  private async follow(): Promise<void> {
    const ref = this.current;
    if (!ref || this.pressing || document.visibilityState !== "visible") return;
    // (A page of the whole world is read again less often: it reads everything.)
    if (performance.now() - this.readAt < (this.page?.every ?? REFRESH_MS) - 100) return;
    const token = this.token,
      page = await this.client.query<PageModel>({ type: "page", args: { ref } });
    this.readAt = performance.now();
    if (token !== this.token || this.pressing || this.current !== ref) return;
    if (JSON.stringify({ ...page, year: 0 }) === this.seen) return;
    this.draw(page, false);
  }

  private draw(page: PageModel, fresh: boolean): void {
    const scroll = this.inspector.scrollTop;
    this.page = page;
    this.seen = JSON.stringify({ ...page, year: 0 });
    if (fresh) {
      this.tab = page.tab ?? page.tabs[0]?.id ?? "";
      this.opened = new Set();
      this.openStat = null;
      this.blocks = new Map();
      this.sorts = new Map();
    }
    // (The world's own pages — its chronicle, its ledger — open wide, as a ledger does.)
    this.inspector.classList.toggle("wide", page.kind === "chronicle" || page.kind === "ledger");
    if (!page.tabs.some((t) => t.id === this.tab)) this.tab = page.tabs[0]?.id ?? "";
    this.icon.textContent = page.icon;
    this.name.textContent = page.title;
    this.heading.style.borderLeft = page.color
      ? `6px solid rgb(${page.color.map((c) => Math.round(c * 255)).join(",")})`
      : "";
    this.backButton.disabled = this.at <= 0;
    this.forwardButton.disabled = this.at >= this.history.length - 1;
    this.sub.replaceChildren(this.line(page.subtitle));
    this.crumbs.replaceChildren(this.line(page.crumbs ?? []));
    this.crumbs.hidden = !page.crumbs?.length;
    this.drawPortrait(page);
    this.drawActions(page);
    this.drawStats(page);
    this.drawTabs(page);
    this.drawBody(page);
    if (!fresh) this.inspector.scrollTop = scroll;
    else this.inspector.scrollTop = 0;
  }

  /** The page's picture, kept moving (turning, waving, glowing) while it is open. */
  private drawPortrait(page: PageModel): void {
    const p = page.portrait;
    this.portrait.hidden = !p;
    if (!p) return;
    const size = innerWidth > 640 ? 96 : 84,
      started = performance.now(),
      // (A world's face is drawn pixel by pixel: it turns at a few frames a second.)
      every = p.kind === "world" ? 250 : 50;
    let last = -Infinity;
    const frame = (now: number) => {
      if (this.page !== page || !this.visible) return;
      if (now - last >= every) {
        last = now;
        drawPortrait(this.portrait, p, size, size, (now - started) / 1000);
      }
      if (moves(p)) requestAnimationFrame(frame);
    };
    drawPortrait(this.portrait, p, size, size, 0);
    last = performance.now();
    if (moves(p)) requestAnimationFrame(frame);
  }

  private drawActions(page: PageModel): void {
    const parts: HTMLElement[] = [];
    if (page.place) {
      const go = el("button", "go-to", "⌖ Go to");
      go.title = "Go to where it is to be seen";
      go.onclick = () => this.onGoTo(page.place!, page.ref);
      parts.push(go);
    }
    if (page.followable && this.tidings)
      parts.push(this.tidings.follow(page.ref, FOLLOW_WORDS[page.kind] ?? "this"));
    for (const a of this.sceneActions(page)) {
      const b = el("button", a.on ? "scene-act on" : "scene-act", a.label);
      b.title = a.title;
      b.setAttribute("aria-pressed", String(a.on));
      b.onclick = () => {
        a.run();
        this.drawActions(page);
      };
      parts.push(b);
    }
    this.actions.replaceChildren(...parts);
  }

  /** Draw the open page's actions again (the scene's changed: a person followed, or let go). */
  redrawActions(): void {
    if (this.page) this.drawActions(this.page);
  }

  private drawStats(page: PageModel): void {
    const chips = page.stats.map((s) => {
      const chip = el("button", "stat"),
        label = el("span", "stat-label", s.label);
      if (s.concept) label.append(this.conceptLink(s.concept, s.label));
      chip.append(label, this.line(s.value, "stat-value"));
      const more = !!s.parts?.length || !!s.why;
      if (more) chip.classList.add("more");
      chip.onclick = (e) => {
        // (A name in the chip opens its page; the chip itself opens what makes it.)
        if ((e.target as HTMLElement).closest(".ref-link")) return;
        if (!more) return;
        this.openStat = this.openStat === s.label ? null : s.label;
        if (this.openStat) this.onAsked();
        this.drawStatDetail(page);
      };
      chip.classList.toggle("on", this.openStat === s.label);
      return chip;
    });
    this.stats.replaceChildren(...chips);
    this.stats.hidden = !chips.length;
    this.drawStatDetail(page);
  }

  /** What a headline number is made of, and why it is so. */
  private drawStatDetail(page: PageModel): void {
    const s = page.stats.find((x) => x.label === this.openStat);
    for (const c of this.stats.children)
      c.classList.toggle("on", c.querySelector(".stat-label")?.textContent === this.openStat);
    if (!s) {
      this.statDetail.replaceChildren();
      this.statDetail.hidden = true;
      return;
    }
    this.statDetail.hidden = false;
    this.statDetail.replaceChildren(...this.statParts(s));
  }

  private statParts(s: Stat): HTMLElement[] {
    const out: HTMLElement[] = [el("h3", undefined, s.label)];
    if (s.parts?.length) {
      const list = el("div", "parts");
      for (const p of s.parts) {
        const row = el("div", "part");
        row.append(this.line(p.label, "part-label"), el("span", "part-value", p.value));
        list.append(row);
      }
      out.push(list);
    }
    if (s.why) {
      const box = el("div", "why");
      void this.why.show(s.why, box);
      out.push(box);
    }
    return out;
  }

  private drawTabs(page: PageModel): void {
    this.tabs.replaceChildren(
      ...page.tabs.map((t) => {
        const b = el("button", t.id === this.tab ? "tab on" : "tab", t.name);
        b.onclick = () => {
          if (this.tab === t.id) return;
          this.tab = t.id;
          this.drawTabs(page);
          this.drawBody(page);
          this.inspector.scrollTop = 0;
        };
        return b;
      }),
    );
    this.tabs.hidden = page.tabs.length < 2;
  }

  /**
   * The open tab's blocks. Read again as the world runs, a block that says the same is kept
   * as it stands — a tool half asked, a why opened, a chart — and only what changed is
   * drawn anew; a tool or a why for the same thing is always kept.
   */
  private drawBody(page: PageModel): void {
    const tab = page.tabs.find((t) => t.id === this.tab) ?? page.tabs[0],
      kept = new Map<string, { same: string; element: HTMLElement }>();
    this.body.replaceChildren(
      ...(tab?.blocks ?? []).map((b, i) => {
        const key = `${this.tab}:${i}`,
          same =
            b.type === "tool"
              ? `tool ${b.tool} ${JSON.stringify(b.args)}`
              : b.type === "why"
                ? `why ${b.ref}`
                : JSON.stringify(b),
          was = this.blocks.get(key),
          element = was && was.same === same ? was.element : this.block(b, key);
        kept.set(key, { same, element });
        return element;
      }),
    );
    this.blocks = kept;
  }

  /** A line of words and names: each name a link to its page. */
  private line(line: Line, cls?: string): HTMLElement {
    const box = el("span", cls);
    for (const s of line) {
      if (typeof s === "string") box.append(s);
      else box.append(this.link(s.text, s.ref));
    }
    return box;
  }

  /** An ⓘ opening the concept a number is a measure of (M97). */
  private conceptLink(concept: string, label: string): HTMLElement {
    const a = el("a", "concept-link", "ⓘ");
    a.href = `#concept:${concept}`;
    a.title = `What is ${label.toLowerCase()}?`;
    a.setAttribute("aria-label", `What is ${label.toLowerCase()}?`);
    a.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      void this.open(`concept:${concept}`);
    };
    return a;
  }

  /** A name that opens its page: a link in the line's words, wrapping with them. */
  private link(text: string, ref: string): HTMLElement {
    const a = el("a", "ref-link", text);
    a.href = `#${ref}`;
    a.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      void this.open(ref);
    };
    return a;
  }

  private block(b: Block, key: string): HTMLElement {
    const box = el("div", `block block-${b.type}`);
    const title = "title" in b && b.title ? el("h3", undefined, b.title) : null;
    if (title) box.append(title);
    switch (b.type) {
      case "text":
        for (const l of b.lines) box.append(el("p").appendChild(this.line(l)).parentElement!);
        break;
      case "facts": {
        const facts = el("div", "facts");
        b.rows.forEach((r, i) => facts.append(this.fact(r, `${key}:${i}`)));
        box.append(facts);
        break;
      }
      case "list":
        box.append(...b.items.map((item) => this.item(item)));
        if (b.more) box.append(el("p", "muted more", `and ${b.more.toLocaleString("en-US")} more`));
        break;
      case "table":
        box.append(this.table(b.columns, b.rows, key));
        break;
      case "lines":
        // (Lines of far different sizes: each its own small chart, side by side.)
        if (b.apart) {
          const grid = el("div", "charts-apart");
          for (const s of b.series)
            grid.append(
              lineChart(s.points, {
                label: s.name,
                format: unitFormat(b.unit),
                zero: b.unit === "people" || b.unit === "count",
                color: s.color,
              }),
            );
          box.append(grid);
          break;
        }
        box.append(
          linesChart(b.series, {
            label: b.title,
            format: unitFormat(b.unit),
            zero: b.unit === "people" || b.unit === "count",
            key: (s) => {
              const ref = b.series.find((x) => x.name === s.name)?.ref;
              return ref ? this.link(s.name, ref) : el("span", "key-name", s.name);
            },
          }),
        );
        if (title) title.remove();
        break;
      case "bars":
        box.append(
          barsChart(
            b.bars.map((x) => ({
              label: this.line(x.label),
              value: x.value,
              ...(x.color ? { color: x.color } : {}),
              ...(x.ref ? { open: () => void this.open(x.ref!) } : {}),
            })),
            unitFormat(b.unit),
          ),
        );
        break;
      case "timeline":
        box.append(
          timelineChart(
            b.rows.map((r) => ({
              label: this.line(r.label),
              from: r.from,
              to: r.to,
              ...(r.color ? { color: r.color } : {}),
              ...(r.words ? { words: r.words } : {}),
              ...(r.ref ? { open: () => void this.open(r.ref!) } : {}),
            })),
            b.from,
            b.to,
          ),
        );
        break;
      case "chart":
        box.append(
          lineChart(b.points, {
            label: b.title,
            format: unitFormat(b.unit),
            zero: b.unit === "people" || b.unit === "count",
          }),
        );
        if (title) title.remove();
        break;
      case "why": {
        const w = el("div", "why");
        void this.why.show(b.ref, w);
        box.append(w);
        break;
      }
      case "anatomy": {
        const canvas = el("canvas", "anatomy"),
          p = this.page?.portrait;
        box.append(canvas);
        if (p)
          // (Drawn once it has its width.)
          requestAnimationFrame(() =>
            drawAnatomy(canvas, p, Math.max(260, box.clientWidth || 320), 230),
          );
        break;
      }
      case "tool":
        drawTool(box, b.tool, b.args, {
          client: this.client,
          refresh: () => {
            // (The tool acted: it is drawn anew with what now stands, not kept as it was.)
            const ref = this.current;
            this.blocks.delete(key);
            if (ref) void this.show(ref, false);
          },
          open: (ref) => void this.open(ref),
        });
        break;
    }
    return box;
  }

  /** A fact: its label, its value (names linked), and — asked — its why and its parts. */
  private fact(r: Stat, key: string): HTMLElement {
    const row = el("div", "fact"),
      label = el("span", "fact-label", r.label);
    // (What it is a measure of: its page in the book of concepts.)
    if (r.concept) label.append(this.conceptLink(r.concept, r.label));
    row.append(label, this.line(r.value, "fact-value"));
    if (r.why || r.parts?.length) {
      const ask = el("button", "ask", "?"),
        more = el("div", "fact-more");
      ask.title = "Why is it so?";
      ask.setAttribute("aria-label", `Why: ${r.label}`);
      const set = (on: boolean) => {
        more.hidden = !on;
        ask.classList.toggle("on", on);
        if (on) {
          more.replaceChildren(...this.statParts(r).slice(1));
          this.opened.add(key);
        } else this.opened.delete(key);
      };
      ask.onclick = () => {
        const on = !ask.classList.contains("on");
        set(on);
        if (on) this.onAsked();
      };
      row.append(ask);
      const wrap = el("div", "fact-wrap");
      wrap.append(row, more);
      set(this.opened.has(key));
      return wrap;
    }
    return row;
  }

  private item(item: Item): HTMLElement {
    const row = el("div", item.ref ? "line entry" : "entry");
    row.append(this.line(item.line));
    if (item.ref) {
      const ref = item.ref;
      row.onclick = () => void this.open(ref);
    }
    return row;
  }

  /**
   * A table whose columns sort at a tap (a second tap the other way), its first rows shown
   * and the rest at "show all" — both kept as the page is read again.
   */
  private table(columns: readonly string[], rows: readonly Row[], key: string): HTMLElement {
    const box = el("div", "table-wrap"),
      table = el("table", "table"),
      head = el("tr"),
      body = el("tbody"),
      state = this.sorts.get(key) ?? { by: -1, down: true, all: false },
      more = el("button", "show-all");
    this.sorts.set(key, state);
    let { by, down } = state;
    const fill = () => {
      const order = [...rows];
      if (by >= 0)
        order.sort((a, b) => {
          const x = a.keys?.[by],
            y = b.keys?.[by];
          if (x === undefined || y === undefined) return 0;
          const c =
            typeof x === "number" && typeof y === "number"
              ? x - y
              : String(x) < String(y)
                ? -1
                : String(x) > String(y)
                  ? 1
                  : 0;
          return down ? -c : c;
        });
      const shown = state.all ? order : order.slice(0, TABLE_ROWS);
      more.hidden = shown.length === order.length;
      more.textContent = `Show all ${order.length.toLocaleString("en-US")}`;
      body.replaceChildren(
        ...shown.map((r) => {
          const tr = el("tr", r.ref ? "row entry" : "row");
          for (const c of r.cells) {
            const td = el("td");
            td.append(this.line(c));
            tr.append(td);
          }
          if (r.ref) {
            const ref = r.ref;
            tr.onclick = () => void this.open(ref);
          }
          return tr;
        }),
      );
    };
    columns.forEach((c, i) => {
      const th = el("th"),
        b = el("button", "sort", c);
      b.onclick = () => {
        if (by === i) down = !down;
        else {
          by = i;
          down = true;
        }
        state.by = by;
        state.down = down;
        for (const x of head.querySelectorAll(".sort")) x.classList.remove("on", "up");
        b.classList.add("on");
        b.classList.toggle("up", !down);
        fill();
      };
      if (by === i) b.classList.add("on");
      if (by === i && !down) b.classList.add("up");
      th.append(b);
      head.append(th);
    });
    const thead = el("thead");
    thead.append(head);
    table.append(thead, body);
    more.onclick = () => {
      state.all = true;
      fill();
    };
    fill();
    box.append(table, more);
    return box;
  }
}
