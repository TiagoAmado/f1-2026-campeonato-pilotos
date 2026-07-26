/* =========================================================
   js/pages/treino.js — resultado do treino classificatório
   (Q1/Q2/Q3) de uma etapa.
   ========================================================= */

import { API, fetchCached, TTL_LIVE } from "../api.js";
import { teamMeta, flagFor } from "../teams.js";
import { renderSubpageHeader, setPageTitle, pageParams } from "../layout.js";

const { season: SEASON, round: ROUND } = pageParams();

renderSubpageHeader(document.getElementById("topbar"), {
  backHref: SEASON ? `calendario.html?season=${SEASON}` : "calendario.html",
  backLabel: "Calendário",
});

async function load(){
  const content = document.getElementById("quali-content");
  if (!SEASON || !ROUND){
    setPageTitle("Treino classificatório");
    document.getElementById("race-title").textContent = "Nenhuma corrida selecionada";
    content.innerHTML = '<div class="state-msg error">Selecione uma corrida no <a href="calendario.html">calendário</a>.</div>';
    return;
  }
  try{
    const data = await fetchCached(`${API}/${SEASON}/${ROUND}/qualifying.json?limit=40`, TTL_LIVE);
    const race = data.MRData.RaceTable.Races[0];
    if (!race){
      // a Jolpica não devolve nem a corrida quando não há dado de treino
      // pra ela (comum em temporadas bem antigas) — não é um erro real
      setPageTitle("Treino classificatório");
      document.getElementById("race-title").textContent = `Rodada ${ROUND} · ${SEASON}`;
      content.innerHTML = '<div class="state-msg">Sem dados de treino classificatório pra esta corrida.</div>';
      return;
    }

    document.title = `${race.raceName} · Treino classificatório`;
    setPageTitle(`${race.raceName} · Treino`);
    document.getElementById("race-title").textContent = race.raceName;
    document.getElementById("hero-sub").textContent =
      `${race.Circuit.circuitName} · ${race.Circuit.Location.locality}, ${race.Circuit.Location.country} · rodada ${race.round}, temporada ${SEASON}`;

    const quali = race.QualifyingResults || [];
    if (!quali.length){
      content.innerHTML = '<div class="state-msg">Sem dados de treino classificatório pra esta corrida.</div>';
      return;
    }

    const rows = quali.map(q => {
      const team = teamMeta(q.Constructor.constructorId, q.Constructor.name);
      return `
        <tr style="--c:${team.color}">
          <td class="mono">${q.position}</td>
          <td>
            <div class="drow">
              <span class="num-badge" style="--c:${team.color}">${q.number}</span>
              <div class="dname">${flagFor(q.Driver.nationality)} ${q.Driver.givenName} ${q.Driver.familyName}</div>
            </div>
          </td>
          <td class="dteam">${team.name}</td>
          <td class="num mono">${q.Q1 || "—"}</td>
          <td class="num mono">${q.Q2 || "—"}</td>
          <td class="num mono">${q.Q3 || "—"}</td>
        </tr>`;
    }).join("");

    content.innerHTML = `
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Pos</th><th>Piloto</th><th>Equipe</th><th class="num">Q1</th><th class="num">Q2</th><th class="num">Q3</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (err){
    content.innerHTML = `<div class="state-msg error">Não foi possível carregar o treino (${err.message}).</div>`;
    console.error(err);
  }
}
load();
