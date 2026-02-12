import { randInt } from "../rng.js";

export function makeSkillLabel(s) {
  return `Addition ${s.aMin}–${s.aMax} + ${s.bMin}–${s.bMax} • ${s.noCarryUnits ? "sans retenue unités" : "avec retenue"} • ${s.choices} choix`;
}

export function makeQuestion(settings) {
  const { aMin, aMax, bMin, bMax, noCarryUnits, choices } = settings;

  let a, b, guard = 0;
  do {
    a = randInt(aMin, aMax);
    b = randInt(bMin, bMax);
    guard++;
    if (guard > 2000) break;
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
    choices: Array.from(set).sort(() => Math.random() - 0.5),
  };
}
