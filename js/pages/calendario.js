/* =========================================================
   js/pages/calendario.js — calendário completo de uma temporada:
   corridas já disputadas e próximas, com contagem regressiva pra
   a próxima etapa.
   ========================================================= */

import { API, fetchCached, fetchSeasons, TTL_LIVE, TTL_HISTORIC } from "../api.js";
import { fmtDateLong } from "../format.js";
import { renderSubpageHeader, setPageTitle, pageParams } from "../layout.js";

let SEASON = pageParams().season;
let LATEST_SEASON = null;

function dayDiff(iso){
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(iso + "T00:00:00");
  return Math.round((d - today) / 86400000);
}

function countdownText(days){
  if (days <= 0) return "É hoje!";
  if (days === 1) return "Amanhã";
  return `Daqui a ${days} dias`;
}

async function loadSeasonOptions(){
  const seasons = await fetchSeasons();
  LATEST_SEASON = seasons[0] || null;
  if (!SEASON) SEASON = LATEST_SEASON || new Date().getFullYear();

  const select = document.getElementById("cal-season-select");
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
  const listEl = document.getElementById("cal-list");
  listEl.innerHTML = '<div class="state-msg">Carregando corridas…</div>';
  try{
    const isLive = LATEST_SEASON == null || SEASON === LATEST_SEASON;
    const ttl = isLive ? TTL_LIVE : TTL_HISTORIC;
    const data = await fetchCached(`${API}/${SEASON}.json?limit=40`, ttl);
    const races = data.MRData.RaceTable.Races;
    if (races.length === 0) throw new Error(`Nenhuma corrida encontrada para ${SEASON}.`);

    const todayIso = new Date().toISOString().slice(0, 10);
    const nextIdx = races.findIndex(r => r.date >= todayIso);

    setPageTitle(`Calendário · ${SEASON}`);
    document.getElementById("hero-sub").textContent =
      `${races.length} corridas na temporada ${SEASON}.`;
    document.getElementById("season-rankings").innerHTML = `
      <a href="paradas.html?season=${SEASON}">Paradas mais rápidas →</a>
      <a href="voltas-rapidas.html?season=${SEASON}">Voltas mais rápidas →</a>
      <a href="confiabilidade.html?season=${SEASON}">Confiabilidade por equipe →</a>`;

    listEl.innerHTML = races.map((r, i) => {
      const isNext = i === nextIdx;
      const isPast = nextIdx === -1 || i < nextIdx;
      return `
        <div class="cal-row ${isNext ? "next" : ""} ${isPast ? "past" : ""}">
          <div class="cal-round mono">RODADA ${r.round}</div>
          <div class="cal-main">
            <div class="cal-name">${r.raceName}</div>
            <div class="cal-circuit">${r.Circuit.Location.locality}, ${r.Circuit.Location.country} · ${r.Circuit.circuitName}</div>
          </div>
          <div class="cal-date">
            <div class="cal-date-full mono">${fmtDateLong(r.date)}</div>
            ${isNext ? `<div class="cal-countdown">${countdownText(dayDiff(r.date))}</div>` : ""}
          </div>
          ${r.Sprint ? '<span class="cal-badge">Sprint</span>' : ""}
          ${isPast ? `
            <div class="cal-links">
              <a href="corrida.html?season=${SEASON}&round=${r.round}">Corrida →</a>
              <a href="treino.html?season=${SEASON}&round=${r.round}">Treino →</a>
              ${r.Sprint ? `<a href="sprint.html?season=${SEASON}&round=${r.round}">Sprint →</a>` : ""}
            </div>` : ""}
        </div>`;
    }).join("");
  } catch (err){
    listEl.innerHTML = `<div class="state-msg error">Não foi possível carregar o calendário agora (${err.message}).</div>`;
    console.error(err);
  }
}

renderSubpageHeader(document.getElementById("topbar"), {
  extra: `<span class="sep">·</span><b>TEMPORADA</b><select id="cal-season-select" class="season-select" aria-label="Selecionar temporada"></select>`,
});
loadSeasonOptions().then(load);
