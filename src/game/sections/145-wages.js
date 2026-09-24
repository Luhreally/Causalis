// ═══════════════════════════════════════════════════════════════════════════
// 145. WAGES — the hands are paid for the time they work, and the rent follows
// the pay
// ═══════════════════════════════════════════════════════════════════════════
// Rent came with Coinage (121) and coin did not come with it. A person held a
// coin only when the polity hired hands at a civic site, its treasury past
// sixty, and paid three coin to whoever the lot fell on (121, hireHands), so a
// town that struck coin charged every household a coin a year and almost no
// one could pay. Measured without the Causal skip at year seventy: battery
// variety-2 held 94 households, 79 of them behind on the rent, and not one
// person with a coin, so the landlord of 121 never found a household to let
// the flat to either and every renter sat in arrears for ever.
//
// Wages now. Every tick a person of a town whose polity strikes coin spends
// at a task (the work face, the field, the mine, the haul, the loom, the
// watch; setWorkAction is the one door every task goes through) is counted,
// and once a year, before the rent, the polity pays each of them a coin for
// every WAGE_STEPS_PER_COIN ticks worked, more for the skilled: a master of
// any craft is paid half again. Measured on four worlds between years
// fifty-five and fifty-eight: grown townspeople work a median of 140 to 190
// ticks of the year's 256, the quietest tenth under 45, the old nearly as
// much as the young; at ninety ticks a coin the median worker is paid two
// coin a year and the quietest nothing. The coin is struck for the purpose:
// the treasury is a number and not matter (89), and paying wages from it
// emptied it in a year when it was tried (the comment in 121's accounts).
//
// And the rent follows the pay, by the bed. A coin a household was nothing to
// a town of earners and everything to a town of none. A household's rent is
// now half the wage the town paid a head the year before for every one of its
// members under the roof (RENT_SHARE), a coin at least, so a household with
// more mouths than hands falls behind and one with two busy hands saves. A
// first cut asked a share of the median household's pay whatever the
// household's size, and a village of large households of earners asked
// twenty-six coin of everyone in it (variety-2 on phone, year eighty),
// putting out eighteen households in five years. Arrears are kept in coin and
// the landlord's line of 121 is four years of the household's rent. Rent is
// taken from the household's purse as a whole, the head's first and then the
// others', where 121 took it from the head alone and a household of grown
// children whose father had stopped working sat in arrears with coin in its
// pockets.
const WAGE_STEPS_PER_COIN = 90,
  WAGE_MASTER_PREMIUM = 0.5,
  RENT_SHARE = 0.5,
  RENT_FLOOR = 1,
  WAGES = { steps: 0, paid: 0, minted: 0, earners: 0, idle: 0 };
