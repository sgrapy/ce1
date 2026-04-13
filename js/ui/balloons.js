// ui/balloons.js
import { $ } from "./dom.js";
import { BALLOON_HUES } from "./grid.js";

function computeBalloonLayout(stage, count){
  const stageWidth = Math.max(stage?.clientWidth || 0, 320);
  const stageHeight = Math.max(stage?.clientHeight || 0, 180);

  const sideGap = Math.max(10, Math.min(28, stageWidth * 0.03));
  const usableWidth = Math.max(stageWidth - sideGap * 2, stageWidth * 0.86);
  const slotWidth = usableWidth / Math.max(count, 1);

  // Taille pilotée par l'espace horizontal ET vertical disponible.
  // Sur une grille 2x2 avec 5 réponses, ça évite le chevauchement.
  const width = Math.round(
    Math.max(
      72,
      Math.min(
        210,
        slotWidth * 0.9,
        stageHeight * 0.78
      )
    )
  );

  const labelSize = Math.round(
    Math.max(18, Math.min(54, width * 0.24))
  );

  const positions = Array.from({ length: count }, (_, idx) => {
    const center = sideGap + (slotWidth * idx) + (slotWidth / 2);
    const left = Math.round(center - width / 2);
    return left;
  });

  return { width, labelSize, positions };
}

export function renderBalloons(playerIndex, question, onPick){
  const stage = $("stage-" + playerIndex);
  if (!stage) return;

  stage.innerHTML = "";
  stage.classList.remove("stage-fade", "locked");

  const count = question.choices.length;
  const { width, labelSize, positions } = computeBalloonLayout(stage, count);

  question.choices.forEach((val, idx) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "balloon floating";

    // ✅ IMPORTANT (sinon pas de correct highlight)
    b.dataset.value = String(val);

    b.style.left = `${positions[idx]}px`;
    b.style.width = `${width}px`;
    b.style.setProperty("--balloon-font-size", `${labelSize}px`);
    b.style.setProperty("--float-duration", (5000 + Math.random() * 3000).toFixed(0) + "ms");

    const isEnglish = question?.kind === "english";
    const answerStyle = isEnglish ? (question?.answerStyle || "text") : "text";

    // Couleur ballon:
    // - normal: par joueur
    // - anglais "couleur": par choix (hueDeg)
    const hue = (isEnglish && answerStyle === "color" && Array.isArray(question?.choiceHues))
      ? Number(question.choiceHues[idx] ?? 0)
      : BALLOON_HUES[playerIndex % BALLOON_HUES.length];

    // Label:
    // - normal: afficher val
    // - anglais "couleur": pas de texte (on choisit à la couleur)
    const label = (isEnglish && answerStyle === "color") ? "" : String(val);

    b.innerHTML = `
      <img src="assets/ballon.png" draggable="false"
        style="filter:hue-rotate(${hue}deg) saturate(1.25) brightness(1.05);" />
      <span class="num" ${label ? "" : 'aria-hidden="true"'}>${label}</span>
    `;

    if (isEnglish && answerStyle === "color"){
      b.classList.add("balloon-color-only");
    }

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
