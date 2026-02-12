// js/ui/keypad.js
import { $ } from "./dom.js";

function buildDisplayHTML(targetLen){
  const slots = Array.from({ length: targetLen }, () => `<span class="slot">•</span>`).join("");
  return `<div class="keypad-display-cloud"><div class="slots">${slots}</div></div>`;
}

function buildKeysHTML(){
  // Disposition type "clavier téléphone" : 1-2-3 / 4-5-6 / 7-8-9 / (vide) 0 retour
  const digits = [1,2,3,4,5,6,7,8,9];
  const keys = digits.map(d => `
    <button type="button" class="cloud-key" data-digit="${d}">
      <span class="cloud-shape" aria-hidden="true"></span>
      <span class="cloud-label">${d}</span>
    </button>
  `).join("");

  const zero = `
    <button type="button" class="cloud-key" data-digit="0">
      <span class="cloud-shape" aria-hidden="true"></span>
      <span class="cloud-label">0</span>
    </button>
  `;

  const back = `
    <button type="button" class="cloud-key cloud-back" data-action="back" aria-label="Retour">
      <span class="cloud-shape" aria-hidden="true"></span>
      <span class="cloud-label">↩︎</span>
    </button>
  `;

  const spacer = `<div class="keypad-spacer" aria-hidden="true"></div>`;

  return keys + spacer + zero + back;
}

function setSlotsValue(displayEl, valueStr, targetLen){
  const slots = Array.from(displayEl.querySelectorAll(".slot"));
  for (let i = 0; i < targetLen; i++){
    slots[i].textContent = valueStr[i] ?? "•";
    slots[i].classList.toggle("filled", i < valueStr.length);
  }
}

export function setKeypadVisible(playerIndex, visible){
  const pad = $("keypad-" + playerIndex);
  if (!pad) return;
  pad.classList.toggle("hidden", !visible);
}

export function setKeypadLocked(playerIndex, locked){
  const pad = $("keypad-" + playerIndex);
  if (!pad) return;
  pad.classList.toggle("locked", !!locked);
}

export function renderKeypad(playerIndex, question, onSubmit){
  const pad = $("keypad-" + playerIndex);
  if (!pad) return;

  const answer = Number(question?.answer ?? 0);
  const targetLen = Math.max(1, String(Math.abs(answer)).length);

  pad.classList.remove("locked");

  pad.innerHTML = `
    <div class="keypad-top">
      <div class="keypad-display">
        ${buildDisplayHTML(targetLen)}
      </div>
      <div class="keypad-hint">Tape ${targetLen} chiffre${targetLen > 1 ? "s" : ""} ☁️</div>
    </div>

    <div class="keypad-grid">
      ${buildKeysHTML()}
    </div>
  `;

  const display = pad.querySelector(".keypad-display-cloud");
  let valueStr = "";

  // init
  setSlotsValue(display, valueStr, targetLen);

  function submitIfReady(){
    if (valueStr.length !== targetLen) return;
    // lock immediately (évite double validation)
    pad.classList.add("locked");
    const n = Number(valueStr);
    // petite micro-pause pour laisser l'animation du bouton
    setTimeout(() => onSubmit?.(n), 10);
  }

  pad.querySelectorAll("button.cloud-key").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (pad.classList.contains("locked")) return;

      const digit = btn.dataset.digit;
      const action = btn.dataset.action;

      if (action === "back"){
        if (valueStr.length > 0){
          valueStr = valueStr.slice(0, -1);
          setSlotsValue(display, valueStr, targetLen);
        }
        return;
      }

      if (digit == null) return;

      // limitation à la longueur attendue
      if (valueStr.length >= targetLen) return;

      valueStr += String(digit);
      setSlotsValue(display, valueStr, targetLen);

      submitIfReady();
    });
  });
}
