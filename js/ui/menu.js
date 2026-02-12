import { $, escapeHtml } from "./dom.js";

// Render inputs pour les joueurs + (optionnel) choix d'équipes
// opts: { teamMode: boolean, teamCount: number, teams: number[] }
export function renderPlayerInputs(count, names = [], opts = {}) {
  const teamMode = !!opts.teamMode;
  const teamCount = Math.max(2, Number(opts.teamCount || 2));
  const teams = Array.isArray(opts.teams) ? opts.teams : [];

  const wrap = $("playersInputs");
  wrap.innerHTML = "";
  wrap.style.gridTemplateColumns = `repeat(${Math.min(4, count)}, 1fr)`;

  for (let i = 0; i < count; i++) {
    const div = document.createElement("div");
    div.className = "field";

    const currentTeam = Number.isFinite(teams[i]) ? Number(teams[i]) : (i % 2);

    const teamPicker = teamMode ? `
      <div class="team-row">
        <label class="mini">Équipe</label>
        <select data-team-index="${i}" class="mini">
          ${Array.from({ length: Math.min(teamCount, count) }, (_, t) => {
            const teamId = t + 1;
            const sel = (currentTeam === t) ? "selected" : "";
            return `<option value="${t}" ${sel}>Équipe ${teamId}</option>`;
          }).join("")}
        </select>
      </div>
    ` : "";

    div.innerHTML = `
      <label>Joueur ${i + 1}</label>
      <input data-player-index="${i}" type="text" placeholder="Prénom"
             value="${escapeHtml(names[i] || "")}" />
      ${teamPicker}
    `;
    wrap.appendChild(div);
  }
}

export function readPlayerNames() {
  const inputs = $("playersInputs").querySelectorAll("input[data-player-index]");
  return Array.from(inputs).map(inp => (inp.value || "").trim());
}

export function readPlayerTeams(){
  const selects = $("playersInputs").querySelectorAll("select[data-team-index]");
  if (!selects.length) return [];
  return Array.from(selects).map(sel => {
    const v = Number(sel.value);
    return Number.isFinite(v) ? v : 0;
  });
}
