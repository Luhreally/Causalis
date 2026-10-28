export type BrushKind =
  "raise" | "lower" | "water" | "drain" | "life" | "ore" | "lightning" | "claim";
export type BrushStrokeArgs = {
  kind: BrushKind;
  cells: number[];
  radius: number;
  strength: number;
  ore?: string;
  realm?: string;
  confirmed?: boolean;
};
export type BrushPreview = {
  cells: number[];
  provinces: number[];
  atRisk: number;
  towns: number;
  seeded: number;
};
export type BrushState = {
  count: number;
  key: string;
  centres: number[];
  ores: string[];
  realms: { ref: string; name: string }[];
  strokes: { event: string; kind: string; cells: number[]; t: number; dead: number }[];
};
