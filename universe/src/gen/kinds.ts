// The kinds of generated things and their references. All structural: a star,
// a planet, a plate, a surface cell or a deposit is named by where it comes from,
// never by when anyone looked at it. The home star and planet are ordinal 0;
// later phases give every system's bodies ordinals from their origin.
import { defineKind, makeRef, type Ref } from "../kernel/index.ts";

export const STAR = defineKind("star", "star", "structural");
export const PLANET = defineKind("plnt", "planet", "structural");
export const PLATE = defineKind("plate", "tectonic plate", "structural");
export const SURFACE_CELL = defineKind("cell", "place on a planet", "structural");
export const DEPOSIT = defineKind("depo", "mineral deposit", "structural");
export const AGE = defineKind("age", "age of a world's deep past", "structural");
export const SPECIES = defineKind("spec", "lineage of living things", "structural");

export const HOME = 0;

export function starRef(ordinal: number): Ref {
  return makeRef(STAR, 0, ordinal);
}
export function planetRef(ordinal: number): Ref {
  return makeRef(PLANET, 0, ordinal);
}
export function plateRef(planet: number, plate: number): Ref {
  return makeRef(PLATE, planet, plate);
}
export function cellRef(planet: number, cell: number): Ref {
  return makeRef(SURFACE_CELL, planet, cell);
}
export function depositRef(planet: number, deposit: number): Ref {
  return makeRef(DEPOSIT, planet, deposit);
}

export function ageRef(planet: number, age: number): Ref {
  return makeRef(AGE, planet, age);
}

export function speciesRef(planet: number, species: number): Ref {
  return makeRef(SPECIES, planet, species);
}
