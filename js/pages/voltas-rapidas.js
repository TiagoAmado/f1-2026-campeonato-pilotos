/* =========================================================
   js/pages/voltas-rapidas.js — ranking das voltas mais rápidas da
   temporada: uma entrada por corrida (quem cravou a volta mais rápida
   daquela etapa), ordenado do tempo mais rápido pro mais lento.
   ========================================================= */

import { API, fetchCached, loadPool, fetchSeasons, TTL_LIVE, TTL_HISTORIC } from "../api.js";
import { teamMeta, flagFor } from "../teams.js";
import { renderSubpageHeader, setPageTitle, pageParams } from "../layout.js";

let SEASON = pageParams().season;
let LATEST_SEASON = null;

renderSubpageHeader(document.getElementById("topbar"), {
  backHref: SEASON ? `calendario.html?season=${SEASON}` : "calendario.html",
  backLabel: "Calendário",
  extra: `<span class="sep">·</span><b>TEMPORADA</b><select id="fl-season-select" class="season-select" aria-label="Selecionar temporada"></select>`,
});

/* "1:32.808" -> 92.808, pra poder ordenar os tempos */
function timeToSeconds(t){
  const [min, rest] = t.split(":");
  return Number(min) * 60 + Number(rest);
}

async function loadSeasonOptions(){
  const seasons = await fetchSeasons();
  LATEST_SEASON = seasons[0] || null;
  if (!SEASON) SEASON = LATEST_SEASON || new Date().getFullYear();

  const select = document.getElementById("fl-season-select");
  select.innerHTML = seasons.length
    ? seasons.map(y => `<option value="${y}">${y}</option>`).join("")
    : `<option value="${SEASON}">${SEASON}</option>`;
  select.value = SEASON;
  select.addEventListener("change", (e) => {
    SEASON = Number(e.target.value);
    load();
  });
}

async function load(){
  const content = document.getElementById("fastlaps-content");
  content.innerHTML = '<div class="state-msg">Carregando voltas…</div>';
  try{
    const isLive = LATEST_SEASON == null || SEASON === LATEST_SEASON;
    const ttl = isLive ? TTL_LIVE : TTL_HISTORIC;

    const winnersData = await fetchCached(`${API}/${SEASON}/results/1.json?limit=40`, ttl);
    const races = winnersData.MRData.RaceTable.Races;
    if (!races.length) throw new Error(`Nenhuma corrida concluída encontrada para ${SEASON}.`);

    setPageTitle(`Voltas mais rápidas · ${SEASON}`);
    document.title = `Voltas mais rápidas ${SEASON} · F1`;
    document.getElementById("hero-sub").textContent =
      `A volta mais rápida de cada uma das ${races.length} corridas já disputadas em ${SEASON}, ordenadas por tempo.`;

    const fastestByRound = await loadPool(races.map(r => r.round), async (round) => {
      const data = await fetchCached(`${API}/${SEASON}/${round}/results.json?limit=40`, ttl);
      const race = data.MRData.RaceTable.Races[0];
      const fastest = race?.Results.find(r => r.FastestLap && r.FastestLap.rank === "1");
      if (!fastest) return null;
      return {
        raceName: race.raceName,
        driver: fastest.Driver,
        team: teamMeta(fastest.Constructor.constructorId, fastest.Constructor.name),
        number: fastest.number,
        lap: fastest.FastestLap.lap,
        time: fastest.FastestLap.Time.time,
      };
    });

    const entries = fastestByRound.filter(Boolean);
    if (!entries.length){
      content.innerHTML = `<div class="state-msg">Sem dados de volta mais rápida pra ${SEASON} (a Jolpica só tem esse dado a partir de 2004).</div>`;
      return;
    }

    entries.sort((a, b) => timeToSeconds(a.time) - timeToSeconds(b.time));

    const rows = entries.map((e, i) => `
      <tr style="--c:${e.team.color}">
        <td class="mono">${i + 1}</td>
        <td>
          <div class="drow">
            <span class="num-badge" style="--c:${e.team.color}">${e.number}</span>
            <div class="dname">${flagFor(e.driver.nationality)} ${e.driver.givenName} ${e.driver.familyName}</div>
          </div>
        </td>
        <td class="dteam">${e.team.name}</td>
        <td>${e.raceName}</td>
        <td class="num mono">${e.lap}</td>
        <td class="num mono">${e.time}</td>
      </tr>`).join("");

    content.innerHTML = `
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Pos</th><th>Piloto</th><th>Equipe</th><th>Corrida</th><th class="num">Volta</th><th class="num">Tempo</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (err){
    content.innerHTML = `<div class="state-msg error">Não foi possível carregar as voltas rápidas (${err.message}).</div>`;
    console.error(err);
  }
}

loadSeasonOptions().then(load);
