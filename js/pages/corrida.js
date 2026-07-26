/* =========================================================
   js/pages/corrida.js — resultado completo de uma corrida
   (grid → chegada, tempo/status, volta mais rápida).
   ========================================================= */

import { API, fetchCached, TTL_LIVE } from "../api.js";
import { renderSubpageHeader, setPageTitle, pageParams } from "../layout.js";
import { renderResultsTable } from "../resultsTable.js";

const { season: SEASON, round: ROUND } = pageParams();

renderSubpageHeader(document.getElementById("topbar"), {
  backHref: SEASON ? `calendario.html?season=${SEASON}` : "calendario.html",
  backLabel: "Calendário",
});

async function load(){
  const content = document.getElementById("result-content");
  if (!SEASON || !ROUND){
    setPageTitle("Resultado da corrida");
    document.getElementById("race-title").textContent = "Nenhuma corrida selecionada";
    content.innerHTML = '<div class="state-msg error">Selecione uma corrida no <a href="calendario.html">calendário</a>.</div>';
    return;
  }
  try{
    // TTL curto (não o TTL_HISTORIC de outras páginas): um round que
    // ainda não foi disputado devolve resultado vazio, e um TTL longo
    // deixaria essa resposta vazia presa em cache mesmo depois da corrida
    // acontecer.
    const data = await fetchCached(`${API}/${SEASON}/${ROUND}/results.json?limit=40`, TTL_LIVE);
    const race = data.MRData.RaceTable.Races[0];
    if (!race) throw new Error("corrida não encontrada");

    document.title = `${race.raceName} · Resultado`;
    setPageTitle(race.raceName);
    document.getElementById("race-title").textContent = race.raceName;
    document.getElementById("hero-sub").textContent =
      `${race.Circuit.circuitName} · ${race.Circuit.Location.locality}, ${race.Circuit.Location.country} · rodada ${race.round}, temporada ${SEASON}`;

    renderResultsTable(content, race.Results || []);
  } catch (err){
    content.innerHTML = `<div class="state-msg error">Não foi possível carregar o resultado (${err.message}).</div>`;
    console.error(err);
  }
}
load();
