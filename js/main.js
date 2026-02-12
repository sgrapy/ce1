// js/main.js
import { $ } from "./ui/dom.js";
import { getBalloonCenter, addConfetti, addPoof } from "./ui/fx.js";
import { renderMathSettings, readSelectedTables } from "./ui/mathsettings.js";

import { showMenu, showGame } from "./ui/screens.js";
import { renderGrid } from "./ui/grid.js";
import { renderBalloons } from "./ui/balloons.js";
import { renderPlayerInputs, readPlayerNames, readPlayerTeams } from "./ui/menu.js";
import { renderAdditionBase10Explanation } from "./ui/additionBase10Explain.js";

import { loadPrefs, savePrefs, resetPrefs } from "./storage/prefs.js";
import { loadStatsStore, addSessionToStore, resetStatsStore, formatDateShort } from "./storage/stats.js";

import { createEngine } from "./engine/engine.js";
import { makeSkillLabel as makeAddLabel } from "./engine/questions/addition.js";
import { makeSkillLabel as makeMulLabel } from "./engine/questions/multiplication.js";

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

  const resultText = question?.kind === "multiplication"
    ? `${question.a} × ${question.b} = ${question.answer}`
    : `${question.a} + ${question.b} = ${question.answer}`;

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

  const stage = $("stage-" + playerIndex);
  if (!stage) return;

  stage.classList.add("locked");
  explodeAllExcept(stage, []);

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
    stage.classList.remove("locked");
    stage.classList.add("stage-fade");
    setTimeout(() => {
      stage.classList.remove("stage-fade");
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

  if (exerciseType === "add"){
    return {
      type: "add",
      aMin: Number($("aMin")?.value ?? 0),
      aMax: Number($("aMax")?.value ?? 69),
      bMin: Number($("bMin")?.value ?? 0),
      bMax: Number($("bMax")?.value ?? 69),
      noCarryUnits: ($("noCarryUnits")?.value ?? "true") === "true",
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

  return {
    type: "add",
    aMin: 0, aMax: 69,
    bMin: 0, bMax: 69,
    noCarryUnits: true,
    choices: 3,
    qTimeSec: 6,
    durationSec
  };
}

function makeHudSkill(exerciseType, settings, difficultyLevel = 0){
  const base = (exerciseType === "mul") ? makeMulLabel(settings) : makeAddLabel(settings);
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

  stopQuestionTimer(playerIndex);

  const ev = ENGINE.nextQuestion(playerIndex);
  const q = ev.question;

  // start time pour stats
  if (SESSION?.perPlayer?.[playerIndex]){
    SESSION.perPlayer[playerIndex].qStartMs = performance.now();
  }

  const qEl = $("q-" + playerIndex);
  if (qEl) qEl.textContent = q.text ?? `${q.a} + ${q.b}`;

  hideExplain(playerIndex);

  renderBalloons(playerIndex, q, (picked, clickedEl) => {
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

    const stage = $("stage-" + playerIndex);
    if (!stage) return;

    stage.classList.add("locked");

    // stats UI
    const sEl = $("score-" + playerIndex);
    const okEl = $("ok-" + playerIndex);
    const noEl = $("no-" + playerIndex);
    if (sEl) sEl.textContent = String(res.stats.score);
    if (okEl) okEl.textContent = String(res.stats.ok);
    if (noEl) noEl.textContent = String(res.stats.no);

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
      stage.classList.remove("locked");
      stage.classList.add("stage-fade");
      setTimeout(() => {
        stage.classList.remove("stage-fade");
        startPlayer(playerIndex);
      }, 250);
    });
  });

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
// UI syncing
// ------------------------------------------------------------
function syncGameModeUI(){
  const mode = $("gameMode")?.value || "time";
  $("timeWrap")?.classList.toggle("hidden", mode !== "time");
  $("raceTargetWrap")?.classList.toggle("hidden", mode !== "race");
}

function syncTeamUI(){
  const teamMode = $("teamMode")?.checked;
  $("teamOptions")?.classList.toggle("hidden", !teamMode);

  const pc = Number($("playersCount")?.value || 1);
  const names = readPlayerNames();
  const teams = readPlayerTeams();
  const teamCount = Number($("teamCount")?.value || 2);

  renderPlayerInputs(pc, names, { teamMode, teamCount, teams });
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

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  showMenu();
  wireModalBackdrops();
  wireStatsTabs();

  const prefs = loadPrefs();

  // --- load prefs (defaults) ---
  const playersCount = Number(prefs.playersCount || $("playersCount")?.value || 4);
  const durationSec  = Number(prefs.durationSec  || $("durationSec")?.value  || 60);
  const answerMode   = prefs.answerMode  || $("answerMode")?.value  || "mcq";
  const exerciseType = prefs.exerciseType || $("exerciseType")?.value || "add";
  const playerNames  = prefs.playerNames || ["", "", "", ""];
  const screenProfile = prefs.screenProfile || $("screenProfile")?.value || "tni";

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
  });

  // players inputs (avec équipes si besoin)
  renderPlayerInputs(playersCount, playerNames, { teamMode, teamCount, teams: playerTeams });

  // UI sync
  syncGameModeUI();
  syncExpertUI();
  $("gameMode")?.addEventListener("change", syncGameModeUI);

  $("expertMode")?.addEventListener("change", () => {
    syncExpertUI();
  });

  $("teamMode")?.addEventListener("change", () => {
    $("teamOptions")?.classList.toggle("hidden", !$("teamMode")?.checked);
    syncTeamUI();
  });
  $("teamCount")?.addEventListener("change", () => {
    syncTeamUI();
  });

  $("playersCount")?.addEventListener("change", () => {
    const n = Number($("playersCount").value);
    const current = readPlayerNames();
    const currentTeams = readPlayerTeams();
    const nextNames = Array.from({ length: n }, (_, i) => current[i] || "");
    const nextTeams = Array.from({ length: n }, (_, i) => (Number.isFinite(currentTeams[i]) ? currentTeams[i] : (i % 2)));
    renderPlayerInputs(n, nextNames, {
      teamMode: $("teamMode")?.checked,
      teamCount: Number($("teamCount")?.value || 2),
      teams: nextTeams
    });
  });

  // App settings modal
  $("btnSettings")?.addEventListener("click", () => {
    openModal("appSettingsModal");
  });
  $("btnCloseSettings")?.addEventListener("click", () => closeModal("appSettingsModal"));

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
    const profile = $("screenProfile")?.value || "tni";

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
      playersCount: pc,
      playerNames: names,
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
    const modeLabel = ansMode === "mcq" ? "🎈 QCM" : "⌨️ Clavier";
    const gmLabel = gm === "time" ? "⏱ Temps" : `🏁 Premier à ${target}`;
    const extra = `${expert ? " • 🏆 Expert" : (showExp ? " • 📘" : " • 🚫")}${tm ? " • 🤝" : ""}`;

    $("hudMode").textContent = `${modeLabel} • ${gmLabel}${extra}`;
    $("hudSkill").textContent = makeHudSkill(exType, settings, 0);
    $("hudTimer").textContent = gm === "time" ? `⏱ ${dur}s` : `🏁 ${target} pts`;

    // Grid
    const layout = layoutFor(profile, pc);
    renderGrid({ layout, playersCount: pc, names });

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
