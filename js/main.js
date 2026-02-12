// js/main.js
import { $ } from "./ui/dom.js";
import { getBalloonCenter, addConfetti, addPoof } from "./ui/fx.js";
import { renderMathSettings, readSelectedTables, readSelectedDivisors } from "./ui/mathsettings.js";

import { showMenu, showGame, showEnglish } from "./ui/screens.js";
import { renderGrid } from "./ui/grid.js";
import { renderBalloons } from "./ui/balloons.js";
import { renderKeypad, setKeypadVisible, setKeypadLocked } from "./ui/keypad.js";
import { renderPlayerInputs, readPlayerNames, readPlayerTeams, readPlayerBgs } from "./ui/menu.js";
import { renderAdditionBase10Explanation } from "./ui/additionBase10Explain.js";

import { loadPrefs, savePrefs, resetPrefs } from "./storage/prefs.js";
import { loadStatsStore, addSessionToStore, resetStatsStore, formatDateShort } from "./storage/stats.js";

import { createEngine } from "./engine/engine.js";
import { makeSkillLabel as makeAddLabel } from "./engine/questions/addition.js";
import { makeSkillLabel as makeSubLabel } from "./engine/questions/subtraction.js";
import { makeSkillLabel as makeMulLabel } from "./engine/questions/multiplication.js";
import { makeSkillLabel as makeDivLabel } from "./engine/questions/division.js";
import { makeSkillLabel as makeEngLabel } from "./engine/questions/english.js";

// ------------------------------------------------------------
// Mode prof (header)
// ------------------------------------------------------------
function openProfModal(){
  const m = $("profModal");
  if (!m) return;
  m.classList.remove("hidden");
  m.setAttribute("aria-hidden", "false");
}

function closeProfModal(){
  const m = $("profModal");
  if (!m) return;
  m.classList.add("hidden");
  m.setAttribute("aria-hidden", "true");
}


// ------------------------------------------------------------
// Layout
// ------------------------------------------------------------
function layoutFor(profile, playersCount){
  const n = Number(playersCount);
  if (profile === "laptop") return n <= 2 ? { rows: 1, cols: n } : { rows: 2, cols: 2 };
  if (profile === "mobile") return n <= 2 ? { rows: n, cols: 1 } : { rows: 2, cols: 2 };
  return { rows: 1, cols: n }; // tni default
}

let ENGINE = null;
let GAME_RUNNING = false;
let SESSION = null;

// ------------------------------------------------------------
// Modals
// ------------------------------------------------------------
function openModal(id){
  $(id)?.classList.remove("hidden");
}
function closeModal(id){
  $(id)?.classList.add("hidden");
}
// (wiring fait dans DOMContentLoaded plus bas)

function wireModalBackdrops(){
  document.querySelectorAll(".modal-backdrop[data-close='1']").forEach(backdrop => {
    backdrop.addEventListener("click", () => {
      const modal = backdrop.closest(".modal");
      modal?.classList.add("hidden");

      // Si on ferme les résultats, on revient au menu (la partie est finie)
      if (modal?.id === "resultsModal" && !GAME_RUNNING){
        showMenu();
      }
    });
  });
}

// ------------------------------------------------------------
// Round timer (HUD)
// ------------------------------------------------------------
let roundTimerId = null;

function stopRoundTimer(){
  if (roundTimerId) clearInterval(roundTimerId);
  roundTimerId = null;
}

function startHudClock(){
  stopRoundTimer();

  const hudTimer = $("hudTimer");
  const startEpoch = Date.now();

  roundTimerId = setInterval(() => {
    if (!GAME_RUNNING || !SESSION) return;

    const elapsedSec = Math.max(0, Math.floor((Date.now() - startEpoch) / 1000));

    if (SESSION.gameMode === "time"){
      const left = Math.max(0, SESSION.durationSec - elapsedSec);
      if (hudTimer) hudTimer.textContent = `⏱ ${left}s`;

      if (left <= 0){
        endGame({ reason: "time" });
      }
      return;
    }

    // Mode course: on affiche le chrono + objectif
    if (hudTimer){
      hudTimer.textContent = `🏁 ${SESSION.raceTarget} pts • ⏱ ${elapsedSec}s`;
    }
  }, 1000);
}

// ------------------------------------------------------------
// Timers par joueur (ballons)
// ------------------------------------------------------------
let qTimers = [];

// ------------------------------------------------------------
// Anglais (mode son) : round synchronisé (même mot pour tous)
// ------------------------------------------------------------
let EN_SYNC = {
  active: false,
  ready: [],
  roundTimerId: null,
};

function isEnglishSoundSync(){
  const s = ENGINE?.state?.settings || SESSION?.settingsSnapshot || {};
  return SESSION?.exerciseType === "eng"
    && s.enMode === "sound"
    && !!s.enSyncSound;
}

function stopEnglishRoundTimer(){
  if (EN_SYNC.roundTimerId) clearTimeout(EN_SYNC.roundTimerId);
  EN_SYNC.roundTimerId = null;
}

function stopQuestionTimer(playerIndex){
  if (qTimers[playerIndex]) clearTimeout(qTimers[playerIndex]);
  qTimers[playerIndex] = null;
}
function stopAllQuestionTimers(){
  for (let i = 0; i < qTimers.length; i++) stopQuestionTimer(i);
}

// ------------------------------------------------------------
// FX helpers
// ------------------------------------------------------------
function freezeAtCurrentPosition(stage, el){
  const rect = el.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  const currentTop = rect.top - stageRect.top;

  el.style.animation = "none";
  el.style.top = currentTop + "px";
  el.style.bottom = "auto";
  el.style.transform = "none";
}

function explodeOne(stage, el, { good = false } = {}){
  if (!el) return;

  freezeAtCurrentPosition(stage, el);

  try{
    const pt = getBalloonCenter(stage, el);
    if (good) addConfetti(stage, pt.x, pt.y);
    else addPoof(stage, pt.x, pt.y);
  }catch(e){}

  el.classList.add(good ? "good" : "bad");
  el.classList.add("popping");
  setTimeout(() => el.remove(), 320);
}

function explodeAllExcept(stage, keepEls = []){
  const keep = new Set(keepEls.filter(Boolean));
  const balloons = Array.from(stage.querySelectorAll(".balloon"));
  for (const b of balloons){
    if (keep.has(b)) continue;
    explodeOne(stage, b, { good: false });
  }
}

