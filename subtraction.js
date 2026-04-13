// js/engine/questions/division.js
import { randInt } from "../rng.js";

function normalizeDivisors(divs){
  let arr = Array.isArray(divs) ? divs : [];
  arr = arr.map(Number).filter(Number.isFinite);
  arr = arr.filter(n => n === 2 || n === 10); // CE1: ÷2 ou ÷10
  arr = Array.from(new Set(arr)).sort((a,b)=>a-b);
  return arr.length ? arr : [2, 10];
}

export function makeSkillLabel(s) {
  const divisors = normalizeDivisors(s?.divisors);
  const qMax = Number(s?.qMax ?? 99);
  return `Division • ${divisors.map(d => `÷${d}`).join(" ")} • résultat 0–${qMax} • ${s?.choices || 3} choix`;
}

export function makeQuestion(settings) {
  const divisors = normalizeDivisors(settings?.divisors);
  const qMaxWanted = Number(settings?.qMax ?? 99);
  const qMax = Number.isFinite(qMaxWanted) ? Math.max(1, Math.trunc(qMaxWanted)) : 99;

  const divisor = divisors[randInt(0, divisors.length - 1)];

  // Pour rester CE1 friendly: on garde un dividende <= 999 (sans virgule)
  const safeQMax = Math.max(1, Math.min(qMax, Math.floor(999 / divisor)));
  const quotient = randInt(0, safeQMax);
  const dividend = divisor * quotient;

  const answer = quotient;

  const choicesCount = Math.max(3, Math.min(5, Number(settings?.choices || 3)));

  const set = new Set([answer]);
  let guard = 0;
  while (set.size < choicesCount && guard < 600){
    guard++;
    let fake = answer + randInt(-10, 10);
    if (fake < 0) continue;
    set.add(fake);
  }

  return {
    kind: "division",
    a: dividend,
    b: divisor,
    answer,
    text: `${dividend} ÷ ${divisor}`,
    choices: Array.from(set).sort(() => Math.random() - 0.5),
  };
}
