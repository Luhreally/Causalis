// ═══════════════════════════════════════════════════════════════════════════
// 32h. RENDER — CONFLICT: predation, blood, combat effects and war fronts
// ═══════════════════════════════════════════════════════════════════════════
// The combat visual state, realtime predation, the traces a fight leaves on the
// ground, impact bursts, combat effects, and the fronts of a war.
// This section was one file of three thousand three hundred lines,
// 32d-spatial-rendering.js, split in six along its own seams on 2026-09-14; the
// composed runtime is unchanged. Everything here reads world state and never
// writes it: visual caches live outside W so the simulation hash and replay
// determinism are untouched by anything drawn.
function combatEventWindow() {
  return Math.max(24, Math.round((UI.speed || 1) * 10));
}
function makeCombatVisualState(bounds) {
  const state = { events: [], actors: new Map(), window: combatEventWindow() },
    limit = Math.max(0, W.events.length - 360);
  for (let n = W.events.length - 1; n >= limit; n--) {
    const e = W.events[n],
      age = W.tick - e.tick;
    if (age < 0 || age > state.window) continue;
    const death = e.type === "DeathEvent",
      combat =
        e.type === "InjuryEvent" ||
        e.type === "KillEvent" ||
        (death &&
          (e.evidence || []).some((v) => /war|predation|killed|injur|combat|siege/i.test(v)));
    if (!death && !combat) continue;
    if (e.location < 0) continue;
    const [x, y] = xy(e.location);
    if (x < bounds.x0 - 3 || x > bounds.x1 + 3 || y < bounds.y0 - 3 || y > bounds.y1 + 3) continue;
    state.events.push({ e, age, combat, death, fade: clamp(1 - age / state.window, 0.12, 1) });
    for (let s = 0; s < e.subjects.length; s++) {
      const id = e.subjects[s];
      if (id)
        state.actors.set(id, {
          event: e,
          role:
            e.type === "InjuryEvent"
              ? s
                ? "attacker"
                : "victim"
              : e.type === "KillEvent"
                ? s
                  ? "victim"
                  : "attacker"
                : "fallen",
        });
    }
  }
  state.events.reverse();
  return state;
}
function bloodVisualHue(id = 0) {
  const chemical = W.definitions.species[C.BLOOD]?.colorHue ?? 352;
  if (!id || !W.components.genome[id]) return chemical;
  return mixHue(chemical, creatureModel(id).accentHue, 0.28);
}
function queuePredationVisual(attacker, victim, tile, damage, lethal, eventId, ranged = 0) {
  const ap = W.components.position[attacker],
    vp = W.components.position[victim];
  if (!ap || !vp) return;
  const now = performance.now(),
    styles = ["BITE", "GRAPPLE", "IMPALE", "COIL & TEAR"],
    lineage = W.components.genome[attacker]?.lineageId || attacker,
    style = ranged
      ? ranged === 3
        ? "BURST"
        : "VOLLEY"
      : styles[hashParts(W.seedHash, "attack-form", lineage) % styles.length],
    chemicalHue = W.definitions.species[C.BLOOD]?.colorHue ?? 352,
    bloodHue = wrapHue(
      chemicalHue +
        (hashParts(W.seedHash, "blood-hue", W.components.genome[victim]?.lineageId || victim) %
          41) -
        20,
    );
  UI.combatVisuals = (UI.combatVisuals || [])
    .filter((v) => v.world === W && now - v.started < v.duration)
    .slice(-35);
  UI.combatVisuals.push({
    world: W,
    attacker,
    victim,
    tile,
    damage,
    lethal,
    eventId,
    started: now,
    duration: (lethal ? 2200 : 1600) / Math.max(1, Math.sqrt(UI.speed || 1)),
    ax: ap.x + 0.5,
    ay: ap.y + 0.5,
    vx: vp.x + 0.5,
    vy: vp.y + 0.5,
    bloodHue,
    style,
    ranged,
  });
}
function drawRealtimePredation(now, bounds) {
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    active = (UI.combatVisuals || []).filter((v) => v.world === W && now - v.started < v.duration);
  UI.combatVisuals = active;
  if (!active.length) return;
  ctx.save();
  for (const v of active) {
    const pa = W.components.position[v.attacker],
      pv = W.components.position[v.victim],
      aliveA = !!(pa && W.components.genome[v.attacker]),
      aliveV = !!(pv && W.components.genome[v.victim]),
      vtx = aliveV ? pv.x + 0.5 : v.vx,
      vty = aliveV ? pv.y + 0.5 : v.vy;
    if (vtx < bounds.x0 - 3 || vtx > bounds.x1 + 3 || vty < bounds.y0 - 3 || vty > bounds.y1 + 3)
      continue;
    const t = clamp((now - v.started) / v.duration, 0, 1),
      wind = clamp(t / 0.07, 0, 1),
      strike = clamp((t - 0.07) / 0.15, 0, 1),
      impact = clamp((t - 0.2) / 0.16, 0, 1),
      recoil = clamp((t - 0.5) / 0.34, 0, 1),
      lunge = clamp(0.06 * wind + 0.85 * strike - 0.4 * recoil, 0, 0.92) * (v.ranged ? 0.12 : 1),
      preyKick = impact * (1 - recoil * 0.45),
      As = aliveA ? visualAnchor(v.attacker, pa, m, now).s : proceduralProjectTile(v.ax, v.ay, m),
      Vs = aliveV ? visualAnchor(v.victim, pv, m, now).s : proceduralProjectTile(v.vx, v.vy, m),
      dx = Vs.x - As.x,
      dy = Vs.y - As.y,
      len = Math.max(1, Math.hypot(dx, dy)),
      ux = dx / len,
      uy = dy / len,
      aw = { x: lerp(As.x, Vs.x, lunge), y: lerp(As.y, Vs.y, lunge) },
      vw = { x: Vs.x + ux * m.tw * 0.07 * preyKick, y: Vs.y + uy * m.tw * 0.07 * preyKick },
      spray = clamp((t - 0.2) / 0.4, 0, 1),
      fade = clamp((1 - t) / 0.24, 0, 1);
    ctx.globalAlpha = 0.2 * (1 - strike) + 0.08;
    ctx.strokeStyle = hsl(creatureModel(v.attacker).primaryHue, 62, 62);
    ctx.lineWidth = Math.max(2, m.tw * 0.05);
    ctx.beginPath();
    ctx.moveTo(As.x, As.y);
    ctx.lineTo(aw.x, aw.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    let rA = 0,
      rV = 0;
    if (W.components.genome[v.victim]) {
      ctx.save();
      ctx.translate(vw.x, vw.y);
      ctx.rotate(impact * (visualHash01(v.eventId, 7) - 0.5) * 0.5);
      ctx.scale(1 + impact * 0.1, 1 - impact * 0.22);
      ctx.translate(-vw.x, -vw.y);
      rV = drawCreatureGlyph(ctx, v.victim, vw, now, null, 0, false, {
        gait: (VISUAL_MOTION.get(v.victim)?.gait || 0) + impact * 1.4,
        moving: impact > 0 && recoil < 1,
        screenHeading: Math.atan2(dy, dx) + Math.PI,
      });
      const victimMotion = VISUAL_MOTION.get(v.victim);
      if (victimMotion) {
        victimMotion.s = vw;
        victimMotion.lastR = rV;
      }
      ctx.restore();
    }
    if (W.components.genome[v.attacker]) {
      rA = drawCreatureGlyph(ctx, v.attacker, aw, now, null, 0, false, {
        gait: (VISUAL_MOTION.get(v.attacker)?.gait || 0) + strike * 2.6,
        moving: t < 0.6,
        screenHeading: Math.atan2(dy, dx),
      });
      const attackerMotion = VISUAL_MOTION.get(v.attacker);
      if (attackerMotion) {
        attackerMotion.s = aw;
        attackerMotion.lastR = rA;
      }
    }
    if (v.ranged && t > 0.05 && t < 0.34) {
      const pt = clamp((t - 0.05) / 0.27, 0, 1),
        lob = v.ranged === 3 ? 0.04 : 0.22,
        px2 = lerp(aw.x, vw.x, pt),
        py2 = lerp(aw.y, vw.y, pt) - Math.sin(pt * Math.PI) * m.tw * lob;
      ctx.strokeStyle = v.ranged === 3 ? "#ffd98c" : "#e8e2c8";
      ctx.lineWidth = Math.max(1.2, m.tw * 0.03);
      ctx.beginPath();
      ctx.moveTo(px2 - ux * m.tw * 0.12, py2 - uy * m.tw * 0.12);
      ctx.lineTo(px2, py2);
      ctx.stroke();
      if (v.ranged === 3 && t < 0.14) {
        ctx.fillStyle = "#ffe9b0";
        ctx.beginPath();
        ctx.arc(
          aw.x + ux * Math.max(rA, 6) * 0.9,
          aw.y + uy * Math.max(rA, 6) * 0.9,
          Math.max(2, m.tw * 0.05) * (1.4 - t / 0.14),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    const r = Math.max(rA, rV, m.tw * 0.22);
    if (t > 0.16 && !v.ranged) {
      ctx.strokeStyle = "#fff1c9";
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1.5, r * 0.08);
      for (let n = 0; n < 3; n++) {
        const side = (n - 1) * r * 0.18;
        ctx.beginPath();
        ctx.moveTo(vw.x - ux * r * 0.55 - uy * side, vw.y - uy * r * 0.55 + ux * side);
        ctx.lineTo(vw.x + ux * r * 0.32 - uy * side, vw.y + uy * r * 0.32 + ux * side);
        ctx.stroke();
      }
      ctx.strokeStyle = hsl(v.bloodHue, 88, 56, 0.9);
      ctx.lineWidth = Math.max(2, r * 0.11);
      ctx.beginPath();
      ctx.arc(
        vw.x,
        vw.y,
        r * (0.28 + impact * 0.18),
        Math.atan2(dy, dx) - 1.15,
        Math.atan2(dy, dx) + 1.15,
      );
      ctx.stroke();
    }
    if (spray > 0) {
      ctx.fillStyle = hsl(v.bloodHue, 83, 43, 0.82 * fade + 0.14);
      const drops =
        (v.lethal ? 24 : 15) +
        Math.min(18, Math.floor((v.bloodAmount || 0) * 1.5)) +
        (v.critical ? 10 : 0);
      for (let n = 0; n < drops; n++) {
        const spread = (visualHash01(v.eventId, n) - 0.5) * 2.15,
          travel = r * (0.35 + visualHash01(v.eventId ^ 0x8b, n) * 2.4) * spray,
          side = spread * travel * 0.66,
          gravity = r * 0.72 * spray * spray,
          drop = Math.max(1, r * (0.025 + visualHash01(n, v.eventId) * 0.065) * (1 - spray * 0.35));
        ctx.beginPath();
        ctx.ellipse(
          vw.x + ux * travel - uy * side,
          vw.y + uy * travel + ux * side + gravity,
          drop,
          drop * (0.55 + visualHash01(n, 91) * 0.4),
          spread,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.fillStyle = hsl(v.bloodHue, 74, 24, 0.34 + 0.26 * impact);
      ctx.beginPath();
      ctx.ellipse(
        vw.x,
        vw.y + r * 0.38,
        r * (0.3 + spray * 0.58 + Math.min(0.55, (v.bloodAmount || 0) * 0.025)),
        r * (0.08 + spray * 0.16 + (v.critical ? 0.08 : 0)),
        Math.atan2(dy, dx),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    if (v.severedPart && t > 0.24) {
      const severPhase = clamp((t - 0.24) / 0.48, 0, 1),
        angle = Math.atan2(dy, dx) + (visualHash01(v.eventId, 0x61) - 0.5) * 2.4,
        travel = r * (0.45 + severPhase * 1.25),
        lx = vw.x + Math.cos(angle) * travel,
        ly = vw.y + Math.sin(angle) * travel + r * severPhase * severPhase * 0.72;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(angle + severPhase * 5.2);
      ctx.fillStyle = hsl(creatureModel(v.victim).primaryHue, 45, 36, 0.94);
      ctx.strokeStyle = hsl(v.bloodHue, 86, 34, 0.96);
      ctx.lineWidth = Math.max(1.2, r * 0.08);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-r * 0.32, -r * 0.1, r * 0.64, r * 0.2, r * 0.08);
      else ctx.rect(-r * 0.32, -r * 0.1, r * 0.64, r * 0.2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (v.lethal && t > 0.32) {
      const fragmentPhase = clamp((t - 0.32) / 0.5, 0, 1);
      for (let n = 0; n < (v.critical ? 11 : 7); n++) {
        const a = (visualHash01(v.eventId ^ 0x5f, n) - 0.5) * 2.5 + Math.atan2(dy, dx),
          d = r * (0.25 + visualHash01(v.eventId, n ^ 17) * 1.25) * fragmentPhase,
          sz = r * (0.045 + visualHash01(n, v.eventId ^ 33) * 0.09);
        ctx.fillStyle =
          n % 3 === 0
            ? hsl(creatureModel(v.victim).accentHue, 65, 55, 0.75 * fade + 0.18)
            : hsl(v.bloodHue, 78, n % 2 ? 29 : 42, 0.86 * fade + 0.12);
        ctx.save();
        ctx.translate(vw.x + Math.cos(a) * d, vw.y + Math.sin(a) * d + d * 0.35 * fragmentPhase);
        ctx.rotate(a + fragmentPhase * 4);
        ctx.fillRect(-sz, -sz * 0.45, sz * 2, sz * 0.9);
        ctx.restore();
      }
    }
    ctx.strokeStyle = hsl(v.bloodHue, 82, 62, 0.72 * fade);
    ctx.lineWidth = Math.max(1.5, r * 0.06);
    ctx.beginPath();
    ctx.arc(vw.x, vw.y, r * (0.45 + impact * 0.7), 0, Math.PI * 2);
    ctx.stroke();
    if (UI.camera.zoom > 2.2) {
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = `800 ${clamp(Math.round(r * 0.25), 9, 15)}px system-ui`;
      ctx.fillStyle = "#fff1d4";
      ctx.strokeStyle = "#071016dd";
      ctx.lineWidth = 3;
      const label = `${v.style}${v.bodyPart ? ` · ${v.bodyPart.toUpperCase()}` : ""}${v.severedPart ? " · LIMB LOST" : v.lethal ? " · KILL" : " · " + v.damage}`;
      ctx.strokeText(label, vw.x, vw.y - r * 1.05);
      ctx.fillText(label, vw.x, vw.y - r * 1.05);
    }
  }
  ctx.restore();
}
function drawGroundConflictTraces(now, bounds) {
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    bloodHue = bloodVisualHue();
  ctx.save();
  for (const item of ACTIVE_COMBAT_STATE?.events || []) {
    if (!item.death) continue;
    const [x, y] = xy(item.e.location),
      s = proceduralProjectTile(x + 0.5, y + 0.5, m),
      amount = Math.max(1, item.e.magnitude || item.e.subjects.length || 1),
      r = clamp(
        m.tw * (0.12 + Math.log2(amount + 1) * 0.045),
        2,
        Math.max(UI.camera.zoom > 5 ? 28 : 14, m.tw * 0.5),
      );
    ctx.fillStyle = hsl(bloodHue, 72, 25, 0.18 + item.fade * 0.28);
    ctx.beginPath();
    ctx.ellipse(
      s.x,
      s.y + r * 0.28,
      r * (0.8 + visualHash01(item.e.id, 31) * 0.45),
      r * 0.3,
      visualHash01(item.e.id, 97) * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    for (let n = 0; n < Math.min(7, 2 + amount); n++) {
      const a = visualHash01(item.e.id, n) * Math.PI * 2,
        d = r * (0.55 + visualHash01(item.e.id ^ 73, n) * 0.8),
        drop = Math.max(1, r * (0.055 + visualHash01(n, item.e.id) * 0.07));
      ctx.beginPath();
      ctx.arc(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d * 0.42, drop, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.CORPSE) continue;
    const p = W.components.position[id];
    if (
      !p ||
      p.x < bounds.x0 - 2 ||
      p.x > bounds.x1 + 2 ||
      p.y < bounds.y0 - 2 ||
      p.y > bounds.y1 + 2
    )
      continue;
    const tile = idx(p.x, p.y),
      signal = tileBlood(tile) + (W.components.chemistry[id]?.q?.[C.BLOOD] || 0),
      corpseAge = Math.max(0, W.tick - (W.components.life[id]?.deathTick ?? W.tick)),
      corpsePoolLife = 48;
    if (corpseAge >= corpsePoolLife) continue;
    if (signal < 2) continue;
    const s = W.components.genome[id]
        ? visualAnchor(id, p, m, ACTIVE_RENDER_NOW || performance.now()).s
        : proceduralProjectTile(p.x + 0.5, p.y + 0.5, m),
      r = clamp(m.tw * (0.15 + Math.log2(signal + 1) * 0.025), 2, Math.max(26, m.tw * 0.5)),
      corpsePoolFade = clamp(1 - corpseAge / corpsePoolLife, 0, 1) ** 1.2;
    ctx.fillStyle = hsl(bloodVisualHue(id), 72, 22, 0.48 * corpsePoolFade);
    ctx.beginPath();
    ctx.ellipse(
      s.x,
      s.y + r * 0.35,
      r,
      r * 0.28,
      visualHash01(id, 0x812) * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  drawSeveredBodyParts(ctx, now, bounds, m);
  ctx.restore();
}
function drawImpactBurst(s, item, now, m) {
  const e = item.e,
    progress = clamp(item.age / 8, 0, 1);
  if (progress >= 1) return;
  const r = clamp(m.tw * (0.22 + progress * 0.28), 4, Math.max(34, m.tw * 0.6)),
    hue = bloodVisualHue(e.subjects[0]);
  ctx.save();
  ctx.strokeStyle = hsl(hue, 82, 66, (1 - progress) * item.fade);
  ctx.lineWidth = Math.max(1, 3 * (1 - progress));
  ctx.beginPath();
  ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = hsl(hue, 78, 48, 0.55 * item.fade);
  for (let n = 0; n < 8; n++) {
    const a = visualHash01(e.id, n) * Math.PI * 2,
      d = r * (0.25 + progress),
      drop = Math.max(1, m.tw * 0.025 * (1 - progress));
    ctx.beginPath();
    ctx.arc(
      s.x + Math.cos(a) * d,
      s.y + Math.sin(a) * d * 0.72 - progress * r * 0.24,
      drop,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
}
function factionBattleAnchor(factionId, eventLocation) {
  const [tx, ty] = xy(eventLocation),
    settlements = W.settlements.filter((s) => !s.ruined && s.factionId === factionId);
  return settlements.sort(
    (a, b) => dist2(a.x, a.y, tx, ty) - dist2(b.x, b.y, tx, ty) || a.id - b.id,
  )[0];
}
function drawWarFronts(now, bounds) {
  const wars = W.activeWars.filter((w) => !w.ended),
    m = ACTIVE_RENDER_METRICS || projectionMetrics();
  if (!wars.length) return;
  ctx.save();
  for (const war of wars) {
    const last = eventById(war.lastEventId || war.startEventId),
      location =
        last?.location >= 0
          ? last.location
          : (() => {
              const a = W.factions.find((f) => f.id === war.a),
                s = W.settlements.find((q) => q.id === a?.capitalSettlementId);
              return s ? idx(s.x, s.y) : -1;
            })(),
      fa = W.factions.find((f) => f.id === war.a),
      fb = W.factions.find((f) => f.id === war.b);
    if (location < 0 || !fa || !fb) continue;
    const [x, y] = xy(location),
      a = factionBattleAnchor(fa.id, location),
      b = factionBattleAnchor(fb.id, location);
    if (!a || !b) continue;
    const pa = proceduralProjectTile(a.x + 0.5, a.y + 0.5, m),
      pb = proceduralProjectTile(b.x + 0.5, b.y + 0.5, m),
      front = proceduralProjectTile(x + 0.5, y + 0.5, m),
      pulse = 0.65 + 0.35 * Math.sin(now * 0.006 + war.id);
    ctx.setLineDash([7, 5]);
    ctx.lineDashOffset = -now * 0.012;
    ctx.lineWidth = clamp(m.tw * 0.035, 1, 10);
    const frontLine = (pp, color) => {
      const fdx = pp.x - front.x,
        fdy = pp.y - front.y,
        flen = Math.hypot(fdx, fdy) || 1,
        fcut = Math.min(1, (Math.max(m.w, m.h) * 0.42) / flen),
        fx = front.x + fdx * fcut,
        fy = front.y + fdy * fcut,
        wa = (c, a) =>
          c && c.startsWith("hsl(") && !c.includes("/") ? c.replace(")", ` / ${a})`) : c,
        fg = ctx.createLinearGradient(front.x, front.y, fx, fy);
      fg.addColorStop(0, wa(color, 0.9) || "#f0cf8d");
      fg.addColorStop(1, wa(color, fcut < 1 ? 0.03 : 0.3) || "#f0cf8d");
      ctx.strokeStyle = fg;
      ctx.beginPath();
      ctx.moveTo(front.x, front.y);
      ctx.lineTo(fx, fy);
      ctx.stroke();
    };
    frontLine(pa, fa.color);
    frontLine(pb, fb.color);
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    const lastE = eventById(war.lastEventId || 0);
    if (lastE && W.tick - lastE.tick < Math.max(10, (UI.speed || 1) * 6)) {
      const v0 = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome();
      for (let n = 0; n < 6; n++) {
        const a2 = visualHash01(war.id || 1, n) * Math.PI * 2 + now * 0.0004 * (n % 2 ? 1 : -1),
          d2 = m.tw * (0.3 + visualHash01(n, war.id || 1) * 0.5),
          lift = (now * 0.02 + n * 37) % (m.tw * 0.6),
          px2 = front.x + Math.cos(a2) * d2,
          py2 = front.y + Math.sin(a2) * d2 * 0.5 - lift;
        ctx.fillStyle = hsl(v0.mineralHue, 20, 58, 0.15);
        ctx.beginPath();
        ctx.arc(
          px2,
          py2,
          Math.max(2, m.tw * 0.09 * (0.6 + visualHash01(n, 3) * 0.6)),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    for (const [f, side] of [
      [fa, -1],
      [fb, 1],
    ]) {
      ctx.fillStyle = f.color;
      for (let n = 0; n < Math.min(6, 2 + Math.floor(f.militaryStrength / 18)); n++) {
        const ox = side * (8 + n * 5),
          oy = ((n % 3) - 1) * 5;
        ctx.beginPath();
        ctx.moveTo(front.x + ox, front.y + oy - 5 * pulse);
        ctx.lineTo(front.x + ox + side * 6, front.y + oy);
        ctx.lineTo(front.x + ox, front.y + oy + 5 * pulse);
        ctx.closePath();
        ctx.fill();
      }
    }
    if (UI.labels) {
      ctx.font = "bold 10px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      const phase =
          war.casualties > 0 || war.contactTurns
            ? `${war.casualties} fallen`
            : war.marches
              ? "forces marching"
              : "mobilizing",
        label = `${fa.name} ⚔ ${fb.name} · ${phase}`;
      const width = ctx.measureText(label).width;
      WAR_LABEL_HITS.push({
        x: front.x - width / 2 - 5,
        y: front.y - 30,
        w: width + 10,
        h: 15,
        id: fa.entityId,
      });
      ctx.fillStyle = "#071016dc";
      ctx.fillRect(front.x - width / 2 - 5, front.y - 30, width + 10, 15);
      ctx.fillStyle = "#f2d9a4";
      ctx.fillText(label, front.x, front.y - 19);
    }
  }
  ctx.restore();
}