// ------------------------------------------------------------
// Explanation / feedback
// ------------------------------------------------------------
function showExplain(playerIndex, question, res){
  const box = $("explain-" + playerIndex);
  if (!box) return;

  box.classList.remove("hidden");

  const isCorrect = !!res?.correct;
  const isExpert = !!SESSION?.expertMode;
  const showExplainOption = !!SESSION?.showExplain;

  const resultText = (question?.kind === "english")
    ? `✅ Réponse : <b>${question.answer}</b>`
    : (() => {
        const op = (question?.kind === "multiplication")
          ? "×"
          : (question?.kind === "division")
            ? "÷"
            : (question?.kind === "subtraction")
              ? "−"
              : "+";
        return `${question.a} ${op} ${question.b} = ${question.answer}`;
      })();

  // ✅ BONNE RÉPONSE → badge + étoiles + résultat
  if (isCorrect){
    box.innerHTML = `
      <div class="success-badge">
        🏅 Bien joué !
        <div class="success-result">${resultText}</div>
        <div class="stars">
          <span>⭐</span><span>⭐</span><span>⭐</span><span>⭐</span><span>⭐</span>
        </div>
      </div>
      <div class="tap-to-continue">🖱️ Clique pour continuer</div>
    `;
    return;
  }

  // ❌ MAUVAISE RÉPONSE sans explication (expert OU option décochée)
  if (isExpert || !showExplainOption){
    box.innerHTML = `
      <div class="explain-title">❌ Oups…</div>
      <div class="ce1-text">
        <p>La bonne réponse était : <b>${res?.correctAnswer ?? question?.answer ?? "—"}</b></p>
      </div>
      <div class="tap-to-continue">🖱️ Clique pour continuer</div>
    `;
    return;
  }

  // ❌ MAUVAISE RÉPONSE avec explication CE1
  if (question?.kind === "english"){
    box.innerHTML = `
      <div class="explain-title">🇬🇧 Couleurs</div>
      <div class="ce1-text">
        <p>La bonne réponse était : <b>${res?.correctAnswer ?? question?.answer ?? "—"}</b></p>
        <p>Tu peux cliquer sur 🔊 dans la question pour réécouter.</p>
      </div>
      <div class="tap-to-continue">🖱️ Clique pour continuer</div>
    `;
    return;
  }

  if (question?.kind === "addition"){
    renderAdditionBase10Explanation(question, box);
    box.insertAdjacentHTML("beforeend", `<div class="tap-to-continue">🖱️ Clique pour continuer</div>`);
    return;
  }

  if (question?.kind === "multiplication"){
    box.innerHTML = `
      <div class="explain-title">✖️ ${resultText}</div>
      <div class="ce1-text"><p>On peut lire : <b>${question.a}</b> répété <b>${question.b}</b> fois.</p></div>
      <div class="tap-to-continue">🖱️ Clique pour continuer</div>
    `;
    return;
  }

  // Fallback
  box.innerHTML = `
    <div class="explain-title">✅ Réponse : ${res?.correctAnswer ?? question?.answer ?? "—"}</div>
    <div class="tap-to-continue">🖱️ Clique pour continuer</div>
  `;
}

function hideExplain(playerIndex){
  const box = $("explain-" + playerIndex);
  if (!box) return;
  box.classList.add("hidden");
  box.innerHTML = "";
}

function waitTapToContinue(playerIndex, onContinue){
  const area = $("answer-" + playerIndex);
  if (!area) { onContinue?.(); return; }

  area.classList.add("tap-wait");

  const handler = () => {
    area.classList.remove("tap-wait");
    area.removeEventListener("click", handler);
    hideExplain(playerIndex);
    onContinue?.();
  };

  area.addEventListener("click", handler, { once: true });
}

function onQuestionTimeout(playerIndex){
  if (!GAME_RUNNING) return;

  const answerMode = SESSION?.answerMode || "mcq";
  const stage = $("stage-" + playerIndex);
  const pad = $("keypad-" + playerIndex);

  if (answerMode === "keypad"){
    setKeypadLocked(playerIndex, true);
    if (pad){
      addPoof(pad, pad.clientWidth / 2, Math.min(90, pad.clientHeight / 2));
    }
  } else {
    if (!stage) return;
    stage.classList.add("locked");
    explodeAllExcept(stage, []);
  }

  const box = $("explain-" + playerIndex);
  if (box){
    box.classList.remove("hidden");
    box.innerHTML = `
      <div class="explain-title">⏱ Temps écoulé</div>
      <div class="ce1-text"><p>On passe à la question suivante 😊</p></div>
      <div class="tap-to-continue">🖱️ Clique pour continuer</div>
    `;
  }

  waitTapToContinue(playerIndex, () => {
    if (!GAME_RUNNING) return;

    if (answerMode === "keypad"){
      setKeypadLocked(playerIndex, false);
      const fadeEl = pad || $("answer-" + playerIndex);
      fadeEl?.classList.add("stage-fade");
      setTimeout(() => {
        fadeEl?.classList.remove("stage-fade");
        startPlayer(playerIndex);
      }, 250);
      return;
    }

    stage?.classList.remove("locked");
    stage?.classList.add("stage-fade");
    setTimeout(() => {
      stage?.classList.remove("stage-fade");
      startPlayer(playerIndex);
    }, 250);
  });
}

// ------------------------------------------------------------
// Settings helpers
// ------------------------------------------------------------
function readExerciseSettings(exerciseType, durationSec){
  const choices = Number($("choices")?.value || 3);
  const qTimeSec = Number($("qTimeSec")?.value || 6);

  if (exerciseType === "add" || exerciseType === "sub"){
    const defaultMax = exerciseType === "add" ? 10 : 69;

    // Addition: option “calcul mental simplifié”
    const mentalMode = exerciseType === "add" ? !!$("mentalMode")?.checked : false;
    const mentalPlaces = exerciseType === "add"
      ? Array.from(document.querySelectorAll(".placeCheck"))
          .filter(c => c.checked)
          .map(c => c.value)
      : [];

    return {
      type: exerciseType,
      aMin: Number($("aMin")?.value ?? 0),
      aMax: Number($("aMax")?.value ?? defaultMax),
      bMin: Number($("bMin")?.value ?? 0),
      bMax: Number($("bMax")?.value ?? defaultMax),
      noCarryUnits: ($("noCarryUnits")?.value ?? "true") === "true",

      mentalMode,
      mentalPlaces,

      choices,
      qTimeSec,
      durationSec
    };
  }

  if (exerciseType === "mul"){
    return {
      type: "mul",
      tables: readSelectedTables(),
      choices,
      qTimeSec,
      durationSec
    };
  }

  if (exerciseType === "div"){
    return {
      type: "div",
      divisors: readSelectedDivisors(),
      qMax: Number($("qMax")?.value ?? 99),
      choices,
      qTimeSec,
      durationSec
    };
  }

  if (exerciseType === "eng"){
    return {
      type: "eng",
      enMode: $("enMode")?.value || "color",
      enSyncSound: $("enSyncSound")?.checked ?? true,
      enAnswerStyle: $("enAnswerStyle")?.value || "text",
      choices,
      qTimeSec,
      durationSec
    };
  }

  return {
    type: "add",
    aMin: 0, aMax: 10,
    bMin: 0, bMax: 10,
    noCarryUnits: true,
    mentalMode: false,
    mentalPlaces: ["units", "tens"],
    choices: 3,
    qTimeSec: 6,
    durationSec
  };
}

function makeHudSkill(exerciseType, settings, difficultyLevel = 0){
  const base = (exerciseType === "eng")
    ? makeEngLabel(settings)
    : (exerciseType === "mul")
      ? makeMulLabel(settings)
      : (exerciseType === "div")
        ? makeDivLabel(settings)
        : (exerciseType === "sub")
          ? makeSubLabel(settings)
          : makeAddLabel(settings);
  return difficultyLevel > 0 ? `${base} • 🎮 niveau ${difficultyLevel}` : base;
}

