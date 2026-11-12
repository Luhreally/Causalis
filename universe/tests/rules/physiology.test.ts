import { test } from "node:test";
import assert from "node:assert/strict";
import {
  breathingCeiling,
  cruiseSpeed,
  drag,
  flight,
  frameBears,
  gasDensity,
  gasLift,
  keepsWarm,
  largestFrame,
  reynolds,
  sensesOf,
  smallestWarm,
  wingsFor,
} from "../../src/rules/index.ts";

// B0: what a body can do on a world, checked against Earth's own animals.

const AIR = gasDensity(1.013, 28.97, 288);

test("Earth's air is about 1.2 kg a cubic metre", () => {
  assert.ok(AIR > 1.18 && AIR < 1.26, String(AIR));
});

test("an elephant stands on its bones on Earth; a beetle in its shell; a squid without a frame in the sea", () => {
  assert.ok(frameBears("bones", 6000, 1).ok);
  assert.ok(frameBears("shell", 0.01, 1).ok);
  assert.ok(frameBears("none", 1, 1, true).ok);
  // (The greatest squid, about 500 kg, is held by the sea.)
  assert.ok(frameBears("none", 500, 1, true).ok);
});

test("a frame bears less under a heavier pull, and a shelled giant cannot stand on land", () => {
  assert.ok(!frameBears("shell", 500, 1).ok, "a half-tonne beetle on Earth");
  assert.ok(!frameBears("bones", 6000, 3).ok, "an elephant under three Earths' pull");
  assert.ok(largestFrame("bones", 2) < largestFrame("bones", 1) / 7);
  assert.ok(largestFrame("bones", 0.5) > largestFrame("bones", 1) * 7);
});

test("a hummingbird, a goose and the greatest pterosaur fly; a six-tonne flier does not", () => {
  assert.ok(flight(0.004, 0.0012, AIR, 1).flies, "a hummingbird");
  assert.ok(flight(4, 0.4, AIR, 1).flies, "a goose");
  assert.ok(flight(250, 10, AIR, 1).flies, "Quetzalcoatlus");
  assert.ok(!flight(6000, wingsFor(6000), AIR, 1).flies, "six tonnes on a pterosaur's wings");
  assert.ok(!flight(6000, 200, AIR, 1).flies, "six tonnes on 200 m² of wing");
});

test("a thicker air and a lighter pull bear heavier fliers", () => {
  assert.ok(!flight(600, wingsFor(600), AIR, 1).flies);
  assert.ok(flight(600, wingsFor(600), AIR * 4, 1).flies);
  assert.ok(flight(600, wingsFor(600), AIR, 0.4).flies);
});

test("hydrogen lifts about 1.1 kg a cubic metre in Earth's air; a gas as heavy as the air lifts nothing", () => {
  const lift = gasLift(1, 1.013, 28.97, 2.016, 288);
  assert.ok(lift > 1.05 && lift < 1.2, String(lift));
  assert.equal(gasLift(1, 1, 29, 29, 288), 0);
});

test("a beetle breathes through its tubes in Earth's air; a two-kilo tube-breather cannot; more oxygen lets it grow", () => {
  assert.ok(breathingCeiling("tubes", 0.21) >= 0.01);
  assert.ok(breathingCeiling("tubes", 0.21) < 2);
  assert.ok(breathingCeiling("tubes", 0.35) > 4 * breathingCeiling("tubes", 0.21));
  assert.ok(breathingCeiling("lungs", 0.21) >= 6000, "an elephant breathes");
  assert.ok(breathingCeiling("gills", 0.21) >= 1, "a squid breathes");
});

test("a squid of a kilo cruises at about a metre or two a second in the sea; water drags far harder than air", () => {
  const v = cruiseSpeed(3, 1025, 0.006, 0.3);
  assert.ok(v > 0.5 && v < 3, String(v));
  assert.ok(drag(1025, 1, 0.01) > 500 * drag(AIR, 1, 0.01));
  assert.ok(reynolds(1025, 1, 0.3, 1e-3) > 1e5);
});

test("a shrew keeps warm in its fur in the warm; the smallest warm body grows in the cold", () => {
  assert.ok(keepsWarm(0.002, 25, "fur") >= 1, "a 2 g shrew at 25 °C");
  assert.ok(keepsWarm(0.002, -20, "bare") < 1, "2 g bare at −20 °C");
  assert.ok(keepsWarm(6000, 0, "bare") >= 1, "an elephant at 0 °C");
  assert.ok(smallestWarm(-20, "fur") > smallestWarm(20, "fur"));
  assert.ok(smallestWarm(20, "bare") > smallestWarm(20, "fur"));
});

test("Earth's senses: sight in the visible, hearing, electric sense in the sea; methane carries no current; a dim red star's light is infrared", () => {
  const earth = sensesOf({ star: 5778, pressure: 1, liquid: "salt water", field: true });
  assert.equal(earth.band, "visible");
  assert.ok(earth.peakNm > 480 && earth.peakNm < 520, String(earth.peakNm));
  assert.ok(earth.hearing && earth.electric && earth.magnetic);
  assert.equal(sensesOf({ star: 94, pressure: 1.5, liquid: "methane" }).electric, false);
  assert.equal(sensesOf({ star: 3000, pressure: 1, liquid: "water" }).band, "near infrared");
  assert.equal(sensesOf({ star: 5778, pressure: 0.001, liquid: null }).hearing, false);
});
