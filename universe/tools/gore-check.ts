// node tools/gore-check.ts [--shots dir]: the actual battle renderer, a heavy blade fixture,
// at the phone's size in WebKit and Chromium. Check severed geometry, fragments and settings.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium, webkit } from "playwright";
declare const goreFixture: { set(mode: string): void };

const shotsAt = process.argv.includes("--shots")
  ? process.argv[process.argv.indexOf("--shots") + 1]
  : undefined;
if (shotsAt) mkdirSync(shotsAt, { recursive: true });
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
html,body{margin:0;overflow:hidden;background:#8fb7dd}canvas{width:100%;height:100%;display:block}#status{position:fixed;top:8px;left:8px;background:#151c32dd;color:white;padding:10px;border-radius:8px;font:14px system-ui}
</style></head><body><canvas id="world"></canvas><div id="status"></div><script type="module">
import {Stage,OrbitRig,BattleLayer,QUALITIES} from '/src/render/index.ts';
import {newBattle,newBlows,battleAt,blowsAt,figureOf} from '/src/view/index.ts';
const side=ref=>({ref,name:ref,color:ref==='realm:a'?[.65,.1,.1]:[.12,.25,.7],arms:null,fielded:360,fallen:200,wounded:100,maimed:20,host:{arm:'axe',guard:'mail',mount:''},kit:'axes'});
const field=newBattle({event:'ev:gore-test',war:'war:1',title:'The field',cell:1,land:'The field',year:100,attacker:side('realm:a'),defender:side('realm:b'),won:true,outcome:'field',civil:null,hills:false,river:false,walls:0,town:null,figure:null,plan:{seed:'gore test',ages:[{index:0,from:0,to:0,kind:'quiet',seaLevel:0,warmth:0,forests:true}],lineages:[]}},360);
const blows=newBlows(field),hit=blows.hits.find(h=>h.lost&&h.at>75&&h.at<95)??blows.hits[blows.loose[0].hit],s=hit.at+.2;
const stage=new Stage(document.querySelector('canvas'),{name:'phone',maxPixelRatio:1.5,antialias:false,crowdCap:80},[.55,.72,.86]);
stage.setQuality(QUALITIES.balanced);stage.backdrop('ground',50);
const layer=new BattleLayer(stage,stage.root);layer.setup(field,figureOf(null,2),null,[.28,.4,.15]);
const rig=new OrbitRig(stage,document.querySelector('canvas'),{distance:3.4,minDistance:.8,maxDistance:30,pitch:-55,drift:0,onTap:()=>{}});rig.target.set(hit.x*.1,.2,hit.z*.1);
let now;const set=mode=>{now=blowsAt(field,blows,battleAt(field,s),mode);};set('full');
stage.onUpdate(()=>{layer.update(now);document.querySelector('#status').textContent='Gore: '+modeName+' · '+now.limbs.length+' severed parts · '+(now.gibs?.length??0)+' fragments';});
let modeName='full';globalThis.goreFixture={set(mode){modeName=mode;set(mode);},read(){return {limbs:now.limbs.length,gibs:now.gibs?.length??0,blood:now.blood.length,wounds:now.wounds.length,marks:layer.marks()};}};
</script></body></html>`;
const server = await createServer({
  root: fileURLToPath(new URL("..", import.meta.url)),
  logLevel: "error",
  server: { port: 4189, strictPort: false },
  plugins: [
    {
      name: "gore-fixture",
      configureServer(s) {
        s.middlewares.use((req, res, next) => {
          if (req.url !== "/__gore") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(html);
        });
      },
    },
  ],
});
await server.listen();
const base = server.resolvedUrls!.local[0]!;
try {
  for (const engine of [webkit, chromium]) {
    const browser = await engine.launch(
      engine === chromium && process.platform === "linux"
        ? { args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] }
        : {},
    );
    try {
      const page = await browser.newPage({
        viewport: { width: 430, height: 932 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base + "__gore");
      await page.waitForFunction("globalThis.goreFixture?.read().marks.ends>0", undefined, {
        timeout: 60000,
      });
      const full = (await page.evaluate("goreFixture.read()")) as { limbs: number; gibs: number };
      assert.ok(full.limbs > 0 && full.gibs > 0);
      if (shotsAt) await page.screenshot({ path: join(shotsAt, `gore-full-${engine.name()}.png`) });
      for (const mode of ["less", "none"]) {
        await page.evaluate((mode) => goreFixture.set(mode), mode);
        await page.waitForFunction(
          "goreFixture.read().marks.ends===0 && goreFixture.read().marks.drops===0",
        );
        const visible = (await page.evaluate("goreFixture.read()")) as {
          limbs: number;
          gibs: number;
          blood: number;
          wounds: number;
        };
        assert.equal(visible.limbs, 0);
        assert.equal(visible.gibs, 0);
        if (mode === "none") {
          assert.equal(visible.blood, 0);
          assert.equal(visible.wounds, 0);
        }
        if (shotsAt)
          await page.screenshot({ path: join(shotsAt, `gore-${mode}-${engine.name()}.png`) });
      }
      assert.deepEqual(errors, []);
      console.log(
        `${engine.name()}: severing and fragment batches obey their limits and the Less/None controls`,
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.close();
}
