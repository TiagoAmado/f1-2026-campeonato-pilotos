/* =========================================================
   js/pages/equipe.js — perfil de uma equipe numa temporada: pontos,
   vitórias, pódios, posição no campeonato, evolução de pontos e
   contribuição de cada piloto.
   ========================================================= */

import { API, fetchCached, fetchSeasons, TTL_LIVE, TTL_HISTORIC } from "../api.js";
import { teamMeta, flagFor, codeFor } from "../teams.js";
import { fmtDate } from "../format.js";
import { renderSubpageHeader, setPageTitle, pageParams } from "../layout.js";
import { createLineChart } from "../chart.js";

const TEAM_ID = pageParams().id;
let SEASON = pageParams().season;
let LATEST_SEASON = null;

renderSubpageHeader(document.getElementById("topbar"), {
  extra: `<span class="sep">·</span><b>TEMPORADA</b><select id="team-season-select" class="season-select" aria-label="Selecionar temporada"></select>`,
});

async function loadSeasonOptions(){
  const seasons = await fetchSeasons();
  LATEST_SEASON = seasons[0] || null;
  if (!SEASON) SEASON = LATEST_SEASON || new Date().getFullYear();

  const select = document.getElementById("team-season-select");
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
  const content = document.getElementById("team-content");
  if (!TEAM_ID){
    content.innerHTML = '<div class="state-msg error">Equipe não especificada.</div>';
    return;
  }
  content.innerHTML = '<div class="state-msg">Carregando perfil…</div>';
  try{
    const isLive = LATEST_SEASON == null || SEASON === LATEST_SEASON;
    const ttl = isLive ? TTL_LIVE : TTL_HISTORIC;

    const [resultsData, standingsData, sprintData] = await Promise.all([
      fetchCached(`${API}/${SEASON}/constructors/${TEAM_ID}/results.json?limit=100`, ttl),
      fetchCached(`${API}/${SEASON}/constructorStandings.json`, ttl),
      fetchCached(`${API}/${SEASON}/constructors/${TEAM_ID}/sprint.json?limit=100`, ttl),
    ]);

    const races = resultsData.MRData.RaceTable.Races;
    if (!races.length){
      setPageTitle("Perfil de equipe");
      content.innerHTML = `<div class="state-msg">Sem dados pra esta equipe na temporada ${SEASON}.</div>`;
      return;
    }

    const firstResult = races[0].Results[0];
    const team = teamMeta(TEAM_ID, firstResult.Constructor.name);
    const nationality = firstResult.Constructor.nationality;

    const standingsList = standingsData.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings || [];
    const standing = standingsList.find(c => c.Constructor.constructorId === TEAM_ID);

    // pontos de corrida + pontos de sprint (a Jolpica devolve os dois
    // separados; a pontuação total da equipe soma ambos)
    const sprintPtsByRound = new Map(
      sprintData.MRData.RaceTable.Races.map(r => [
        Number(r.round),
        r.SprintResults.reduce((sum, res) => sum + Number(res.points), 0),
      ])
    );
    const sprintPtsByDriver = new Map();
    sprintData.MRData.RaceTable.Races.forEach(r => r.SprintResults.forEach(res => {
      const key = res.Driver.driverId;
      sprintPtsByDriver.set(key, (sprintPtsByDriver.get(key) || 0) + Number(res.points));
    }));

    let cum = 0;
    const ptsEvolution = races.map(r => {
      const racePts = r.Results.reduce((sum, res) => sum + Number(res.points), 0);
      cum += racePts + (sprintPtsByRound.get(Number(r.round)) || 0);
      return cum;
    });
    const wins = races.filter(r => r.Results.some(res => res.positionText === "1")).length;
    const podiums = races.filter(r => r.Results.some(res => {
      const pos = Number(res.position);
      return !isNaN(pos) && pos <= 3;
    })).length;

    const driverTotals = new Map();
    races.forEach(r => r.Results.forEach(res => {
      const key = res.Driver.driverId;
      const prev = driverTotals.get(key) || {
        name: `${res.Driver.givenName} ${res.Driver.familyName}`,
        flag: flagFor(res.Driver.nationality),
        pts: 0,
      };
      prev.pts += Number(res.points);
      driverTotals.set(key, prev);
    }));
    sprintPtsByDriver.forEach((pts, key) => {
      const prev = driverTotals.get(key);
      if (prev) prev.pts += pts;
    });
    const driversList = [...driverTotals.entries()]
      .map(([id, d]) => ({ id, ...d }))
      .sort((a, b) => b.pts - a.pts);

    document.title = `${team.name} · Perfil de equipe`;
    setPageTitle(team.name);

    const driverRows = driversList.map(d => `
      <div class="cons-row" style="--c:${team.color}">
        <span class="sw"></span>
        <span class="cname"><a href="piloto.html?id=${d.id}&season=${SEASON}">${d.flag} ${d.name}</a></span>
        <span class="cpts mono">${d.pts} pts</span>
      </div>`).join("");

    content.innerHTML = `
      <h1>${flagFor(nationality)} ${team.name}</h1>
      <p class="sub">${standing ? `P${standing.position} no campeonato de construtores` : "Sem classificação"} · temporada ${SEASON}</p>
      <div class="stat-grid">
        <div class="stat-card"><span class="stat-value">${cum}</span><span class="stat-label">Pontos</span></div>
        <div class="stat-card"><span class="stat-value">${wins}</span><span class="stat-label">Vitórias</span></div>
        <div class="stat-card"><span class="stat-value">${podiums}</span><span class="stat-label">Pódios</span></div>
        <div class="stat-card"><span class="stat-value">${standing ? "P" + standing.position : "—"}</span><span class="stat-label">Posição</span></div>
      </div>
      <div class="chart-panel">
        <div class="chart-svg-wrap">
          <svg id="team-chart" viewBox="0 0 1160 540" preserveAspectRatio="xMidYMid meet"></svg>
          <div class="tooltip" id="team-tooltip">
            <div class="tt-driver"><span class="sw"></span><span class="tt-name"></span></div>
            <div class="tt-race"></div>
            <div class="tt-pts"></div>
          </div>
        </div>
      </div>
      <div class="cons-grid" style="margin-top:20px;grid-template-columns:1fr;max-width:360px;">${driverRows}</div>`;

    const chart = createLineChart({
      svg: document.getElementById("team-chart"),
      tooltip: document.getElementById("team-tooltip"),
      xLabels: races.map(r => codeFor(r.Circuit.circuitId, r.Circuit.Location.locality)),
      xLabelsFull: races.map(r => `${r.raceName} (${fmtDate(r.date)})`),
      valueLabel: "pts acumulados",
    });
    chart.setSeries([{
      id: TEAM_ID,
      color: team.color,
      dashed: false,
      label: team.name,
      pts: ptsEvolution,
    }]);
    chart.setVisible(new Set([TEAM_ID]));
    chart.render();
  } catch (err){
    content.innerHTML = `<div class="state-msg error">Não foi possível carregar o perfil (${err.message}).</div>`;
    console.error(err);
  }
}

loadSeasonOptions().then(load);
