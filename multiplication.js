import { randInt } from "../rng.js";

function normalizePlaces(arr){
  let a = Array.isArray(arr) ? arr.slice() : [];
  a = a.map(String);
  a = a.filter(x => ["units", "tens", "hundreds"].includes(x));
  a = Array.from(new Set(a));
  return a.length ? a : ["units", "tens", "hundreds"];
}

function pickStepB({ bMin, bMax, mentalPlaces }){
  const places = normalizePlaces(mentalPlaces);

  const candidates = [];

  // units: 1..9
  if (places.includes("units")){
    const lo = Math.max(1, bMin);
    const hi = Math.min(9, bMax);
    if (lo <= hi) candidates.push(() => randInt(lo, hi));
  }

  // tens: 10..90 by 10
  if (places.includes("tens")){
    const lo = Math.max(10, bMin);
    const hi = Math.min(90, bMax);
    const lo10 = Math.ceil(lo / 10) * 10;
    const hi10 = Math.floor(hi / 10) * 10;
    if (lo10 <= hi10) candidates.push(() => randInt(lo10 / 10, hi10 / 10) * 10);
  }

  // hundreds: 100..900 by 100
  if (places.includes("hundreds")){
    const lo = Math.max(100, bMin);
    const hi = Math.min(900, bMax);
    const lo100 = Math.ceil(lo / 100) * 100;
    const hi100 = Math.floor(hi / 100) * 100;
    if (lo100 <= hi100) candidates.push(() => randInt(lo100 / 100, hi100 / 100) * 100);
  }

  if (!candidates.length){
    return randInt(bMin, bMax);
  }

  const fn = candidates[randInt(0, candidates.length - 1)];
  return fn();
}

export function makeSkillLabel(s) {
  const mental = !!s.mentalMode;
  const places = normalizePlaces(s.mentalPlaces);
  const mentalLabel = mental ? ` • mental: ${places.map(p => (p === "units" ? "U" : p === "tens" ? "D" : "C")).join("")}` : "";
  return `Addition ${s.aMin}–${s.aMax} + ${s.bMin}–${s.bMax}${mentalLabel} • ${s.noCarryUnits ? "sans retenue unités" : "avec retenue"} • ${s.choices} choix`;
}

export function makeQuestion(settings) {
  const {
    aMin, aMax,
    bMin, bMax,
    noCarryUnits,
    choices,
    mentalMode,
    mentalPlaces
  } = settings;

  let a, b, guard = 0;

  do {
    if (mentalMode){
      b = pickStepB({ bMin, bMax, mentalPlaces });

      // CE1: on garde un résultat <= 999 si possible
      const maxA = Math.min(aMax, 999 - b);
      if (maxA < aMin){
        // b trop grand -> on retente
        guard++;
        continue;
      }
      a = randInt(aMin, maxA);
    } else {
      a = randInt(aMin, aMax);
      b = randInt(bMin, bMax);
    }

    guard++;
    if (guard > 2500) break;

  } while (noCarryUnits && (a % 10 + b % 10 > 9));

  const answer = a + b;

  const set = new Set([answer]);
  while (set.size < choices) {
    const fake = answer + randInt(-10, 10);
    if (fake >= 0 && fake !== answer) set.add(fake);
  }

  return {
    kind: "addition",
    a, b,
    answer,
    text: `${a} + ${b}`,
    choices: Array.from(set).sort(() => Math.random() - 0.5),
  };
}