let WAGE_POLITIES = { world: null, tick: -1, set: new Set() };
function wagePolities() {
  if (WAGE_POLITIES.world === W && WAGE_POLITIES.tick === W.tick) return WAGE_POLITIES.set;
  const set = new Set();
  for (const f of W.factions) if (f.stability > 0 && polityCoins(f)) set.add(f.id);
  WAGE_POLITIES = { world: W, tick: W.tick, set };
  return set;
}
// Counted once a tick, and only under coin: a world without it writes nothing,
// so the eight years the baseline hash reads are the same as before.
const setWorkActionWagesBase = setWorkAction;
setWorkAction = function (id, task, ...rest) {
  if (W?.kind?.[id] === KINDS.PERSON) {
    const w = W.components.work?.[id];
    if (!w || w.handledTick !== W.tick) {
      const soc = W.components.social[id];
      if (
        soc?.factionId &&
        soc.homePlaceKind === "settlement" &&
        wagePolities().has(soc.factionId)
      ) {
        const ident = W.components.identity[id];
        if (ident) {
          ident.workSteps = (ident.workSteps || 0) + 1;
          WAGES.steps++;
        }
      }
    }
  }
  return setWorkActionWagesBase(id, task, ...rest);
};
// A master of any craft is paid half again; an adept a quarter.
function wageRate(id) {
  const skills = W.components.identity[id]?.skills;
  let best = 0;
  if (skills) for (const k of SKILL_KEYS) best = Math.max(best, skills[k] || 0);
  return 1 + WAGE_MASTER_PREMIUM * clamp(best / 75, 0, 1);
}
// The year's wages for one town, paid before its rent. Returns what was paid.
function payWages(town) {
  const year = Math.floor(W.tick / TICKS_PER_YEAR),
    faction = polityOfPlace(town);
  // Nothing is written to a town whose polity strikes no coin: the first eight
  // years, which the baseline hash reads, are the same as before.
  if (!faction || !polityCoins(faction)) return 0;
  if (town.wagesYear === year) return town.wages?.paid || 0;
  town.wagesYear = year;
  const residents = habitationResidents(town),
    byHousehold = new Map();
  let paid = 0,
    earners = 0;
  for (const id of residents) {
    const ident = W.components.identity[id];
    if (!ident) continue;
    const steps = ident.workSteps || 0,
      earned = (steps / WAGE_STEPS_PER_COIN) * wageRate(id) + (ident.wageCarry || 0),
      coin = Math.floor(earned);
    ident.workSteps = 0;
    ident.wageCarry = +(earned - coin).toFixed(3);
    if (coin > 0) {
      ident.civicCoins = (ident.civicCoins || 0) + coin;
      ident.wageLast = coin;
      paid += coin;
      earners++;
    } else ident.wageLast = 0;
    const household = W.components.social[id]?.householdId || id;
    byHousehold.set(household, (byHousehold.get(household) || 0) + coin);
  }
  const incomes = [...byHousehold.values()].sort((a, b) => a - b),
    median = incomes.length ? incomes[Math.floor(incomes.length / 2)] : 0;
  town.wages = {
    year,
    paid,
    earners,
    residents: residents.length,
    households: incomes.length,
    householdMedian: median,
    idleHouseholds: incomes.filter((v) => v === 0).length,
    top: incomes.at(-1) || 0,
  };
  W.markets = W.markets || {};
  W.markets.minted = (W.markets.minted || 0) + paid;
  WAGES.paid += paid;
  WAGES.minted += paid;
  WAGES.earners += earners;
  WAGES.idle += residents.length - earners;
  return paid;
}
function wageRentPerBed(town) {
  const w = town?.wages;
  return w && w.residents ? (RENT_SHARE * w.paid) / w.residents : 0;
}
const habitationRentWagesBase = habitationRent;
habitationRent = function (b, town, members = 1) {
  const base = habitationRentWagesBase(b, town, members);
  return Math.max(base, RENT_FLOOR, Math.round(wageRentPerBed(town) * Math.max(1, members)));
};
// A let home is taken with its first year's rent in hand: a household that
// holds no coin does not get a flat because one stands empty. A cottage nobody
// owns is a homestead and free (121), a home the household itself owns is its
// own, and a town that strikes no coin lets as it always did.
const habitationMayTakeWagesBase = habitationMayTake;
habitationMayTake = function (town, b, group) {
  if (!habitationMayTakeWagesBase(town, b, group)) return false;
  const faction = polityOfPlace(town);
  if (!faction || !polityCoins(faction)) return true;
  const t = b.tenancy;
  if (b.type === "shelter" && !t?.ownerId) return true;
  if (t?.ownerId && group.includes(t.ownerId)) return true;
  const purse = group.reduce(
    (n, id) => n + Math.max(0, W.components.identity[id]?.civicCoins || 0),
    0,
  );
  return purse >= Math.max(1, habitationRent(b, town, group.length));
};
const habitationAccountsWagesBase = habitationAccounts;
habitationAccounts = function (town, homes) {
  if (town && !town.ruined) payWages(town);
  return habitationAccountsWagesBase(town, homes);
};
// ── What the town and the person say ─────────────────────────────────────────
pageBlock("place", '<div class="subhead">Homes and households</div>', function (id) {
  const town = W.settlements.find((s) => s.id === id),
    w = town?.wages;
  if (!w) return "";
  const perBed = wageRentPerBed(town),
    row = `<div class="kv"><span>Wages</span><b>${w.paid} coin to ${w.earners} of ${w.residents} hands · a household earns ${w.householdMedian} at the middle, ${w.top} at the top, ${w.idleHouseholds} earn nothing · rent ${perBed.toFixed(1)} a bed a year, a coin at least</b></div>`;
  return row;
});
const renderLifePageWagesBase = renderLifePage;
renderLifePage = function (id) {
  const html = renderLifePageWagesBase(id),
    ident = W.components.identity[id];
  if (ident?.wageLast == null) return html;
  return (
    html +
    `<div class="kv"><span>Last year's wage</span><b>${ident.wageLast} coin${wageRate(id) > 1.05 ? ` · paid ${Math.round((wageRate(id) - 1) * 100)}% over for skill` : ""}</b></div>`
  );
};
window.ALIFE_WAGES_DEBUG = Object.freeze({
  counts: () => ({ ...WAGES }),
  polities: () => [...wagePolities()],
  pay: (placeId) => payWages(W.settlements.find((s) => s.id === placeId)),
  rate: (id) => wageRate(id),
  rent: (placeId, members = 1) =>
    habitationRent(
      null,
      W.settlements.find((s) => s.id === placeId),
      members,
    ),
  perBed: (placeId) => wageRentPerBed(W.settlements.find((s) => s.id === placeId)),
  town: (placeId) => ({ ...(W.settlements.find((s) => s.id === placeId)?.wages || {}) }),
  stepsPerCoin: () => WAGE_STEPS_PER_COIN,
});
