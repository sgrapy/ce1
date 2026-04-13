// ui/balloons.js
import { $ } from "./dom.js";
import { BALLOON_HUES } from "./grid.js";

function computeBalloonLayout(stage, count){
  const stageRect = stage?.getBoundingClientRect?.() || { width: 0, height: 0 };
  const parentRect = stage?.parentElement?.getBoundingClientRect?.() || { width: 0, height: 0 };

  const stageWidth = Math.max(stageRect.width || parentRect.width || stage?.clientWidth || 0, 320);
  const stageHeight = Math.max(stageRect.height || parentRect.height || stage?.clientHeight || 0, 220);
  const narrowStage = stageWidth < 420;

  let sideGap;
  let betweenGap;
  let widthCap;
  let heightFactor;
  let minPreferredWidth;

  if (count <= 2){
    // En 2 joueurs on garde des ballons plus généreux.
    sideGap = Math.max(10, Math.min(18, stageWidth * 0.03));
    betweenGap = Math.max(14, Math.min(28, stageWidth * 0.028));
    widthCap = 270;
    heightFactor = 0.78;
    minPreferredWidth = count === 1 ? 120 : 110;
  } else if (count === 3){
    sideGap = Math.max(12, Math.min(20, stageWidth * 0.035));
    betweenGap = Math.max(10, Math.min(18, stageWidth * 0.02));
    widthCap = 225;
    heightFactor = 0.74;
    minPreferredWidth = 95;
  } else if (count === 4){
    sideGap = Math.max(14, Math.min(22, stageWidth * 0.04));
    betweenGap = Math.max(10, Math.min(18, stageWidth * 0.024));
    widthCap = 195;
    heightFactor = 0.70;
    minPreferredWidth = 82;
  } else {
    // Cas dense : 5 ballons (notamment 4 joueurs).
    // On garde de l'air entre eux, mais un peu moins qu'avant pour
    // leur rendre de la taille sans recréer les clics parasites.
    sideGap = Math.max(12, Math.min(22, stageWidth * 0.04));
    betweenGap = narrowStage
      ? 14
      : Math.max(12, Math.min(18, stageWidth * 0.024));
    widthCap = narrowStage ? 176 : 188;
    heightFactor = narrowStage ? 0.66 : 0.69;
    minPreferredWidth = 66;
  }

  const usableWidth = Math.max(
    stageWidth - (sideGap * 2) - (betweenGap * Math.max(count - 1, 0)),
    0
  );
  const slotWidth = usableWidth / Math.max(count, 1);

  // Important : ne jamais dépasser la case dispo, sinon on recrée du chevauchement.
  const width = Math.round(
    Math.min(
      slotWidth,
      Math.max(minPreferredWidth, Math.min(widthCap, stageHeight * heightFactor))
    )
  );

  const labelSize = Math.round(
    Math.max(16, Math.min(54, width * (count >= 5 ? 0.22 : 0.24)))
  );

  const bottomOffset = Math.round(-width * (count >= 5 ? 0.31 : 0.34));

  const positions = Array.from({ length: count }, (_, idx) => {
    const cellLeft = sideGap + idx * (slotWidth + betweenGap);
    const left = Math.round(cellLeft + ((slotWidth - width) / 2));
    return left;
  });

  return { width, labelSize, bottomOffset, positions };
}

export function renderBalloons(playerIndex, question, onPick){
  const stage = $("stage-" + playerIndex);
  if (!stage) return;

  stage.innerHTML = "";
  stage.classList.remove("stage-fade", "locked");

  const count = question.choices.length;
  const { width, labelSize, bottomOffset, positions } = computeBalloonLayout(stage, count);

  question.choices.forEach((val, idx) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "balloon floating";

    // ✅ IMPORTANT (sinon pas de correct highlight)
    b.dataset.value = String(val);

    b.style.left = `${positions[idx]}px`;
    b.style.width = `${width}px`;
    b.style.setProperty("--balloon-font-size", `${labelSize}px`);
    b.style.setProperty("--balloon-bottom", `${bottomOffset}px`);
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
