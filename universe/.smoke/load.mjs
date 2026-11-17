import { chromium } from "playwright";
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 430, height: 932 } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
await p.goto("http://127.0.0.1:5199/?seed=first%20light&year=5&hold");
try { await p.waitForFunction(() => typeof causalis !== "undefined" && (causalis.drawn?.() ?? 0) > 0, undefined, { timeout: 240000 }); console.log("drawn ok"); } catch (e) { console.log("not drawn:", e.message.slice(0, 100)); }
const t = await p.evaluate(() => causalis?.client?.status?.t ?? null).catch(() => null); console.log("t", t);
console.log("errors", errs.length, errs.slice(0, 8).join("\n")); await b.close();
