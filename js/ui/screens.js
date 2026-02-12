import { $ } from "./dom.js";

export function showMenu(){
  $("screenMenu")?.classList.remove("hidden");
  $("screenGame")?.classList.add("hidden");

  // En menu: Fin caché
  $("btnEndHeader")?.classList.add("hidden");
}

export function showGame(){
  $("screenMenu")?.classList.add("hidden");
  $("screenGame")?.classList.remove("hidden");

  // En jeu: Fin visible
  $("btnEndHeader")?.classList.remove("hidden");
}
