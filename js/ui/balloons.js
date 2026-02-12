// ui/balloons.js
import { $ } from "./dom.js";
import { BALLOON_HUES } from "./grid.js";

export function renderBalloons(playerIndex, question, onPick){
  const stage = $("stage-" + playerIndex);
  stage.innerHTML = "";
  stage.classList.remove("stage-fade", "locked");

  const count = question.choices.length;
  const xs = (count === 3) ? [15, 50, 80]
          : (count === 4) ? [12, 38, 62, 88]
          : [10, 30, 50, 70, 90];

  question.choices.forEach((val, idx) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "balloon floating";

    // ✅ IMPORTANT (sinon pas de correct highlight)
    b.dataset.value = String(val);

    b.style.left = `calc(${xs[idx]}% - 105px)`;
    b.style.setProperty("--float-duration", (5000 + Math.random()*3000).toFixed(0) + "ms");

    const hue = BALLOON_HUES[playerIndex % BALLOON_HUES.length];

    b.innerHTML = `
      <img src="assets/ballon.png" draggable="false"
        style="filter:hue-rotate(${hue}deg) saturate(1.25) brightness(1.05);" />
      <span class="num">${val}</span>
    `;

    b.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation(); // 👈 empêche le clic de remonter jusqu'à answer-area

  // sécurité : si déjà lock, on ignore
  if (stage.classList.contains("locked")) return;

  onPick(val, b);
});

    stage.appendChild(b);
  });
}
