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

  // ADD / SUB
  if (type === "add" || type === "sub"){
    const isAdd = type === "add";
    const defaultMax = isAdd ? 10 : 69;

    title.textContent = isAdd ? "Réglages (➕ Addition)" : "Réglages (➖ Soustraction)";

    // Valeurs par défaut pour le mode "calcul mental simplifié" (addition)
    const mentalMode = !!values.mentalMode;
    const mentalPlaces = Array.isArray(values.mentalPlaces) ? values.mentalPlaces : ["units", "tens", "hundreds"];

    box.innerHTML = `
      <div class="field"><label>aMin</label><input id="aMin" class="mini" type="number" min="0" max="999" value="${values.aMin ?? 0}"></div>
      <div class="field"><label>aMax</label><input id="aMax" class="mini" type="number" min="0" max="999" value="${values.aMax ?? defaultMax}"></div>
      <div class="field"><label>bMin</label><input id="bMin" class="mini" type="number" min="0" max="999" value="${values.bMin ?? 0}"></div>
      <div class="field"><label>bMax</label><input id="bMax" class="mini" type="number" min="0" max="999" value="${values.bMax ?? defaultMax}"></div>

      <div class="field">
        <label>${isAdd ? "Sans retenue (unités)" : "Sans emprunt (unités)"}</label>
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

      ${isAdd ? `
      <div class="field" style="grid-column: 1 / -1;">
        <label>🧠 Calcul mental (simplifié)</label>

        <label class="chipSwitch">
          <input id="mentalMode" type="checkbox" ${mentalMode ? "checked" : ""}>
          <span>Génère des additions du type <b>265 + 20</b> ou <b>265 + 100</b> (plus facile qu’un gros calcul complet).</span>
        </label>

        <div id="mentalOptions" class="${mentalMode ? "" : "hidden"}" style="margin-top:10px;">
          <div class="chips" style="gap:10px;">
            <label class="chip">
              <input type="checkbox" class="placeCheck" value="units" ${mentalPlaces.includes("units") ? "checked" : ""}>
              <span>Unités (1–9)</span>
            </label>
            <label class="chip">
              <input type="checkbox" class="placeCheck" value="tens" ${mentalPlaces.includes("tens") ? "checked" : ""}>
              <span>Dizaines (10–90)</span>
            </label>
            <label class="chip">
              <input type="checkbox" class="placeCheck" value="hundreds" ${mentalPlaces.includes("hundreds") ? "checked" : ""}>
              <span>Centaines (100–900)</span>
            </label>
          </div>
          <small>💡 Conseil : pour CE1, commence avec <b>unités + dizaines</b>, puis ajoute les centaines.</small>
        </div>
      </div>
      ` : ""}
    `;

    // wiring (show/hide + au moins 1 place cochée)
    if (isAdd){
      const toggle = box.querySelector("#mentalMode");
      const opts = box.querySelector("#mentalOptions");
      const sync = () => {
        if (!toggle || !opts) return;
        opts.classList.toggle("hidden", !toggle.checked);
      };
      toggle?.addEventListener("change", sync);
      sync();

      // sécurité: si aucune place cochée → on remet "tens"
      const ensureOne = () => {
        const checks = Array.from(box.querySelectorAll(".placeCheck"));
        if (!checks.length) return;
        const any = checks.some(c => c.checked);
        if (!any){
          const tens = checks.find(c => c.value === "tens");
          if (tens) tens.checked = true;
        }
      };
      box.querySelectorAll(".placeCheck").forEach(c => c.addEventListener("change", ensureOne));
      ensureOne();
    }

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


  // DIV (divisions exactes, sans virgule)
  if (type === "div"){
    title.textContent = "Réglages (➗ Division)";

    const divisors = Array.isArray(values.divisors) ? values.divisors : [2, 10];
    const selected = new Set(divisors.map(Number).filter(Number.isFinite));

    box.innerHTML = `
      <div class="field" style="grid-column: 1 / -1;">
        <label>Diviseurs autorisés</label>
        <div class="chips">
          <label class="chip">
            <input type="checkbox" class="divCheck" value="2" ${selected.has(2) ? "checked" : ""}>
            <span>÷2</span>
          </label>
          <label class="chip">
            <input type="checkbox" class="divCheck" value="10" ${selected.has(10) ? "checked" : ""}>
            <span>÷10</span>
          </label>
        </div>
        <small>✅ Divisions exactes uniquement (pas de virgule).</small>
      </div>

      <div class="field">
        <label>Résultat max</label>
        <input id="qMax" class="mini" type="number" min="10" max="999" value="${values.qMax ?? 99}">
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

    // sécurité: si l'utilisateur décoche tout → on remet ÷2
    const ensureOne = () => {
      const checks = Array.from(box.querySelectorAll(".divCheck"));
      const any = checks.some(c => c.checked);
      if (!any){
        const c2 = checks.find(c => c.value === "2");
        if (c2) c2.checked = true;
      }
    };
    box.querySelectorAll(".divCheck").forEach(c => c.addEventListener("change", ensureOne));
    ensureOne();

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


// Bonus : lecture des diviseurs depuis le DOM (division)
export function readSelectedDivisors(){
  const checks = document.querySelectorAll(".divCheck");
  const divisors = Array.from(checks)
    .filter(c => c.checked)
    .map(c => Number(c.value))
    .filter(n => Number.isFinite(n));

  return divisors.length ? divisors : [2, 10];
}
