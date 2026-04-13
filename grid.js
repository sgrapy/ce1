const LS_STATS = "mathgame_stats_store_v2";

function nowIso(){
  return new Date().toISOString();
}

function safeParse(json, fallback){
  try { return JSON.parse(json); } catch { return fallback; }
}

export function loadStatsStore(){
  const store = safeParse(localStorage.getItem(LS_STATS) || "null", null);
  if (store && typeof store === "object"){
    return {
      sessions: Array.isArray(store.sessions) ? store.sessions : [],
      records: store.records && typeof store.records === "object" ? store.records : {}
    };
  }
  return { sessions: [], records: {} };
}

export function saveStatsStore(store){
  localStorage.setItem(LS_STATS, JSON.stringify(store));
}

export function resetStatsStore(){
  localStorage.removeItem(LS_STATS);
}

function updateRecord(records, key, candidate, better){
  const current = records[key];
  if (!current){
    records[key] = candidate;
    return true;
  }
  if (better(candidate, current)){
    records[key] = candidate;
    return true;
  }
  return false;
}

// Ajoute une session, et met à jour les records.
// Retourne { store, recordFlags }
export function addSessionToStore(session){
  const store = loadStatsStore();
  store.sessions.unshift(session);
  // On garde les 200 dernières (suffisant pour une classe)
  store.sessions = store.sessions.slice(0, 200);

  const records = store.records || (store.records = {});
  const flags = [];

  // --- Records individuels ---
  const topPlayer = (session.players || []).slice().sort((a,b)=> (b.score||0)-(a.score||0))[0];
  if (topPlayer){
    const did = updateRecord(
      records,
      "bestScore",
      {
        date: session.date,
        name: topPlayer.name,
        score: topPlayer.score,
        mode: session.gameMode,
        exerciseType: session.exerciseType,
        label: session.skillLabel
      },
      (cand, cur) => (cand.score || 0) > (cur.score || 0)
    );
    if (did) flags.push("bestScore");

    const didAcc = updateRecord(
      records,
      "bestAccuracy",
      {
        date: session.date,
        name: topPlayer.name,
        accuracy: Number(topPlayer.accuracy || 0),
        mode: session.gameMode,
        exerciseType: session.exerciseType
      },
      (cand, cur) => (cand.accuracy || 0) > (cur.accuracy || 0)
    );
    if (didAcc) flags.push("bestAccuracy");

    const didStreak = updateRecord(
      records,
      "bestStreak",
      {
        date: session.date,
        name: topPlayer.name,
        bestStreak: Number(topPlayer.bestStreak || 0),
        mode: session.gameMode,
        exerciseType: session.exerciseType
      },
      (cand, cur) => (cand.bestStreak || 0) > (cur.bestStreak || 0)
    );
    if (didStreak) flags.push("bestStreak");
  }

  // --- Record équipe ---
  const topTeam = (session.teamsSummary || []).slice().sort((a,b)=> (b.score||0)-(a.score||0))[0];
  if (topTeam){
    const didTeam = updateRecord(
      records,
      "bestTeamScore",
      {
        date: session.date,
        team: topTeam.name,
        score: topTeam.score,
        mode: session.gameMode,
        exerciseType: session.exerciseType
      },
      (cand, cur) => (cand.score || 0) > (cur.score || 0)
    );
    if (didTeam) flags.push("bestTeamScore");
  }

  // --- Record course (plus rapide) ---
  if (session.gameMode === "race" && Number.isFinite(session.elapsedSec)){
    const didRace = updateRecord(
      records,
      "fastestRace",
      {
        date: session.date,
        winner: session.winner?.name || "",
        elapsedSec: Number(session.elapsedSec),
        raceTarget: session.raceTarget,
        teamMode: !!session.teamMode
      },
      (cand, cur) => (cand.elapsedSec || Infinity) < (cur.elapsedSec || Infinity)
    );
    if (didRace) flags.push("fastestRace");
  }

  saveStatsStore(store);
  return { store, recordFlags: flags };
}

export function formatDateShort(iso){
  try{
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
  }catch{
    return String(iso || "");
  }
}

