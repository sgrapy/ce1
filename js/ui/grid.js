import { $, escapeHtml } from "./dom.js";

export const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"];
export const BALLOON_HUES = [140, 0, 250, 185];

export function renderGrid({ layout, playersCount, names }) {
  const grid = $("gameGrid");
  grid.style.gridTemplateColumns = `repeat(${layout.cols}, minmax(0,1fr))`;
  grid.style.gridTemplateRows = `repeat(${layout.rows}, minmax(0,1fr))`;
  grid.innerHTML = "";

  for (let i = 0; i < playersCount; i++) {
    const card = document.createElement("div");
    card.className = "player-card";
    card.style.setProperty("--card-bg", `url("assets/card-bg-${i+1}.png")`);
    card.style.outline = `3px solid ${COLORS[i]}`;
    card.style.outlineOffset = "-3px";

    card.innerHTML = `
      <div class="player-header">
        <div class="player-name">
          <span class="color-dot" style="background:${COLORS[i]}"></span>
          <span>${escapeHtml(names[i] || `Joueur ${i+1}`)}</span>
        </div>
        <div>Score: <span id="score-${i}">0</span></div>
      </div>

      <div class="player-sub">
        ✅ <span id="ok-${i}">0</span> &nbsp; ❌ <span id="no-${i}">0</span>
      </div>

      <div class="question" id="q-${i}">—</div>

      <div class="answer-area" id="answer-${i}">

        <div class="balloon-stage" id="stage-${i}"></div>
        <div class="keypad hidden" id="keypad-${i}"></div>
        <div class="explain hidden" id="explain-${i}"></div>
      </div>
    `;
    grid.appendChild(card);
  }
}
