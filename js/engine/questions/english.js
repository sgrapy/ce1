// js/engine/questions/english.js
// Anglais CE1 : couleurs (mode couleur / mode son)

// hueDeg : utilisé pour colorer les ballons via hue-rotate()
const COLORS = [
  { en: "Red", fr: "Rouge", hex: "#ef4444", hueDeg: 0 },
  { en: "Orange", fr: "Orange", hex: "#fb923c", hueDeg: 28 },
  { en: "Yellow", fr: "Jaune", hex: "#facc15", hueDeg: 55 },
  { en: "Green", fr: "Vert", hex: "#22c55e", hueDeg: 120 },
  { en: "Blue", fr: "Bleu", hex: "#3b82f6", hueDeg: 210 },
  { en: "Purple", fr: "Violet", hex: "#a855f7", hueDeg: 270 },
  { en: "Pink", fr: "Rose", hex: "#f472b6", hueDeg: 320 },
  { en: "Brown", fr: "Marron", hex: "#8b5a2b", hueDeg: 25 },
  { en: "Black", fr: "Noir", hex: "#111827", hueDeg: 0 },
  { en: "White", fr: "Blanc", hex: "#f8fafc", hueDeg: 0 },
];

function randInt(n){
  return Math.floor(Math.random() * n);
}

function sampleDistinct(arr, k, exclude){
  const pool = arr.filter(x => x !== exclude);
  const out = [];
  while (out.length < k && pool.length){
    const i = randInt(pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

function shuffle(a){
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function makeQuestion(settings){
  const choicesCount = Math.max(3, Math.min(5, Number(settings?.choices || 3)));
  const mode = settings?.enMode || "color"; // color | sound
  const answerStyle = settings?.enAnswerStyle || "text"; // text | color

  const correct = COLORS[randInt(COLORS.length)];
  const distractors = sampleDistinct(COLORS, choicesCount - 1, correct);
  const choiceObjs = shuffle([correct, ...distractors]);
  const choices = choiceObjs.map(c => c.en);
  const choiceHues = choiceObjs.map(c => Number.isFinite(c.hueDeg) ? c.hueDeg : 0);

  // UI prompt
  if (mode === "sound"){
    const prompt = (answerStyle === "color")
      ? "🔊 Écoute et choisis la bonne couleur"
      : "🔊 Écoute et choisis le bon mot";
    return {
      kind: "english",
      mode: "sound",
      answerStyle,
      answer: correct.en,
      choices,
      choiceHues,
      say: correct.en,
      text: prompt,
      // utilisé pour l'affichage (HTML dans main.js)
      html: `
        <div class="en-q">
          <button class="en-sound" type="button" data-say="${correct.en}" title="Réécouter">🔊</button>
          <div class="en-qtext">${answerStyle === "color" ? "Écoute et choisis la bonne couleur" : "Écoute et choisis le bon mot"}</div>
        </div>
      `,
    };
  }

  // mode couleur
  return {
    kind: "english",
    mode: "color",
    answerStyle: "text",
    answer: correct.en,
    choices,
    choiceHues,
    colorHex: correct.hex,
    fr: correct.fr,
    text: "🎨 Regarde la couleur",
    html: `
      <div class="en-q">
        <div class="en-swatch" style="--c:${correct.hex}" aria-label="couleur"></div>
        <div class="en-qtext">Choisis le bon mot en anglais</div>
      </div>
    `,
  };
}

export function makeSkillLabel(settings){
  const mode = settings?.enMode || "color";
  return mode === "sound" ? "🇬🇧 Couleurs (son)" : "🇬🇧 Couleurs";
}
