// ═══════════════════════════════════════════════════════════════════════════
// 48. LANGUAGES: EVERY WORLD SPEAKS, EVERY PEOPLE IN ITS OWN TONGUE
// ═══════════════════════════════════════════════════════════════════════════
// Names used to come from one shared word list, so a polity on one planet
// sounded like a polity on any other. Each world now has a first tongue drawn
// from its seed (a phoneme inventory, syllable shapes, a spelling style, and a
// small lexicon for the concepts names are built from), and each culture speaks
// a dialect of it derived by regular sound changes, so a world's peoples sound
// related but distinct. People take a given name in their culture's tongue and
// a family name shared by their kin group; places, polities, cultures, species,
// and artifacts are named from the lexicon. The canonical Earth-adjacent seed
// keeps the founding word lists. Languages are authoritative state stored on
// the world and its cultures; rendering only reads them.
const LANGUAGE_CONSONANTS = Object.freeze([
  "p",
  "t",
  "k",
  "b",
  "d",
  "g",
  "m",
  "n",
  "s",
  "l",
  "r",
  "v",
  "z",
  "h",
  "f",
  "w",
  "y",
  "sh",
  "ch",
  "th",
  "kh",
  "ng",
  "ts",
  "dz",
  "j",
  "q",
  "x",
]);
const LANGUAGE_VOWELS = Object.freeze([
  "a",
  "e",
  "i",
  "o",
  "u",
  "y",
  "ai",
  "au",
  "ei",
  "ou",
  "ia",
  "ua",
  "ae",
  "oe",
  "ii",
  "aa",
  "eo",
]);
const LANGUAGE_PATTERNS = Object.freeze(["CV", "CVC", "VC", "V", "CVV", "CCV", "CCVC"]);
// Only clusters a mouth can say: a stop or fricative followed by a liquid or
// glide, or s plus a stop. Codas are the sounds that close a syllable cleanly.
const LANGUAGE_ONSETS = Object.freeze([
  "pr",
  "tr",
  "kr",
  "br",
  "dr",
  "gr",
  "pl",
  "kl",
  "bl",
  "gl",
  "fl",
  "fr",
  "sl",
  "sm",
  "sn",
  "st",
  "sk",
  "sp",
  "sw",
  "tw",
  "kw",
  "thr",
  "shr",
  "vr",
  "zr",
  "khr",
]);
const LANGUAGE_CODA_POOL = Object.freeze([
  "n",
  "m",
  "r",
  "l",
  "s",
  "sh",
  "th",
  "ng",
  "k",
  "t",
  "p",
  "d",
  "g",
  "z",
  "x",
  "ch",
  "kh",
  "ts",
]);
const LANGUAGE_LINKERS = Object.freeze(["n", "r", "h", "y", "l", "w"]);
const LANGUAGE_SHIFTS = Object.freeze([
  ["p", "b"],
  ["t", "d"],
  ["k", "g"],
  ["s", "sh"],
  ["r", "l"],
  ["f", "v"],
  ["th", "t"],
  ["ng", "n"],
  ["kh", "h"],
  ["ts", "s"],
  ["a", "e"],
  ["o", "u"],
  ["i", "e"],
  ["m", "n"],
]);
const LEXICON_CONCEPTS = Object.freeze({
  camp: 4,
  town: 6,
  polity: 6,
  culture: 1,
  artifact: 6,
  grazer: 3,
  hunter: 3,
  folk: 3,
});
const LEGACY_LEXICON = Object.freeze({
  camp: ["rest", "hearth", "hold", "camp"],
  town: ["watch", "hollow", "reach", "haven", "ford", "spire"],
  polity: ["Kin", "League", "Concord", "Circle", "Hearths", "Accord"],
  culture: ["Ways"],
  artifact: ["Edge", "Lens", "Vessel", "Seal", "Crown", "Needle"],
  grazer: ["Grazer", "Browser", "Drifter"],
  hunter: ["Stalker", "Fang", "Hunter"],
  folk: ["Kin", "Folk", "People"],
});
function titleWord(w) {
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : "";
}
function legacyLanguage(key) {
  return {
    id: String(key),
    legacy: true,
    name: "Common",
    consonants: [],
    vowels: [],
    codas: [],
    onsets: [],
    linkers: [],
    patterns: [],
    style: { glue: "", apostrophe: false },
    shifts: [],
    lexicon: Object.fromEntries(Object.entries(LEGACY_LEXICON).map(([k, v]) => [k, v.slice()])),
  };
}
function langConsonant(lang, r) {
  return lang.consonants[r.int(lang.consonants.length)];
}
// A vowel nucleus is at most two letters: a long vowel may open it, but a
// second vowel in the same syllable is always short and different.
function langVowel(lang, r, shortOnly = false, avoid = "") {
  const pool = shortOnly ? lang.vowels.filter((v) => v.length === 1 && v !== avoid) : lang.vowels,
    list = pool.length ? pool : ["a", "e", "i", "o", "u"].filter((v) => v !== avoid);
  return list[r.int(list.length)];
}
function langSyllable(lang, r, shape, afterVowel) {
  let s = "",
    vowelSeen = false;
  // Two vowels never meet across a syllable boundary: bridge them with a linker.
  if (afterVowel && shape[0] === "V" && lang.linkers?.length)
    s += lang.linkers[r.int(lang.linkers.length)];
  for (let i = 0; i < shape.length; i++) {
    if (shape[i] === "C") {
      if (i === 0 && shape[1] === "C") {
        s += lang.onsets?.length ? lang.onsets[r.int(lang.onsets.length)] : langConsonant(lang, r);
        i++;
        continue;
      }
      const closing = i === shape.length - 1 && i > 0;
      s +=
        closing && lang.codas.length
          ? lang.codas[r.int(lang.codas.length)]
          : langConsonant(lang, r);
    } else {
      s += vowelSeen
        ? langVowel(lang, r, true, s.slice(-1))
        : langVowel(lang, r, s.length > 0 && /[aeiouy]$/.test(s));
      vowelSeen = true;
    }
  }
  return s;
}
// Words stay speakable: no syllable repeats its neighbour, and a word stops
// growing once it is eight letters long.
function langWord(lang, r, syllables = 2) {
  if (lang.legacy) return NAME_A[r.int(NAME_A.length)].toLowerCase();
  let w = "",
    previous = "";
  for (let n = 0; n < syllables; n++) {
    if (n && w.replace(/'/g, "").length >= 8) break;
    const shape = lang.patterns[r.int(lang.patterns.length)],
      afterVowel = w.length > 0 && /[aeiouy]$/.test(w);
    let syllable = langSyllable(lang, r, shape, afterVowel);
    if (syllable === previous) syllable = langSyllable(lang, r, "CV", afterVowel);
    previous = syllable;
    w += syllable;
    if (lang.style.apostrophe && n === 0 && syllables > 2 && r.next() < 0.3) w += "'";
  }
  // No letter three times running, no digraph doubled, no run of three vowels.
  return w
    .replace(/(.)\1\1+/g, "$1$1")
    .replace(/(sh|ch|th|kh|ng|ts|dz)\1/g, "$1")
    .replace(/([aeiouy]{2})[aeiouy]+/g, "$1")
    .replace(/yy/g, "y");
}
function makeLanguage(world, key) {
  const r = makeRng(hashParts(world.seedHash, "language", key), "phonology"),
    pickSome = (pool, count) => {
      const bag = pool.slice(),
        out = [];
      while (out.length < count && bag.length) out.push(bag.splice(r.int(bag.length), 1)[0]);
      return out;
    },
    consonants = pickSome(LANGUAGE_CONSONANTS, 7 + r.int(8)),
    // Three to five short vowels, and at most two long ones.
    vowels = [
      ...pickSome(
        LANGUAGE_VOWELS.filter((v) => v.length === 1),
        3 + r.int(3),
      ),
      ...pickSome(
        LANGUAGE_VOWELS.filter((v) => v.length === 2),
        r.int(3),
      ),
    ],
    codas = pickSome(
      LANGUAGE_CODA_POOL.filter((c) => consonants.includes(c) || c === "n" || c === "r"),
      2 + r.int(4),
    ),
    onsets = pickSome(
      LANGUAGE_ONSETS.filter((cl) => consonants.includes(cl[0])),
      r.next() < 0.3 ? 0 : 2 + r.int(4),
    ),
    linkers = pickSome(LANGUAGE_LINKERS, 2),
    patterns = pickSome(LANGUAGE_PATTERNS, 2 + r.int(3)),
    lang = {
      id: String(key),
      legacy: false,
      name: "",
      consonants,
      vowels,
      codas,
      onsets,
      linkers,
      patterns: patterns.includes("CV") ? patterns : [...patterns, "CV"],
      style: { glue: ["", "", "-", " ", "'"][r.int(5)], apostrophe: r.next() < 0.25 },
      shifts: [],
      lexicon: {},
    };
  lang.name = titleWord(langWord(lang, r, 2 + (r.next() < 0.35 ? 1 : 0)));
  for (const [concept, count] of Object.entries(LEXICON_CONCEPTS))
    lang.lexicon[concept] = Array.from({ length: count }, () => langWord(lang, r, 1 + r.int(2)));
  return lang;
}
// A dialect: the parent tongue after one to three regular sound changes, with a
// few lexicon words replaced outright.
function deriveLanguage(world, parent, key) {
  if (parent.legacy) return { ...legacyLanguage(key), parentId: parent.id };
  const r = makeRng(hashParts(world.seedHash, "dialect", key), "dialect"),
    shifts = [],
    count = 1 + r.int(3);
  for (let n = 0; n < count; n++) {
    const pair = LANGUAGE_SHIFTS[r.int(LANGUAGE_SHIFTS.length)];
    shifts.push(r.next() < 0.5 ? [pair[0], pair[1]] : [pair[1], pair[0]]);
  }
  const apply = (word) => {
      let w = word;
      for (const [from, to] of shifts) w = w.split(from).join(to);
      return w;
    },
    unique = (list) => list.filter((x, i, a) => x && a.indexOf(x) === i),
    lang = {
      id: String(key),
      legacy: false,
      parentId: parent.id,
      name: "",
      consonants: unique(parent.consonants.map(apply)),
      vowels: unique(parent.vowels.map(apply)),
      codas: unique(parent.codas.map(apply)),
      onsets: unique((parent.onsets || []).map(apply)),
      linkers: (parent.linkers || ["n", "r"]).slice(),
      patterns: parent.patterns.slice(),
      style: {
        ...parent.style,
        glue: r.next() < 0.3 ? ["", "-", " "][r.int(3)] : parent.style.glue,
      },
      shifts,
      lexicon: {},
    };
  if (!lang.consonants.length) lang.consonants = parent.consonants.slice();
  if (!lang.vowels.length) lang.vowels = parent.vowels.slice();
  for (const [concept, words] of Object.entries(parent.lexicon))
    lang.lexicon[concept] = words.map((w) =>
      r.next() < 0.3 ? langWord(lang, r, 1 + r.int(2)) : apply(w),
    );
  lang.name = titleWord(apply(parent.name.toLowerCase()));
  if (lang.name === parent.name) lang.name = titleWord(langWord(lang, r, 2));
  return lang;
}
// Pure lookups never write the world, so rendering may call them freely.
function protoLanguageOf(world = W) {
  if (!world) return legacyLanguage("proto");
  return (
    world.protoLanguage ||
    (canonicalPlanetSeed(world.seed) ? legacyLanguage("proto") : makeLanguage(world, "proto"))
  );
}
function cultureLanguage(cultureId, world = W) {
  const culture = world.cultures.find((c) => c.id === cultureId);
  return culture?.language || deriveLanguage(world, protoLanguageOf(world), `culture-${cultureId}`);
}
function languageOf(culture) {
  return culture ? culture.language || cultureLanguage(culture.id) : protoLanguageOf(W);
}
// Simulation paths store what they derive so saves carry the tongues.
function ensureLanguages(world = W) {
  if (!world) return;
  if (!world.protoLanguage) world.protoLanguage = protoLanguageOf(world);
  for (const c of world.cultures || []) if (!c.language) c.language = cultureLanguage(c.id, world);
}
const restoreWorldLanguagesBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldLanguagesBase();
  ensureLanguages(W);
};
// ── Naming ─────────────────────────────────────────────────────────────────────
function compoundName(lang, root, suffix) {
  if (lang.legacy) return `${titleWord(root)}${suffix}`;
  if (root.length + suffix.length > 11) root = root.slice(0, Math.max(3, 11 - suffix.length));
  const glue = lang.style.glue;
  if (glue === " ") return `${titleWord(root)} ${titleWord(suffix)}`;
  if (glue === "-") return `${titleWord(root)}-${suffix}`;
  if (glue === "'") return `${titleWord(root)}'${suffix}`;
  return titleWord(root + suffix);
}
function lexiconWord(lang, concept, rng) {
  const words = lang.lexicon[concept] || LEGACY_LEXICON[concept];
  return words[rng.int(words.length)];
}
function tileLanguage(tile) {
  const s = tile >= 0 ? nearestSettlement(tile, 10) : null,
    culture = s?.cultureId ? W.cultures.find((c) => c.id === s.cultureId) : null;
  return culture ? languageOf(culture) : protoLanguageOf(W);
}
function personLanguage(parents, tile) {
  const parentCulture = parents[0] ? W.components.social[parents[0]]?.cultureId || 0 : 0,
    culture = parentCulture ? W.cultures.find((c) => c.id === parentCulture) : null;
  return culture ? languageOf(culture) : tileLanguage(tile);
}
function familyName(lang, kinGroupId) {
  if (lang.legacy) return NAME_B[hashParts(W.seedHash, "family", kinGroupId) % NAME_B.length];
  const r = makeRng(hashParts(W.seedHash, "family", lang.id, kinGroupId), "family");
  return titleWord(langWord(lang, r, 1 + r.int(2)));
}
function personName(lang, rng, kinGroupId) {
  const given = lang.legacy
    ? NAME_A[rng.int(NAME_A.length)]
    : titleWord(langWord(lang, rng, 1 + rng.int(2) + (rng.next() < 0.2 ? 1 : 0)));
  return `${given} ${familyName(lang, kinGroupId)}`;
}
function organismName(kind, rng, parents, tile, id) {
  ensureLanguages();
  if (kind !== KINDS.PERSON) {
    const lang = protoLanguageOf(W);
    return lang.legacy ? generatedName(rng, false) : titleWord(langWord(lang, rng, 2));
  }
  const kinGroupId = parents[0] ? W.components.social[parents[0]]?.kinGroupId || id : id;
  return personName(personLanguage(parents, tile), rng, kinGroupId);
}
function campName(tile, rng) {
  ensureLanguages();
  const lang = tileLanguage(tile);
  if (lang.legacy) return `${NAME_B[rng.int(NAME_B.length)]}${lexiconWord(lang, "camp", rng)}`;
  return compoundName(lang, langWord(lang, rng, 1 + rng.int(2)), lexiconWord(lang, "camp", rng));
}
function settlementName(camp, rng) {
  ensureLanguages();
  const founderCulture = camp?.founderId ? W.components.social[camp.founderId]?.cultureId || 0 : 0,
    culture = founderCulture ? W.cultures.find((c) => c.id === founderCulture) : null,
    lang = culture ? languageOf(culture) : tileLanguage(camp ? idx(camp.x, camp.y) : -1);
  if (lang.legacy) return `${NAME_B[rng.int(NAME_B.length)]}${lexiconWord(lang, "town", rng)}`;
  return compoundName(lang, langWord(lang, rng, 1 + rng.int(2)), lexiconWord(lang, "town", rng));
}
function polityName(lang, rng) {
  if (lang.legacy)
    return `The ${NAME_B[rng.int(NAME_B.length)]} ${lexiconWord(lang, "polity", rng)}`;
  return `${titleWord(langWord(lang, rng, 2))} ${titleWord(lexiconWord(lang, "polity", rng))}`;
}
function cultureName(lang, rng) {
  if (lang.legacy) return `${NAME_B[rng.int(NAME_B.length)]} ${lexiconWord(lang, "culture", rng)}`;
  return `${titleWord(langWord(lang, rng, 2))} ${titleWord(lexiconWord(lang, "culture", rng))}`;
}
function artifactName(lang, rng) {
  if (lang.legacy) return `${NAME_B[rng.int(NAME_B.length)]} ${lexiconWord(lang, "artifact", rng)}`;
  return `${titleWord(langWord(lang, rng, 1 + rng.int(2)))} ${titleWord(lexiconWord(lang, "artifact", rng))}`;
}
function entityLanguage(id) {
  const cultureId = W.components.social[id]?.cultureId || 0,
    culture = cultureId ? W.cultures.find((c) => c.id === cultureId) : null;
  return culture ? languageOf(culture) : protoLanguageOf(W);
}
function speciesName(kind, lineage) {
  const lang = protoLanguageOf(W),
    n = hashParts(W.seedHash, lineage),
    concept = kind === KINDS.PREDATOR ? "hunter" : kind === KINDS.HERBIVORE ? "grazer" : "folk";
  if (lang.legacy) return `${NAME_B[n % NAME_B.length]} ${LEGACY_LEXICON[concept][n % 3]}`;
  const r = makeRng(hashParts(W.seedHash, "species-word", lineage), "species"),
    words = lang.lexicon[concept];
  return `${titleWord(langWord(lang, r, 1 + r.int(2)))} ${titleWord(words[n % words.length])}`;
}
// ── Legends and World tab ──────────────────────────────────────────────────────
function languageSamples(lang, count = 5) {
  const r = makeRng(hashParts(W.seedHash, "sample", lang.id), "sample");
  return Array.from({ length: count }, () => titleWord(langWord(lang, r, 1 + r.int(3))));
}
function cultureLegendExtras(c) {
  const lang = languageOf(c);
  if (lang.legacy)
    return `<div class="kv"><span>Tongue</span><b>Common, the founding speech</b></div>`;
  return `<div class="kv"><span>Tongue</span><b>${esc(lang.name)}${lang.parentId ? " · a dialect of the first tongue" : ""}</b><span>Sounds</span><b>${esc(lang.consonants.join(" "))} · ${esc(lang.vowels.join(" "))}</b><span>Sound changes</span><b>${
    lang.shifts?.length ? esc(lang.shifts.map(([a, b]) => `${a} to ${b}`).join(", ")) : "none"
  }</b><span>Words</span><b>${esc(languageSamples(lang).join(", "))}</b><span>For a polity</span><b>${esc(lang.lexicon.polity.map(titleWord).join(", "))}</b><span>For a town</span><b>${esc(lang.lexicon.town.map(titleWord).join(", "))}</b></div>`;
}
function firstTongueSummary() {
  const lang = protoLanguageOf(W);
  return lang.legacy ? "Common" : `${lang.name} · ${languageSamples(lang, 3).join(", ")}`;
}
window.ALIFE_LANGUAGE_DEBUG = Object.freeze({
  proto: () => protoLanguageOf(W),
  culture: (id) => cultureLanguage(id),
  samples: (id) => languageSamples(id ? cultureLanguage(id) : protoLanguageOf(W), 8),
  speciesName: (kind, lineage) => speciesName(kind, lineage),
});
