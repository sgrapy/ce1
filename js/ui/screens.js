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
  $("screenMenu")?.classList.add("hidden");
  $("screenGame")?.classList.add("hidden");
  $("screenEnglish")?.classList.remove("hidden");

  // En anglais: on est en menu (pas de bouton fin)
  $("btnEndHeader")?.classList.add("hidden");
}
