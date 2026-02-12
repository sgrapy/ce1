import { $ } from "./dom.js";

// --- helpers tables ---
function normalizeTables(tables){
  let arr = Array.isArray(tables) ? tables : [];
  arr = arr.map(n => Number(n)).filter(n => Number.isFinite(n));
  arr = arr.filter(n => n >= 0 && n <= 10);
  arr = Array.from(new Set(arr)).sort((a,b) => a-b);
  return arr;
}

function renderTablesPickerHTML(selectedTables){
  const selected = new Set(normalizeTables(selectedTables));

  const chips = Array.from({ length: 11 }, (_, t) => {
    const checked = selected.has(t) ? "checked" : "";
    return `
      <label class="chip">
        <input type="checkbox" class="tableCheck" value="${t}" ${checked}>
        <span>×${t}</span>
      </label>
    `;
  }).join("");

  return `
    <div class="tables-toolbar">
      <button type="button" class="btn btn-mini" data-tables-action="all">Tout cocher</button>
      <button type="button" class="btn btn-mini btn-ghost" data-tables-action="none">Tout décocher</button>
    </div>
    <div class="chips">${chips}</div>
  `;
}

function wireTablesPicker(boxEl){
  if (!boxEl) return;

  const btnAll = boxEl.querySelector('[data-tables-action="all"]');
  const btnNone = boxEl.querySelector('[data-tables-action="none"]');

  btnAll?.addEventListener("click", () => {
    boxEl.querySelectorAll(".tableCheck").forEach(c => c.checked = true);
  });

  btnNone?.addEventListener("click", () => {
    boxEl.querySelectorAll(".tableCheck").forEach(c => c.checked = false);
  });
}

// =========================
// MAIN
// =========================
export function renderMathSettings(type, values = {}){
  const box = $("mathSettings");
  const title = $("mathTitle");
  if (!box || !title) return;

  // ADD / SUB (inchangé)
  if (type === "add" || type === "sub"){
    title.textContent = type === "add" ? "Réglages (Addition)" : "Réglages (Soustraction)";
    box.innerHTML = `
      <div class="field"><label>aMin</label><input id="aMin" class="mini" type="number" value="${values.aMin ?? 0}"></div>
      <div class="field"><label>aMax</label><input id="aMax" class="mini" type="number" value="${values.aMax ?? 69}"></div>
      <div class="field"><label>bMin</label><input id="bMin" class="mini" type="number" value="${values.bMin ?? 0}"></div>
      <div class="field"><label>bMax</label><input id="bMax" class="mini" type="number" value="${values.bMax ?? 69}"></div>

      <div class="field">
        <label>Sans retenue (unités)</label>
        <select id="noCarryUnits" class="mini">
          <option value="true" ${(values.noCarryUnits ?? true) ? "selected" : ""}>Oui</option>
          <option value="false" ${values.noCarryUnits === false ? "selected" : ""}>Non</option>
        </select>
      </div>

      <div class="field"><label>Temps / question</label><input id="qTimeSec" class="mini" type="number" min="2" max="30" value="${values.qTimeSec ?? 6}"></div>

      <div class="field">
        <label>Choix QCM</label>
        <select id="choices" class="mini">
          <option value="3" ${(values.choices ?? 3) === 3 ? "selected":""}>3</option>
          <option value="4" ${(values.choices ?? 3) === 4 ? "selected":""}>4</option>
          <option value="5" ${(values.choices ?? 3) === 5 ? "selected":""}>5</option>
        </select>
      </div>
    `;
    return;
  }

  // MUL (tables multiples 0..10)
 if (type === "mul"){
  title.textContent = "Réglages (Multiplication)";
  const defaultTables = [2,3,4,5,6,7,8,9,10];

  box.innerHTML = `
    <div class="field" style="grid-column: 1 / -1;">
      <label>Tables autorisées</label>
      <div id="tablesPicker">
        ${renderTablesPickerHTML(values.tables ?? defaultTables)}
      </div>
      <small>Tu peux choisir plusieurs tables (ex : 2, 5, 10).</small>
    </div>

    <div class="field">
      <label>Temps / question</label>
      <input id="qTimeSec" class="mini" type="number" min="2" max="30" value="${values.qTimeSec ?? 6}">
    </div>

    <div class="field">
      <label>Choix QCM</label>
      <select id="choices" class="mini">
        <option value="3" ${(values.choices ?? 3) === 3 ? "selected":""}>3</option>
        <option value="4" ${(values.choices ?? 3) === 4 ? "selected":""}>4</option>
        <option value="5" ${(values.choices ?? 3) === 5 ? "selected":""}>5</option>
      </select>
    </div>
  `;

  wireTablesPicker($("tablesPicker"));
  return;
}


  // DIV (on laisse simple pour l'instant)
  if (type === "div"){
    title.textContent = "Réglages (Division)";
    box.innerHTML = `
      <div class="field" style="grid-column: 1 / -1;">
        <small>Division : à définir (on peut faire “divisions exactes” ensuite).</small>
      </div>
    `;
    return;
  }

  // fallback
  title.textContent = "Réglages";
  box.innerHTML = `<div class="field"><small>Type d'exercice inconnu.</small></div>`;
}

// Bonus : lecture des tables depuis le DOM (à appeler dans main.js)
export function readSelectedTables(){
  const checks = document.querySelectorAll(".tableCheck");
  const tables = Array.from(checks)
    .filter(c => c.checked)
    .map(c => Number(c.value))
    .filter(n => Number.isFinite(n));

  // sécurité : si rien coché -> 2..10
  return tables.length ? tables : [2,3,4,5,6,7,8,9,10];
}
