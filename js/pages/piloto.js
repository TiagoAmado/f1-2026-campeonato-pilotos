/* =========================================================
   js/pages/piloto.js — perfil de um piloto numa temporada: pontos,
   vitórias, pódios, poles e evolução de pontos corrida a corrida.
   ========================================================= */

import { fetchSeasons, TTL_LIVE, TTL_HISTORIC } from "../api.js";
import { flagFor, codeFor } from "../teams.js";
import { fmtDate } from "../format.js";
import { renderSubpageHeader, setPageTitle, pageParams } from "../layout.js";
import { createLineChart } from "../chart.js";
import { fetchDriverSeasonStats } from "../driverStats.js";

const DRIVER_ID = pageParams().id;
let SEASON = pageParams().season;
let LATEST_SEASON = null;

renderSubpageHeader(document.getElementById("topbar"), {
  extra: `<span class="sep">·</span><b>TEMPORADA</b><select id="driver-season-select" class="season-select" aria-label="Selecionar temporada"></select>`,
});

async function loadSeasonOptions(){
  const seasons = await fetchSeasons();
  LATEST_SEASON = seasons[0] || null;
  if (!SEASON) SEASON = LATEST_SEASON || new Date().getFullYear();

  const select = document.getElementById("driver-season-select");
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
  const content = document.getElementById("driver-content");
  if (!DRIVER_ID){
    content.innerHTML = '<div class="state-msg error">Piloto não especificado.</div>';
    return;
  }
  content.innerHTML = '<div class="state-msg">Carregando perfil…</div>';
  try{
    const isLive = LATEST_SEASON == null || SEASON === LATEST_SEASON;
    const ttl = isLive ? TTL_LIVE : TTL_HISTORIC;

    const stats = await fetchDriverSeasonStats(DRIVER_ID, SEASON, ttl);
    if (!stats){
      setPageTitle("Perfil de piloto");
      content.innerHTML = `<div class="state-msg">Sem dados pra este piloto na temporada ${SEASON}.</div>`;
      return;
    }
    const { driver, team, races, ptsEvolution, totalPts, wins, podiums, poles, byRound } = stats;
    const lastResult = races[races.length - 1].Results[0];

    document.title = `${driver.givenName} ${driver.familyName} · Perfil`;
    setPageTitle(`${driver.givenName} ${driver.familyName}`);

    const rows = races.map(r => {
      const round = byRound.get(Number(r.round));
      return `
        <tr>
          <td class="mono">${r.round}</td>
          <td>${r.raceName}</td>
          <td class="num mono">${round.grid}</td>
          <td class="mono">${round.positionText}</td>
          <td class="num mono">${round.points}</td>
        </tr>`;
    }).join("");

    content.innerHTML = `
      <h1>${flagFor(driver.nationality)} ${driver.givenName} ${driver.familyName}</h1>
      <p class="sub"><a href="equipe.html?id=${lastResult.Constructor.constructorId}&season=${SEASON}">${team.name}</a> · #${lastResult.number} · ${driver.nationality} · temporada ${SEASON}</p>
      <div class="stat-grid">
        <div class="stat-card"><span class="stat-value">${totalPts}</span><span class="stat-label">Pontos</span></div>
        <div class="stat-card"><span class="stat-value">${wins}</span><span class="stat-label">Vitórias</span></div>
        <div class="stat-card"><span class="stat-value">${podiums}</span><span class="stat-label">Pódios</span></div>
        <div class="stat-card"><span class="stat-value">${poles}</span><span class="stat-label">Poles</span></div>
      </div>
      <div class="chart-panel">
        <div class="chart-svg-wrap">
          <svg id="pilot-chart" viewBox="0 0 1160 540" preserveAspectRatio="xMidYMid meet"></svg>
          <div class="tooltip" id="pilot-tooltip">
            <div class="tt-driver"><span class="sw"></span><span class="tt-name"></span></div>
            <div class="tt-race"></div>
            <div class="tt-pts"></div>
          </div>
        </div>
      </div>
      <div class="table-scroll" style="margin-top:20px;">
        <table>
          <thead><tr><th>Rodada</th><th>Corrida</th><th class="num">Grid</th><th>Result.</th><th class="num">Pontos</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    const chart = createLineChart({
      svg: document.getElementById("pilot-chart"),
      tooltip: document.getElementById("pilot-tooltip"),
      xLabels: races.map(r => codeFor(r.Circuit.circuitId, r.Circuit.Location.locality)),
      xLabelsFull: races.map(r => `${r.raceName} (${fmtDate(r.date)})`),
      valueLabel: "pts acumulados",
    });
    chart.setSeries([{
      id: DRIVER_ID,
      color: team.color,
      dashed: false,
      label: `${flagFor(driver.nationality)} ${driver.givenName} ${driver.familyName}`,
      pts: ptsEvolution,
    }]);
    chart.setVisible(new Set([DRIVER_ID]));
    chart.render();
  } catch (err){
    content.innerHTML = `<div class="state-msg error">Não foi possível carregar o perfil (${err.message}).</div>`;
    console.error(err);
  }
}

loadSeasonOptions().then(load);
