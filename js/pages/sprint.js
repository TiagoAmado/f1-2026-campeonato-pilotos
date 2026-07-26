/* =========================================================
   js/pages/sprint.js — resultado da corrida sprint de uma etapa.
   Mesmo formato de resultado da corrida principal, por isso reaproveita
   js/resultsTable.js. Nem toda etapa/temporada tem sprint.
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
    setPageTitle("Resultado da sprint");
    document.getElementById("race-title").textContent = "Nenhuma corrida selecionada";
    content.innerHTML = '<div class="state-msg error">Selecione uma corrida no <a href="calendario.html">calendário</a>.</div>';
    return;
  }
  try{
    const data = await fetchCached(`${API}/${SEASON}/${ROUND}/sprint.json?limit=40`, TTL_LIVE);
    const race = data.MRData.RaceTable.Races[0];
    if (!race){
      // a Jolpica não devolve nem a corrida quando a etapa não teve
      // sprint — não é um erro real
      setPageTitle("Resultado da sprint");
      document.getElementById("race-title").textContent = `Rodada ${ROUND} · ${SEASON}`;
      content.innerHTML = '<div class="state-msg">Não houve sprint nesta etapa.</div>';
      return;
    }

    document.title = `${race.raceName} · Sprint`;
    setPageTitle(`${race.raceName} · Sprint`);
    document.getElementById("race-title").textContent = race.raceName;
    document.getElementById("hero-sub").textContent =
      `${race.Circuit.circuitName} · ${race.Circuit.Location.locality}, ${race.Circuit.Location.country} · rodada ${race.round}, temporada ${SEASON}`;

    const results = race.SprintResults || [];
    if (!results.length){
      document.getElementById("result-content").innerHTML =
        '<div class="state-msg">Não houve sprint nesta etapa.</div>';
      return;
    }
    renderResultsTable(content, results);
  } catch (err){
    content.innerHTML = `<div class="state-msg error">Não foi possível carregar o resultado (${err.message}).</div>`;
    console.error(err);
  }
}
load();
