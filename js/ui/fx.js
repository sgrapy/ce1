// js/ui/fx.js
function randInt(min, max){
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getBalloonCenter(stageEl, balloonEl){
  const rectB = balloonEl.getBoundingClientRect();
  const rectS = stageEl.getBoundingClientRect();
  return {
    x: (rectB.left - rectS.left) + rectB.width / 2,
    y: (rectB.top  - rectS.top)  + rectB.height * 0.35
  };
}

export function addConfetti(stage, x, y){
  const pieces = 16;
  const greens = ["#22c55e", "#16a34a", "#4ade80", "#86efac"];
  for (let k = 0; k < pieces; k++){
    const el = document.createElement("div");
    el.className = "confetti-piece";
    el.style.background = greens[randInt(0, greens.length - 1)];

    const dx = randInt(-180, 180);
    const dy = randInt(-360, -140);
    const rot = randInt(-420, 420);

    el.style.setProperty("--dx", dx + "px");
    el.style.setProperty("--dy", dy + "px");
    el.style.setProperty("--rot", rot + "deg");

    el.style.left = (x - 5) + "px";
    el.style.top  = (y - 8) + "px";

    stage.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  const ring = document.createElement("div");
  ring.className = "good-ring";
  ring.style.left = (x - 5) + "px";
  ring.style.top  = (y - 5) + "px";
  stage.appendChild(ring);
  setTimeout(() => ring.remove(), 520);
}

export function addPoof(stage, x, y){
  const p = document.createElement("div");
  p.className = "poof";
  p.style.left = (x - 45) + "px";
  p.style.top  = (y - 45) + "px";
  stage.appendChild(p);
  setTimeout(() => p.remove(), 900);
}
