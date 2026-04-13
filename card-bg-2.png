import { $ } from "./dom.js";

export function showMenu(){
  $("screenMenu")?.classList.remove("hidden");
  $("screenGame")?.classList.add("hidden");
  $("screenEnglish")?.classList.add("hidden");

  // En menu: Fin caché
  $("btnEndHeader")?.classList.add("hidden");
}

export function showGame(){
  $("screenMenu")?.classList.add("hidden");
  $("screenGame")?.classList.remove("hidden");
  $("screenEnglish")?.classList.add("hidden");

  // En jeu: Fin visible
  $("btnEndHeader")?.classList.remove("hidden");
}

export function showEnglish(){
  // Anglais CE1 utilise le même menu & écran de jeu que Maths.
  // On ne montre pas l'ancien écran "flashcards".
  $("screenMenu")?.classList.remove("hidden");
  $("screenGame")?.classList.add("hidden");
  $("screenEnglish")?.classList.add("hidden");
  $("btnEndHeader")?.classList.add("hidden");
}