// ------------------------------------------------------------
// Session & stats (détaillées)
// ------------------------------------------------------------
function startSession({
  exerciseType,
  settings,
  playersCount,
  playerNames,
  gameMode,
  durationSec,
  raceTarget,
  showExplain,
  expertMode,
  teamMode,
  teamCount,
  playerTeams,
  autoDifficulty,
  answerMode
}){
  const startEpoch = Date.now();

  SESSION = {
    date: new Date(startEpoch).toISOString(),
    startEpoch,
    exerciseType,
    settingsSnapshot: JSON.parse(JSON.stringify(settings || {})),
    answerMode,
    gameMode,
    durationSec: Number(durationSec) || 60,
    raceTarget: Number(raceTarget) || 10,
    showExplain: !!showExplain,
    expertMode: !!expertMode,
    teamMode: !!teamMode,
    teamCount: Math.max(2, Number(teamCount) || 2),
    playerTeams: Array.isArray(playerTeams) ? playerTeams : [],
    autoDifficulty: !!autoDifficulty,

    difficultyLevel: 0,
    nextDifficultyAtOk: 10,

    perPlayer: Array.from({ length: playersCount }, () => ({
      qStartMs: 0,
      timesMs: [],
      streak: 0,
      bestStreak: 0,
    })),

    playerNames: playerNames.slice(0, playersCount).map((n, i) => n || `Joueur ${i+1}`),

    totals: { ok: 0, no: 0 }
  };
}

function mean(arr){
  if (!arr || !arr.length) return 0;
  return arr.reduce((s,x)=>s+x,0) / arr.length;
}

function median(arr){
  if (!arr || !arr.length) return 0;
  const a = arr.slice().sort((x,y)=>x-y);
  const mid = Math.floor(a.length / 2);
  return (a.length % 2) ? a[mid] : (a[mid-1] + a[mid]) / 2;
}

function maybeIncreaseDifficulty(){
  if (!SESSION?.autoDifficulty) return;
  if (SESSION.exerciseType !== "add") return;

  // Tous joueurs confondus: si on atteint X bonnes réponses → on augmente
  if (SESSION.totals.ok < SESSION.nextDifficultyAtOk) return;

  SESSION.difficultyLevel += 1;
  SESSION.nextDifficultyAtOk += 10;

  // Ajustement simple: +10 sur les max (plafond 999)
  const s = ENGINE?.state?.settings;
  if (s && s.type === "add"){
    s.aMax = Math.min(999, Number(s.aMax || 0) + 10);
    s.bMax = Math.min(999, Number(s.bMax || 0) + 10);

    // Au niveau 2: on autorise la retenue si on était en "sans retenue"
    if (SESSION.difficultyLevel >= 2 && s.noCarryUnits === true){
      s.noCarryUnits = false;
    }
  }

  // HUD update
  const hudSkill = $("hudSkill");
  if (hudSkill && ENGINE?.state?.settings){
    hudSkill.textContent = makeHudSkill(SESSION.exerciseType, ENGINE.state.settings, SESSION.difficultyLevel);
  }
}

function computeTeamSummaries(players){
  if (!SESSION?.teamMode) return [];

  const teamCount = Math.min(SESSION.teamCount, players.length);
  const teams = Array.from({ length: teamCount }, (_, t) => ({
    teamId: t,
    name: `Équipe ${t+1}`,
    score: 0,
    ok: 0,
    no: 0,
  }));

  players.forEach(p => {
    const t = Number.isFinite(p.teamId) ? p.teamId : 0;
    const team = teams[t];
    if (!team) return;
    team.score += p.score || 0;
    team.ok += p.ok || 0;
    team.no += p.no || 0;
  });

  teams.forEach(t => {
    const total = (t.ok + t.no);
    t.accuracy = total ? Math.round((t.ok / total) * 100) : 0;
  });

  return teams;
}

function endGame({ reason = "manual", winner = null } = {}){
  if (!GAME_RUNNING) return;
  GAME_RUNNING = false;

  stopAllQuestionTimers();
  stopRoundTimer();

  const endEpoch = Date.now();
  const elapsedSec = Math.max(0, Math.round((endEpoch - (SESSION?.startEpoch || endEpoch)) / 1000));

  // Build players stats
  const players = (ENGINE?.state?.players || []).map((p, i) => {
    const times = SESSION?.perPlayer?.[i]?.timesMs || [];
    const ok = Number(p.ok || 0);
    const no = Number(p.no || 0);
    const total = ok + no;

    return {
      index: i,
      name: SESSION?.playerNames?.[i] || `Joueur ${i+1}`,
      teamId: Number.isFinite(SESSION?.playerTeams?.[i]) ? SESSION.playerTeams[i] : (i % 2),
      score: Number(p.score || 0),
      ok,
      no,
      accuracy: total ? Math.round((ok / total) * 100) : 0,
      avgTimeMs: Math.round(mean(times)),
      medianTimeMs: Math.round(median(times)),
      bestStreak: Number(SESSION?.perPlayer?.[i]?.bestStreak || 0)
    };
  });

  const teamsSummary = computeTeamSummaries(players);

  // Winner (si pas fourni)
  let computedWinner = winner;
  if (!computedWinner){
    if (SESSION?.teamMode){
      const topTeam = teamsSummary.slice().sort((a,b)=> (b.score||0)-(a.score||0))[0];
      computedWinner = topTeam ? { type: "team", id: topTeam.teamId, name: topTeam.name } : null;
    } else {
      const top = players.slice().sort((a,b)=> (b.score||0)-(a.score||0) || (b.accuracy||0)-(a.accuracy||0))[0];
      computedWinner = top ? { type: "player", id: top.index, name: top.name } : null;
    }
  }

  // Label de compétence (avec difficulté)
  const skillLabel = makeHudSkill(SESSION?.exerciseType, ENGINE?.state?.settings || SESSION?.settingsSnapshot || {}, SESSION?.difficultyLevel || 0);

  const sessionRecord = {
    id: `${SESSION?.date || ""}_${Math.random().toString(16).slice(2)}`,
    date: SESSION?.date || new Date().toISOString(),
    endDate: new Date(endEpoch).toISOString(),
    elapsedSec,
    reason,

    exerciseType: SESSION?.exerciseType,
    skillLabel,
    settings: ENGINE?.state?.settings || SESSION?.settingsSnapshot,

    answerMode: SESSION?.answerMode,
    gameMode: SESSION?.gameMode,
    durationSec: SESSION?.durationSec,
    raceTarget: SESSION?.raceTarget,

    showExplain: !!SESSION?.showExplain,
    expertMode: !!SESSION?.expertMode,
    teamMode: !!SESSION?.teamMode,
    teamCount: SESSION?.teamCount,
    playerTeams: SESSION?.playerTeams,
    autoDifficulty: !!SESSION?.autoDifficulty,
    difficultyLevel: SESSION?.difficultyLevel || 0,

    winner: computedWinner,
    players,
    teamsSummary,
  };

  const { recordFlags } = addSessionToStore(sessionRecord);

  renderResultsModal(sessionRecord, recordFlags);
  openModal("resultsModal");
}

