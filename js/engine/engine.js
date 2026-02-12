// js/engine/engine.js
import { makeQuestion as makeAddQuestion } from "./questions/addition.js";
import { makeQuestion as makeSubQuestion } from "./questions/subtraction.js";
import { makeQuestion as makeDivQuestion } from "./questions/division.js";
import { generateQuestion as makeMulQuestion, generateChoices as makeMulChoices } from "./questions/multiplication.js";

// Sécurité: clamp
function clampInt(n, min, max, fallback){
  n = Number(n);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function normalizeTables(tables){
  let arr = Array.isArray(tables) ? tables : [];
  arr = arr.map(n => Number(n)).filter(Number.isFinite);
  arr = arr.filter(n => n >= 0 && n <= 10);
  arr = Array.from(new Set(arr)).sort((a,b)=>a-b);
  return arr.length ? arr : [2,3,4,5,6,7,8,9,10];
}

function buildQuestion(exerciseType, settings){
  // fallback si jamais settings.type est utilisé
  const type = exerciseType || settings?.type || "add";

  if (type === "mul"){
    const safe = {
      ...settings,
      type: "mul",
      tables: normalizeTables(settings?.tables),
      choices: clampInt(settings?.choices, 3, 5, 3),
    };

    const qBase = makeMulQuestion(safe);          // {a,b,answer,text}
    const choices = makeMulChoices(qBase.answer, safe.choices);
    // ✅ pour un rendu UI simple (showExplain, badges, etc.)
    return { kind: "multiplication", ...qBase, choices };
  }

  // DIV
  if (type === "div"){
    const safe = {
      ...settings,
      type: "div",
      divisors: Array.isArray(settings?.divisors) ? settings.divisors : [2, 10],
      qMax: clampInt(settings?.qMax, 10, 999, 99),
      choices: clampInt(settings?.choices, 3, 5, 3),
    };

    const q = makeDivQuestion(safe);
    return q;
  }

  // ADD / SUB
  const safe = {
    ...settings,
    type,
    aMin: clampInt(settings?.aMin, 0, 999, 0),
    aMax: clampInt(settings?.aMax, 0, 999, type === "add" ? 10 : 69),
    bMin: clampInt(settings?.bMin, 0, 999, 0),
    bMax: clampInt(settings?.bMax, 0, 999, type === "add" ? 10 : 69),
    // réutilisé pour sub = "sans emprunt"
    noCarryUnits: !!settings?.noCarryUnits,
    choices: clampInt(settings?.choices, 3, 5, 3),
  };

  if (type === "sub"){
    const q = makeSubQuestion(safe);
    return q;
  }

  // default: add
  const q = makeAddQuestion(safe);
  return { ...q, text: `${q.a} + ${q.b}` };
}

export function createEngine({ exerciseType, settings, playersCount }){
  const n = Number(playersCount) || 1;

  const state = {
    exerciseType: exerciseType || settings?.type || "add",
    settings,
    players: Array.from({ length: n }, () => ({
      score: 0,
      ok: 0,
      no: 0,
      current: null,
      locked: false,
    })),
  };

  function nextQuestion(playerIndex){
    const p = state.players[playerIndex];
    if (!p) return null;

    p.locked = false;

    const q = buildQuestion(state.exerciseType, state.settings);
    p.current = q;

    return { type: "QUESTION", question: q };
  }

  function answer(playerIndex, picked){
    const p = state.players[playerIndex];
    if (!p || !p.current || p.locked) return null;

    p.locked = true;

    const q = p.current;
    const correct = (picked === q.answer);

    if (correct){
      p.ok += 1;
      p.score += 1;
    } else {
      p.no += 1;
    }

    return {
      type: "ANSWERED",
      correct,
      correctAnswer: q.answer,
      picked,
      stats: { score: p.score, ok: p.ok, no: p.no },
      question: q,
    };
  }

  return {
    state,
    nextQuestion,
    answer,
  };
}
