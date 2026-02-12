// js/engine/questions/multiplication.js
import { randInt } from "../rng.js";

function normalizeTables(tables){
  let arr = Array.isArray(tables) ? tables : [];
  arr = arr.map(n => Number(n)).filter(Number.isFinite);
  arr = arr.filter(n => n >= 0 && n <= 10);
  arr = Array.from(new Set(arr)).sort((a,b)=>a-b);
  return arr.length ? arr : [2,3,4,5,6,7,8,9,10];
}

export function generateQuestion(settings){
  const tables = normalizeTables(settings?.tables);
  const table = tables[randInt(0, tables.length - 1)];
  const factor = randInt(0, 10); // ✅ on garde 0..10 (CE1)
  const answer = table * factor;

  return {
    a: table,
    b: factor,
    answer,
    text: `${table} × ${factor}`,
  };
}

export function generateChoices(answer, count){
  // Sécurité anti-NaN (sinon boucle infinie)
  if (!Number.isFinite(answer)){
    return [0, 1, 2].slice(0, count || 3);
  }

  const n = Number(count) || 3;
  const choices = new Set([answer]);

  let guard = 0;
  while (choices.size < n && guard < 500){
    guard++;
    const type = randInt(1, 5);
    let fake = answer;

    if (type === 1) fake = answer + randInt(-2, 2);
    if (type === 2) fake = answer + randInt(-10, 10);
    if (type === 3) fake = answer + (Math.random() < 0.5 ? -1 : 1) * 5;
    if (type === 4) fake = answer + (Math.random() < 0.5 ? -1 : 1) * 9;
    if (type === 5) fake = answer + (Math.random() < 0.5 ? -1 : 1) * randInt(1, 12);

    if (!Number.isFinite(fake)) continue;
    if (fake < 0) continue;

    choices.add(fake);
  }

  // fallback si jamais
  const arr = Array.from(choices);
  while (arr.length < n) arr.push(answer + arr.length + 1);

  return arr.sort(() => Math.random() - 0.5);
}

export function makeSkillLabel(settings){
  const tables = normalizeTables(settings?.tables);
  return `Multiplication • tables: ${tables.join(", ")} • ${settings?.choices || 3} choix`;
}