// ------------------------------------------------------------
// Results modal (podium animé)
// ------------------------------------------------------------
function renderResultsModal(session, recordFlags = []){
  const box = $("resultsContent");
  if (!box) return;

  const isTeam = !!session.teamMode;

  const items = (isTeam ? (session.teamsSummary || []) : (session.players || [])).slice()
    .sort((a,b)=> (b.score||0)-(a.score||0) || (b.accuracy||0)-(a.accuracy||0));

  const top3 = [items[1], items[0], items[2]].filter(Boolean); // visuel 2-1-3

  const chips = `
    <div style="display:flex; flex-wrap:wrap; gap:10px; margin: 10px 0 14px;">
      <span class="chip-pill">${session.gameMode === "time" ? "⏱ Mode temps" : `🏁 Premier à ${session.raceTarget}`}</span>
      <span class="chip-pill">${session.expertMode ? "🏆 Expert" : (session.showExplain ? "📘 Explications" : "🚫 Sans explication")}</span>
      ${session.teamMode ? `<span class="chip-pill">🤝 Équipes</span>` : ""}
      ${session.autoDifficulty ? `<span class="chip-pill">🎮 Auto • niv ${session.difficultyLevel}</span>` : ""}
      <span class="chip-pill">⏱ ${session.elapsedSec}s</span>
    </div>
  `;

  const recordBadge = recordFlags.length
    ? `<div class="success-badge" style="margin:0 auto 14px;">
         🏆 Nouveau record !
         <div class="success-result">${recordFlags.map(r => `#${r}`).join(" • ")}</div>
       </div>`
    : "";

  const podiumCards = top3.map((it, idx) => {
    const rank = (idx === 1) ? 1 : (idx === 0 ? 2 : 3);
    const emoji = rank === 1 ? "🥇" : (rank === 2 ? "🥈" : "🥉");
    const name = isTeam ? it.name : it.name;
    const score = it.score ?? 0;
    const acc = Number.isFinite(it.accuracy) ? ` • ${it.accuracy}%` : "";

    return `
      <div class="podium-card rank${rank}">
        <div class="podium-rank">${emoji}</div>
        <div class="podium-name">${name}</div>
        <div class="podium-score">${score} pts${acc}</div>
      </div>
    `;
  }).join("");

  const playersTable = `
    <table class="table" style="margin-top:14px;">
      <thead>
        <tr>
          <th>${isTeam ? "Équipe" : "Joueur"}</th>
          <th>Score</th>
          <th>✅</th>
          <th>❌</th>
          <th>Précision</th>
          ${isTeam ? "" : "<th>Temps moy.</th><th>Meilleure série</th>"}
        </tr>
      </thead>
      <tbody>
        ${items.map(it => {
          const ok = it.ok ?? "—";
          const no = it.no ?? "—";
          const accuracy = Number.isFinite(it.accuracy) ? `${it.accuracy}%` : "—";
          const avg = Number.isFinite(it.avgTimeMs) ? `${Math.round(it.avgTimeMs/100)/10}s` : "—";
          const best = it.bestStreak ?? "—";

          return `
            <tr>
              <td><b>${it.name}</b></td>
              <td>${it.score ?? 0}</td>
              <td>${ok}</td>
              <td>${no}</td>
              <td>${accuracy}</td>
              ${isTeam ? "" : `<td>${avg}</td><td>${best}</td>`}
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  box.innerHTML = `
    ${recordBadge}
    ${chips}

    <div class="podium">
      ${podiumCards}
    </div>

    <div class="ce1-text" style="margin-top: 6px;">
      <p><b>Gagnant :</b> ${session.winner?.name || "—"}</p>
      <p><small>${formatDateShort(session.date)}</small></p>
    </div>

    ${playersTable}
  `;
}

// ------------------------------------------------------------
// Stats modal
// ------------------------------------------------------------
function renderStatsModal(){
  const store = loadStatsStore();
  const rec = store.records || {};

  const recordsBox = $("tabRecords");
  const sessionsBox = $("tabSessions");

  if (recordsBox){
    recordsBox.innerHTML = `
      <table class="table">
        <thead>
          <tr><th>Type</th><th>Détail</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><b>🏆 Meilleur score</b></td>
            <td>${rec.bestScore ? `${rec.bestScore.name} • <b>${rec.bestScore.score}</b> pts <small>(${formatDateShort(rec.bestScore.date)})</small>` : "—"}</td>
          </tr>
          <tr>
            <td><b>🎯 Meilleure précision</b></td>
            <td>${rec.bestAccuracy ? `${rec.bestAccuracy.name} • <b>${rec.bestAccuracy.accuracy}%</b> <small>(${formatDateShort(rec.bestAccuracy.date)})</small>` : "—"}</td>
          </tr>
          <tr>
            <td><b>🔥 Meilleure série</b></td>
            <td>${rec.bestStreak ? `${rec.bestStreak.name} • <b>${rec.bestStreak.bestStreak}</b> <small>(${formatDateShort(rec.bestStreak.date)})</small>` : "—"}</td>
          </tr>
          <tr>
            <td><b>🤝 Meilleur score équipe</b></td>
            <td>${rec.bestTeamScore ? `${rec.bestTeamScore.team} • <b>${rec.bestTeamScore.score}</b> pts <small>(${formatDateShort(rec.bestTeamScore.date)})</small>` : "—"}</td>
          </tr>
          <tr>
            <td><b>🏁 Course la plus rapide</b></td>
            <td>${rec.fastestRace ? `${rec.fastestRace.winner} • <b>${rec.fastestRace.elapsedSec}s</b> (objectif ${rec.fastestRace.raceTarget}) <small>(${formatDateShort(rec.fastestRace.date)})</small>` : "—"}</td>
          </tr>
        </tbody>
      </table>
      <div class="ce1-text" style="margin-top: 10px;">
        <p><small>👉 Les records sont calculés sur les dernières parties enregistrées.</small></p>
      </div>
    `;
  }

  if (sessionsBox){
    const sessions = (store.sessions || []).slice(0, 12);

    if (!sessions.length){
      sessionsBox.innerHTML = `<div class="ce1-text"><p>Aucune partie enregistrée pour l’instant 😊</p></div>`;
    } else {
      sessionsBox.innerHTML = sessions.map((s) => {
        const modeLabel = s.gameMode === "time" ? `⏱ ${s.durationSec}s` : `🏁 ${s.raceTarget} pts`;
        const extra = `${s.expertMode ? "🏆 Expert" : (s.showExplain ? "📘" : "🚫")} ${s.teamMode ? " • 🤝 Équipe" : ""}`;

        const table = `
          <table class="table" style="margin-top:8px;">
            <thead>
              <tr><th>Joueur</th><th>Score</th><th>✅</th><th>❌</th><th>%</th><th>Temps moy.</th></tr>
            </thead>
            <tbody>
              ${(s.players || []).map(p => `
                <tr>
                  <td><b>${p.name}</b></td>
                  <td>${p.score}</td>
                  <td>${p.ok}</td>
                  <td>${p.no}</td>
                  <td>${p.accuracy}%</td>
                  <td>${p.avgTimeMs ? `${Math.round(p.avgTimeMs/100)/10}s` : "—"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;

        return `
          <div class="card" style="margin: 10px 0;">
            <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
              <div>
                <div style="font-weight: 900;">${formatDateShort(s.date)} • ${modeLabel}</div>
                <div style="opacity:.85; font-weight:900;">${s.skillLabel || s.exerciseType}</div>
                <div style="opacity:.75;">${extra}</div>
              </div>
              <div>
                <span class="chip-pill">🥇 ${s.winner?.name || "—"}</span>
                <span class="chip-pill">⏱ ${s.elapsedSec || 0}s</span>
              </div>
            </div>
            ${table}
          </div>
        `;
      }).join("");
    }
  }
}

function wireStatsTabs(){
  const tabs = Array.from(document.querySelectorAll("#statsModal .tab"));
  const tabRecords = $("tabRecords");
  const tabSessions = $("tabSessions");

  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      btn.classList.add("active");

      const which = btn.dataset.tab;
      if (which === "records"){
        tabRecords?.classList.remove("hidden");
        tabSessions?.classList.add("hidden");
      } else {
        tabRecords?.classList.add("hidden");
        tabSessions?.classList.remove("hidden");
      }
    });
  });
}

// ------------------------------------------------------------
// Player loop
// ------------------------------------------------------------
function getTeamScore(teamId){
  if (!SESSION?.teamMode) return 0;
  return (ENGINE?.state?.players || []).reduce((sum, p, idx) => {
    const t = Number.isFinite(SESSION.playerTeams?.[idx]) ? SESSION.playerTeams[idx] : 0;
    if (t === teamId) sum += Number(p.score || 0);
    return sum;
  }, 0);
}

function checkRaceWin(playerIndex){
  if (!SESSION || SESSION.gameMode !== "race") return null;

  const target = Number(SESSION.raceTarget || 10);

  if (SESSION.teamMode){
    const teamId = Number.isFinite(SESSION.playerTeams?.[playerIndex]) ? SESSION.playerTeams[playerIndex] : 0;
    const teamScore = getTeamScore(teamId);
    if (teamScore >= target){
      return { type: "team", id: teamId, name: `Équipe ${teamId+1}` };
    }
    return null;
  }

  const score = Number(ENGINE?.state?.players?.[playerIndex]?.score || 0);
  if (score >= target){
    return { type: "player", id: playerIndex, name: SESSION.playerNames?.[playerIndex] || `Joueur ${playerIndex+1}` };
  }

  return null;
}

function startPlayer(playerIndex){
  if (!GAME_RUNNING) return;

  // 🇬🇧 Anglais (mode son) : tout le monde a le même mot en même temps
  if (isEnglishSoundSync()){
    // On lance un round partagé une seule fois (depuis le 1er appel)
    if (!EN_SYNC.active){
      startEnglishSoundRound();
    }
    return;
  }

  stopQuestionTimer(playerIndex);

  const ev = ENGINE.nextQuestion(playerIndex);
  const q = ev.question;

  // start time pour stats
  if (SESSION?.perPlayer?.[playerIndex]){
    SESSION.perPlayer[playerIndex].qStartMs = performance.now();
  }

  const qEl = $("q-" + playerIndex);
  if (qEl){
    if (q.html) qEl.innerHTML = q.html;
    else qEl.textContent = q.text ?? `${q.a} + ${q.b}`;

    // Anglais (mode son) : lecture automatique + bouton 🔊
    if (q.kind === "english" && q.say){
      const speak = () => {
        try{
          const u = new SpeechSynthesisUtterance(String(q.say));
          u.lang = "en-US";
          speechSynthesis.cancel();
          speechSynthesis.speak(u);
        }catch(e){}
      };

      // bouton réécouter
      const btn = qEl.querySelector?.(".en-sound");
      btn?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        speak();
      });

      // auto play
      setTimeout(speak, 120);
    }
  }

  hideExplain(playerIndex);

  const answerMode = SESSION?.answerMode || "mcq";
  const stage = $("stage-" + playerIndex);

  // Mode UI : ballons vs clavier
  if (stage){
    stage.classList.remove("locked", "stage-fade");
    if (answerMode === "keypad") stage.classList.add("hidden");
    else stage.classList.remove("hidden");
  }
  setKeypadVisible(playerIndex, answerMode === "keypad");
  setKeypadLocked(playerIndex, false);

  const handlePick = (picked, clickedEl) => {
    if (!GAME_RUNNING) return;

    stopQuestionTimer(playerIndex);

    // response time
    const t0 = SESSION?.perPlayer?.[playerIndex]?.qStartMs || performance.now();
    const dt = Math.max(0, performance.now() - t0);
    SESSION?.perPlayer?.[playerIndex]?.timesMs?.push(dt);

    const res = ENGINE.answer(playerIndex, picked);
    if (!res || res.type !== "ANSWERED") return;

    // streaks + totals
    if (SESSION?.perPlayer?.[playerIndex]){
      if (res.correct){
        SESSION.perPlayer[playerIndex].streak += 1;
        SESSION.perPlayer[playerIndex].bestStreak = Math.max(
          SESSION.perPlayer[playerIndex].bestStreak,
          SESSION.perPlayer[playerIndex].streak
        );
        SESSION.totals.ok += 1;
      } else {
        SESSION.perPlayer[playerIndex].streak = 0;
        SESSION.totals.no += 1;
      }
    }

    // difficulté progressive
    maybeIncreaseDifficulty();

    // stats UI
    const sEl = $("score-" + playerIndex);
    const okEl = $("ok-" + playerIndex);
    const noEl = $("no-" + playerIndex);
    if (sEl) sEl.textContent = String(res.stats.score);
    if (okEl) okEl.textContent = String(res.stats.ok);
    if (noEl) noEl.textContent = String(res.stats.no);

    // FX + stop selon le mode
    if (answerMode === "keypad"){
      const pad = $("keypad-" + playerIndex);
      setKeypadLocked(playerIndex, true);

      if (pad){
        const x = pad.clientWidth / 2;
        const y = Math.min(90, pad.clientHeight / 2);
        if (res.correct) addConfetti(pad, x, y);
        else addPoof(pad, x, y);
      }
    } else {
      if (!stage) return;

      stage.classList.add("locked");

      // bon ballon si erreur
      let correctEl = null;
      if (!res.correct){
        correctEl = stage.querySelector(`.balloon[data-value="${res.correctAnswer}"]`);
      }

      explodeOne(stage, clickedEl, { good: !!res.correct });
      explodeAllExcept(stage, res.correct ? [] : [correctEl]);

      if (correctEl){
        freezeAtCurrentPosition(stage, correctEl);
        correctEl.classList.add("correct-answer");
        requestAnimationFrame(() => {
          correctEl.classList.add("centered-correct");
        });
      }
    }

    // feedback
    showExplain(playerIndex, q, res);

    // 🏁 victoire ?
    const winner = checkRaceWin(playerIndex);
    if (winner){
      // on laisse les FX se jouer un tout petit peu
      setTimeout(() => endGame({ reason: "race", winner }), 450);
      return;
    }

    // continuer
    waitTapToContinue(playerIndex, () => {
      if (!GAME_RUNNING) return;

      if (answerMode === "keypad"){
        setKeypadLocked(playerIndex, false);
      } else {
        stage?.classList.remove("locked");
      }

      const fadeEl = (answerMode === "keypad") ? $("keypad-" + playerIndex) : stage;
      fadeEl?.classList.add("stage-fade");
      setTimeout(() => {
        fadeEl?.classList.remove("stage-fade");
        startPlayer(playerIndex);
      }, 250);
    });
  };

  if (answerMode === "keypad"){
    renderKeypad(playerIndex, q, (n) => handlePick(n, null));
  } else {
    renderBalloons(playerIndex, q, handlePick);
  }

  // timer question
  const timeSec = Number(ENGINE.state?.settings?.qTimeSec || 0);
  if (timeSec > 0){
    qTimers[playerIndex] = setTimeout(() => {
      if (!GAME_RUNNING) return;
      onQuestionTimeout(playerIndex);
    }, timeSec * 1000);
  }
}

// ------------------------------------------------------------
// 🇬🇧 Round synchronisé (mode son)
// ------------------------------------------------------------
function speakEnglishWord(word){
  try{
    const u = new SpeechSynthesisUtterance(String(word));
    u.lang = "en-US";
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }catch(e){}
}

function startEnglishSoundRound(){
  if (!GAME_RUNNING) return;

  EN_SYNC.active = true;
  EN_SYNC.ready = Array.from({ length: (SESSION?.playersCount || 1) }, () => false);

  // Stop timers existants
  stopAllQuestionTimers();
  stopEnglishRoundTimer();

  // Générer la question partagée (engine sync renvoie la même)
  for (let i = 0; i < (SESSION?.playersCount || 1); i++){
    ENGINE.nextQuestion(i);
  }

  const q = ENGINE?.state?.players?.[0]?.current;
  if (!q) return;

  // Lecture UNIQUE du son (évite plusieurs voix en même temps)
  setTimeout(() => speakEnglishWord(q.say || q.answer), 120);

  // Rendu pour chaque joueur
  for (let playerIndex = 0; playerIndex < (SESSION?.playersCount || 1); playerIndex++){
    stopQuestionTimer(playerIndex);

    // start time stats
    if (SESSION?.perPlayer?.[playerIndex]){
      SESSION.perPlayer[playerIndex].qStartMs = performance.now();
    }

    const qEl = $("q-" + playerIndex);
    if (qEl){
      if (q.html) qEl.innerHTML = q.html;
      else qEl.textContent = q.text || "🔊 Écoute";

      // Bouton réécouter (présent dans chaque carte, mais le son n'est joué que si l'élève clique)
      const btn = qEl.querySelector?.(".en-sound");
      btn?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        speakEnglishWord(q.say || q.answer);
      });
    }

    hideExplain(playerIndex);

    const answerMode = SESSION?.answerMode || "mcq";
    const stage = $("stage-" + playerIndex);
    if (stage){
      stage.classList.remove("locked", "stage-fade");
      if (answerMode === "keypad") stage.classList.add("hidden");
      else stage.classList.remove("hidden");
    }
    setKeypadVisible(playerIndex, answerMode === "keypad");
    setKeypadLocked(playerIndex, false);

    const handlePick = (picked, clickedEl) => {
      if (!GAME_RUNNING) return;

      // Empêcher que quelqu'un avance seul
      const stage = $("stage-" + playerIndex);
      if (stage) stage.classList.add("locked");
      setKeypadLocked(playerIndex, true);

      // response time
      const t0 = SESSION?.perPlayer?.[playerIndex]?.qStartMs || performance.now();
      const dt = Math.max(0, performance.now() - t0);
      SESSION?.perPlayer?.[playerIndex]?.timesMs?.push(dt);

      const res = ENGINE.answer(playerIndex, picked);
      if (!res || res.type !== "ANSWERED") return;

      // streaks + totals (même logique que mode normal)
      if (SESSION?.perPlayer?.[playerIndex]){
        if (res.correct){
          SESSION.perPlayer[playerIndex].streak += 1;
          SESSION.perPlayer[playerIndex].bestStreak = Math.max(
            SESSION.perPlayer[playerIndex].bestStreak,
            SESSION.perPlayer[playerIndex].streak
          );
          SESSION.totals.ok += 1;
        } else {
          SESSION.perPlayer[playerIndex].streak = 0;
          SESSION.totals.no += 1;
        }
      }

      // stats UI
      const sEl = $("score-" + playerIndex);
      const okEl = $("ok-" + playerIndex);
      const noEl = $("no-" + playerIndex);
      if (sEl) sEl.textContent = String(res.stats.score);
      if (okEl) okEl.textContent = String(res.stats.ok);
      if (noEl) noEl.textContent = String(res.stats.no);

      // FX ballons
      if (stage){
        let correctEl = null;
        if (!res.correct){
          correctEl = stage.querySelector(`.balloon[data-value="${res.correctAnswer}"]`);
        }
        explodeOne(stage, clickedEl, { good: !!res.correct });
        explodeAllExcept(stage, res.correct ? [] : [correctEl]);
        if (correctEl){
          freezeAtCurrentPosition(stage, correctEl);
          correctEl.classList.add("correct-answer");
          requestAnimationFrame(() => correctEl.classList.add("centered-correct"));
        }
      }

      showExplain(playerIndex, q, res);

      waitTapToContinue(playerIndex, () => {
        EN_SYNC.ready[playerIndex] = true;
        // Quand tout le monde a fini → round suivant pour tous
        if (EN_SYNC.ready.every(Boolean)){
          EN_SYNC.active = false;
          startEnglishSoundRound();
        }
      });
    };

    if (answerMode === "keypad"){
      wireKeypadAnswer(playerIndex, q, handlePick);
    } else {
      renderBalloons(playerIndex, q, handlePick);
    }
  }

  // ⏱ Timer unique pour le round
  const s = ENGINE?.state?.settings || SESSION?.settingsSnapshot || {};
  const timeSec = Number(s?.qTimeSec || 0);

  if (timeSec > 0){
    EN_SYNC.roundTimerId = setTimeout(() => {
      if (!GAME_RUNNING) return;
      onEnglishSoundRoundTimeout();
    }, timeSec * 1000);
  }
}

function onEnglishSoundRoundTimeout(){
  stopEnglishRoundTimer();

  const n = SESSION?.playersCount || 1;
  for (let playerIndex = 0; playerIndex < n; playerIndex++){
    const stage = $("stage-" + playerIndex);
    if (stage){
      stage.classList.add("locked");
      explodeAllExcept(stage, []);
    }

    const box = $("explain-" + playerIndex);
    if (box){
      box.classList.remove("hidden");
      box.innerHTML = `
        <div class="explain-title">⏱ Temps écoulé</div>
        <div class="ce1-text"><p>On passe à la question suivante.</p></div>
        <div class="tap-to-continue">🖱️ Clique pour continuer</div>
      `;
    }

    waitTapToContinue(playerIndex, () => {
      EN_SYNC.ready[playerIndex] = true;
      if (EN_SYNC.ready.every(Boolean)){
        EN_SYNC.active = false;
        startEnglishSoundRound();
      }
    });
  }
}

// ------------------------------------------------------------
// UI syncing
// ------------------------------------------------------------
function syncGameModeUI(){
  const mode = $("gameMode")?.value || "time";
  $("timeWrap")?.classList.toggle("hidden", mode !== "time");
  $("raceTargetWrap")?.classList.toggle("hidden", mode !== "race");
}

function getOptionsView(){
  const adv = $("tabAdvanced");
  return adv?.classList.contains("active") ? "advanced" : "quick";
}

function setOptionsView(view){
  const quick = $("optionsQuick");
  const adv = $("optionsAdvanced");
  const tabQuick = $("tabQuick");
  const tabAdv = $("tabAdvanced");

  const isAdv = view === "advanced";

  if (quick) quick.classList.toggle("hidden", isAdv);
  if (adv) adv.classList.toggle("hidden", !isAdv);

  tabQuick?.classList.toggle("active", !isAdv);
  tabAdv?.classList.toggle("active", isAdv);
  tabQuick?.setAttribute("aria-selected", String(!isAdv));
  tabAdv?.setAttribute("aria-selected", String(isAdv));

  // Équipe: "nombre d'équipes" seulement si vue avancée + mode équipe activé
  const tm = $("teamMode")?.checked;
  $("teamOptions")?.classList.toggle("hidden", !(isAdv && tm));
}

function syncTeamUI(){
  const teamMode = $("teamMode")?.checked;
  // "Nombre d'équipes" seulement dans la vue avancée
  $("teamOptions")?.classList.toggle("hidden", !(teamMode && getOptionsView() === "advanced"));

  const pc = Number($("playersCount")?.value || 1);
  const names = readPlayerNames();
  const teams = readPlayerTeams();
  const bgs = readPlayerBgs();
  const teamCount = Number($("teamCount")?.value || 2);

  renderPlayerInputs(pc, names, { teamMode, teamCount, teams, bgs });
}

function syncExpertUI(){
  const expert = $("expertMode")?.checked;
  const explainCheck = $("showExplainOption");
  if (!explainCheck) return;

  // UI: grise la tuile explications quand Expert est actif
  $("tileExplain")?.classList.toggle("is-disabled", !!expert);

  if (expert){
    explainCheck.checked = false;
    explainCheck.disabled = true;
  } else {
    explainCheck.disabled = false;
  }
}

function syncEnglishSettingsUI(){
  const enMode = $("enMode")?.value;
  const box = $("enSoundOptions");
  if (box){
    box.style.display = (enMode === "sound") ? "block" : "none";
  }
}

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  showMenu();
  wireModalBackdrops();
  wireStatsTabs();

  // ------------------------------------------------------------
  // Fond (menu Joueurs)
  // ------------------------------------------------------------
  function applyBackgroundTheme(theme){
    const bg = document.querySelector(".bg");
    if (!bg) return;
    bg.setAttribute("data-theme", String(theme || 1));
  }

  // ------------------------------------------------------------
  // App tabs (Math / Anglais / Français)
  // ------------------------------------------------------------
  function setActiveApp(app){
    // UI tabs
    document.querySelectorAll("#appTabs .app-tab").forEach(btn => {
      const isActive = btn.dataset.app === app;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });

    // Affichage écran (on utilise le même menu)
    if (app === "english") showEnglish();
    else showMenu();

    // Mode appli : filtre les exercices + contraintes UI
    const exSel = $("exerciseType");
    const optEng = $("optEng");
    const ansSel = $("answerMode");
    if (app === "english"){
      // Affiche l'option Anglais dans le select seulement sur l'onglet Anglais
      if (optEng) optEng.hidden = false;
      // force Anglais
      if (exSel){ exSel.value = "eng"; exSel.disabled = true; }
      // Anglais = QCM (pour l'instant)
      if (ansSel){ ansSel.value = "mcq"; ansSel.disabled = true; }
      renderMathSettings("eng", loadPrefs()?.exerciseSettings || {});
      $("mathTitle")?.scrollIntoView?.({ block: "nearest" });
    } else {
      // Cache l'option Anglais quand on est en Math
      if (optEng) optEng.hidden = true;
      if (exSel){ exSel.disabled = false; }
      if (ansSel){ ansSel.disabled = false; }
      // Si on revient en Math avec "eng" sélectionné, on repasse sur Addition
      if (exSel && exSel.value === "eng") exSel.value = "add";
      // re-rendu réglages selon exercice actuel
      if (exSel) renderMathSettings(exSel.value, loadPrefs()?.exerciseSettings || {});
    }
  }

  // clic onglets
  document.querySelectorAll("#appTabs .app-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      if (GAME_RUNNING){
        alert("⛔ Termine la partie avant de changer de module 😊");
        return;
      }
      setActiveApp(btn.dataset.app);
    });
  });

  // bouton retour (anglais)
  $("btnBackToMath")?.addEventListener("click", () => setActiveApp("math"));

  // couleurs : bascule FR ↔ EN
  document.querySelectorAll(".color-card").forEach(card => {
    card.addEventListener("click", (e) => {
      e.preventDefault();
      card.classList.toggle("is-en");
      const label = card.querySelector(".label");
      if (label){
        label.textContent = card.classList.contains("is-en") ? (card.dataset.en || "") : (card.dataset.fr || "");
      }
    });
  });


  const prefs = loadPrefs();

  // --- load prefs (defaults) ---
  const playersCount = Number(prefs.playersCount || $("playersCount")?.value || 4);
  const durationSec  = Number(prefs.durationSec  || $("durationSec")?.value  || 60);
  const answerMode   = prefs.answerMode  || $("answerMode")?.value  || "mcq";
  let exerciseType = prefs.exerciseType || $("exerciseType")?.value || "add";
  const playerNames  = prefs.playerNames || ["", "", "", ""];
  const playerBgs    = prefs.playerBgs   || [1, 2, 3, 4];
  const screenProfile = prefs.screenProfile || $("screenProfile")?.value || "tni";
  const bgTheme = prefs.bgTheme || $("bgTheme")?.value || "1";

  const gameMode = prefs.gameMode || $("gameMode")?.value || "time";
  const raceTarget = Number(prefs.raceTarget || $("raceTarget")?.value || 10);
  const showExplain = (prefs.showExplainOption ?? $("showExplainOption")?.checked ?? true);
  const expertMode = (prefs.expertMode ?? $("expertMode")?.checked ?? false);
  const autoDifficulty = (prefs.autoDifficulty ?? $("autoDifficulty")?.checked ?? false);

  const teamMode = (prefs.teamMode ?? $("teamMode")?.checked ?? false);
  const teamCount = Number(prefs.teamCount || $("teamCount")?.value || 2);
  const playerTeams = Array.isArray(prefs.playerTeams) ? prefs.playerTeams : [];

  // apply values
  if ($("playersCount")) $("playersCount").value = String(playersCount);
  if ($("durationSec")) $("durationSec").value = String(durationSec);
  if ($("answerMode")) $("answerMode").value = answerMode;
  if ($("exerciseType")) $("exerciseType").value = exerciseType;
  if ($("screenProfile")) $("screenProfile").value = screenProfile;
  if ($("bgTheme")) $("bgTheme").value = String(bgTheme);

  // applique fond tout de suite
  applyBackgroundTheme(bgTheme);

  // change fond
  $("bgTheme")?.addEventListener("change", () => {
    const next = $("bgTheme")?.value || "1";
    applyBackgroundTheme(next);
    // on sauvegarde immédiatement (même avant de lancer une partie)
    const cur = loadPrefs();
    savePrefs({ ...cur, bgTheme: String(next) });
  });

  // Initialise l'onglet actif (Math par défaut) + cache l'option Anglais dans le select
  setActiveApp("math");

  if ($("gameMode")) $("gameMode").value = gameMode;
  if ($("raceTarget")) $("raceTarget").value = String(raceTarget);
  if ($("showExplainOption")) $("showExplainOption").checked = !!showExplain;
  if ($("expertMode")) $("expertMode").checked = !!expertMode;
  if ($("autoDifficulty")) $("autoDifficulty").checked = !!autoDifficulty;

  if ($("teamMode")) $("teamMode").checked = !!teamMode;
  if ($("teamCount")) $("teamCount").value = String(teamCount);

  // math settings
  renderMathSettings(exerciseType, prefs.exerciseSettings || prefs.settings || {});
  $("exerciseType")?.addEventListener("change", () => {
    renderMathSettings($("exerciseType").value, {});
    // après re-render, on peut re-sync l'UI anglais
    syncEnglishSettingsUI();
  });

  // Anglais : afficher/masquer les options "mode son"
  document.addEventListener("change", (e) => {
    if (e.target && e.target.id === "enMode"){
      syncEnglishSettingsUI();
    }
  });

  // players inputs (avec équipes si besoin)
  renderPlayerInputs(playersCount, playerNames, { teamMode, teamCount, teams: playerTeams, bgs: playerBgs });

    // UI sync
  // Vue options: si on a déjà activé une option avancée, on ouvre directement l'onglet avancé
  const initialView = (expertMode || autoDifficulty || teamMode) ? "advanced" : "quick";
  setOptionsView(initialView);

  syncGameModeUI();
  syncEnglishSettingsUI();
  syncExpertUI();
  syncTeamUI();

  $("gameMode")?.addEventListener("change", syncGameModeUI);

  $("tabQuick")?.addEventListener("click", () => {
    setOptionsView("quick");
    syncExpertUI();
    syncTeamUI();
  });

  $("tabAdvanced")?.addEventListener("click", () => {
    setOptionsView("advanced");
    syncExpertUI();
    syncTeamUI();
  });

$("expertMode")?.addEventListener("change", () => {
    syncExpertUI();
    if ($("expertMode")?.checked) setOptionsView("advanced");
  });

  $("teamMode")?.addEventListener("change", () => {
    syncTeamUI();
  });
  $("teamCount")?.addEventListener("change", () => {
    syncTeamUI();
  });

  $("playersCount")?.addEventListener("change", () => {
    const n = Number($("playersCount").value);
    const current = readPlayerNames();
    const currentTeams = readPlayerTeams();
    const currentBgs = readPlayerBgs();
    const nextNames = Array.from({ length: n }, (_, i) => current[i] || "");
    const nextTeams = Array.from({ length: n }, (_, i) => (Number.isFinite(currentTeams[i]) ? currentTeams[i] : (i % 2)));
    const nextBgs = Array.from({ length: n }, (_, i) => (Number.isFinite(currentBgs[i]) ? currentBgs[i] : ((i % 4) + 1)));
    renderPlayerInputs(n, nextNames, {
      teamMode: $("teamMode")?.checked,
      teamCount: Number($("teamCount")?.value || 2),
      teams: nextTeams,
      bgs: nextBgs
    });
  });

  // App settings modal
  $("btnSettings")?.addEventListener("click", () => {
    openModal("appSettingsModal");
  });
  $("btnCloseSettings")?.addEventListener("click", () => closeModal("appSettingsModal"));

  // Mode prof (header)
  $("btnProf")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openProfModal();
  });
  $("btnCloseProf")?.addEventListener("click", closeProfModal);
  $("profBackdrop")?.addEventListener("click", closeProfModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeProfModal();
  });

  // Stats modal
  $("btnOpenStats")?.addEventListener("click", () => {
    renderStatsModal();
    openModal("statsModal");
  });
  $("btnCloseStats")?.addEventListener("click", () => closeModal("statsModal"));

  function doResetStats(){
    if (!confirm("Reset des statistiques et records ?")) return;
    resetStatsStore();
    renderStatsModal();
    alert("✅ Stats effacées.");
  }
  $("btnResetStats")?.addEventListener("click", doResetStats);
  $("btnResetStats2")?.addEventListener("click", doResetStats);

  // Boutons dans la modal "Mode prof"
  $("btnOpenStatsProf")?.addEventListener("click", () => {
    closeProfModal();
    renderStatsModal();
    openModal("statsModal");
  });
  $("btnResetStatsProf")?.addEventListener("click", () => {
    closeProfModal();
    doResetStats();
  });

  // Results modal
  $("btnCloseResults")?.addEventListener("click", () => {
    closeModal("resultsModal");
    showMenu();
  });
  $("btnBackToMenu")?.addEventListener("click", () => {
    closeModal("resultsModal");
    showMenu();
  });

  // Reset prefs
  $("btnReset")?.addEventListener("click", () => {
    resetPrefs();
    location.reload();
  });

  // Fullscreen
  $("btnFullscreen")?.addEventListener("click", async () => {
    try{
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    }catch(e){
      alert("Plein écran indisponible sur ce navigateur.");
    }
  });

  // Start
  $("btnStart")?.addEventListener("click", () => {
    const pc = Number($("playersCount")?.value || 4);
    const dur = Number($("durationSec")?.value || 60);
    const ansMode = $("answerMode")?.value || "mcq";
    const exType = $("exerciseType")?.value || "add";

    const names = readPlayerNames();
    const bgs = readPlayerBgs();
    const profile = $("screenProfile")?.value || "tni";
    const theme = $("bgTheme")?.value || "1";

    const gm = $("gameMode")?.value || "time";
    const target = Number($("raceTarget")?.value || 10);

    const expert = $("expertMode")?.checked;
    const showExp = expert ? false : ($("showExplainOption")?.checked ?? true);
    const autoDiff = $("autoDifficulty")?.checked;

    const tm = $("teamMode")?.checked;
    const tCount = Number($("teamCount")?.value || 2);
    const teams = tm ? readPlayerTeams() : [];

    const settings = readExerciseSettings(exType, dur);

    // save prefs
    savePrefs({
      screenProfile: profile,
      bgTheme: theme,
      playersCount: pc,
      playerNames: names,
      playerBgs: bgs,
      durationSec: dur,
      answerMode: ansMode,
      exerciseType: exType,
      exerciseSettings: settings,

      gameMode: gm,
      raceTarget: target,
      showExplainOption: showExp,
      expertMode: expert,
      autoDifficulty: autoDiff,
      teamMode: tm,
      teamCount: tCount,
      playerTeams: teams,
    });

    // HUD
    const modeLabel = ansMode === "mcq" ? "🎈 QCM" : "☁️ Clavier";
    const gmLabel = gm === "time" ? "⏱ Temps" : `🏁 Premier à ${target}`;
    const extra = `${expert ? " • 🏆 Expert" : (showExp ? " • 📘" : " • 🚫")}${tm ? " • 🤝" : ""}`;

    $("hudMode").textContent = `${modeLabel} • ${gmLabel}${extra}`;
    $("hudSkill").textContent = makeHudSkill(exType, settings, 0);
    $("hudTimer").textContent = gm === "time" ? `⏱ ${dur}s` : `🏁 ${target} pts`;

    // Grid
    const layout = layoutFor(profile, pc);
    renderGrid({ layout, playersCount: pc, names, bgs });

    // Engine
    ENGINE = createEngine({ exerciseType: exType, settings, playersCount: pc, answerMode: ansMode });

    // Session start
    startSession({
      exerciseType: exType,
      settings,
      playersCount: pc,
      playerNames: names,
      gameMode: gm,
      durationSec: dur,
      raceTarget: target,
      showExplain: showExp,
      expertMode: expert,
      teamMode: tm,
      teamCount: tCount,
      playerTeams: teams,
      autoDifficulty: autoDiff,
      answerMode: ansMode
    });

    // Start loops
    GAME_RUNNING = true;
    qTimers = Array.from({ length: pc }, () => null);
    for (let i = 0; i < pc; i++) startPlayer(i);

    showGame();
    startHudClock();
  });

  // End buttons (sauvegarde + résultats)
  function endNow(){
    if (!GAME_RUNNING) {
      showMenu();
      return;
    }
    endGame({ reason: "manual" });
  }

  $("btnEnd")?.addEventListener("click", endNow);
  $("btnEndHeader")?.addEventListener("click", endNow);
});
