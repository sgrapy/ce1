// js/engine/questions/subtraction.js
import { randInt } from "../rng.js";

export function makeSkillLabel(s) {
  const noBorrow = !!s.noCarryUnits;
  return `Soustraction ${s.aMin}–${s.aMax} − ${s.bMin}–${s.bMax} • ${noBorrow ? "sans emprunt unités" : "avec emprunt"} • ${s.choices} choix`;
}

export function makeQuestion(settings) {
  const { aMin, aMax, bMin, bMax, noCarryUnits, choices } = settings;

  let a, b, guard = 0;
  do {
    a = randInt(aMin, aMax);
    b = randInt(bMin, bMax);
    // on évite les nombres négatifs en CE1
    if (b > a) {
      const t = a; a = b; b = t;
    }
    guard++;
    if (guard > 3000) break;
  } while (noCarryUnits && ((a % 10) < (b % 10)));

  const answer = a - b;

  const set = new Set([answer]);
  while (set.size < choices) {
    const fake = answer + randInt(-10, 10);
    if (fake >= 0 && fake !== answer) set.add(fake);
  }

  return {
    kind: "subtraction",
    a, b,
    answer,
    text: `${a} - ${b}`,
    choices: Array.from(set).sort(() => Math.random() - 0.5),
  };
}
