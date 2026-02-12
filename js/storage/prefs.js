const LS_PREFS = "mathgame_teacher_prefs_v1";

export function loadPrefs(){
  try {
    return JSON.parse(localStorage.getItem(LS_PREFS) || "{}");
  } catch {
    return {};
  }
}

export function savePrefs(prefs){
  localStorage.setItem(LS_PREFS, JSON.stringify(prefs));
}

export function resetPrefs(){
  localStorage.removeItem(LS_PREFS);
}
