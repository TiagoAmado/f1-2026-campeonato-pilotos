/* =========================================================
   js/pages/comparador.js — comparação cabeça a cabeça entre dois
   pilotos na mesma temporada: pontos, vitórias, pódios, poles e
   confrontos diretos (quem terminou na frente em cada rodada).
   ========================================================= */

import { API, fetchCached, fetchSeasons, TTL_LIVE, TTL_HISTORIC } from "../api.js";
import { flagFor } from "../teams.js";
import { renderSubpageHeader, setPageTitle, pageParams } from "../layout.js";
import { fetchDriverSeasonStats } from "../driverStats.js";
import { t, applyStaticTranslations } from "../i18n.js";

let SEASON = pageParams().season;
let LATEST_SEASON = null;
let DRIVER_A = pageParams().a;
let DRIVER_B = pageParams().b;

renderSubpageHeader(document.getElementById("topbar"), {
  extra: `<span class="sep">·</span><b data-i18n="topbar_season">TEMPORADA</b><select id="h2h-season-select" class="season-select" aria-label="Selecionar temporada"></select>`,
  onLangChange: loadComparison,
});
applyStaticTranslations();

/* conta em quantas rodadas cada piloto terminou na frente do outro —
   só considera rodadas em que os dois participaram */
function headToHead(statsA, statsB){
  let aAhead = 0, bAhead = 0, rounds = 0;
  const allRounds = new Set([...statsA.byRound.keys(), ...statsB.byRound.keys()]);
  allRounds.forEach(round => {
    const a = statsA.byRound.get(round);
    const b = statsB.byRound.get(round);
    if (!a || !b) return;
    rounds++;
    const posA = Number(a.position), posB = Number(b.position);
    const aFinished = !isNaN(posA), bFinished = !isNaN(posB);
    if (aFinished && bFinished){
      if (posA < posB) aAhead++; else if (posB < posA) bAhead++;
    } else if (aFinished && !bFinished){
      aAhead++;
    } else if (bFinished && !aFinished){
      bAhead++;
    }
  });
  return { aAhead, bAhead, rounds };
}

function sideHtml(stats){
  return `
    <div class="h2h-side" style="--c:${stats.team.color}">
      <h2>${flagFor(stats.driver.nationality)} ${stats.driver.givenName} ${stats.driver.familyName}</h2>
      <p class="team">${stats.team.name}</p>
      <div class="h2h-stats">
        <div><span class="stat-value">${stats.totalPts}</span><span class="stat-label">${t("standings_th_points")}</span></div>
        <div><span class="stat-value">${stats.wins}</span><span class="stat-label">${t("standings_th_wins")}</span></div>
        <div><span class="stat-value">${stats.podiums}</span><span class="stat-label">${t("stat_podiums")}</span></div>
        <div><span class="stat-value">${stats.poles}</span><span class="stat-label">Poles</span></div>
      </div>
    </div>`;
}

async function loadSeasonOptions(){
  const seasons = await fetchSeasons();
  LATEST_SEASON = seasons[0] || null;
  if (!SEASON) SEASON = LATEST_SEASON || new Date().getFullYear();

  const select = document.getElementById("h2h-season-select");
  select.innerHTML = seasons.length
    ? seasons.map(y => `<option value="${y}">${y}</option>`).join("")
    : `<option value="${SEASON}">${SEASON}</option>`;
  select.value = SEASON;
  select.addEventListener("change", (e) => {
    SEASON = Number(e.target.value);
    DRIVER_A = null; DRIVER_B = null; // volta a escolher líder/vice da nova temporada
    loadDriverOptions().then(loadComparison);
  });
}

/* popula os dois seletores com todos os pilotos da temporada (a partir
   da classificação final), e escolhe líder/vice como padrão */
async function loadDriverOptions(){
  const isLive = LATEST_SEASON == null || SEASON === LATEST_SEASON;
  const ttl = isLive ? TTL_LIVE : TTL_HISTORIC;
  const data = await fetchCached(`${API}/${SEASON}/driverStandings.json`, ttl);
  const standings = data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings || [];

  const selectA = document.getElementById("driver-a-select");
  const selectB = document.getElementById("driver-b-select");
  const options = standings.map(s =>
    `<option value="${s.Driver.driverId}">${s.Driver.givenName} ${s.Driver.familyName}</option>`
  ).join("");
  selectA.innerHTML = options;
  selectB.innerHTML = options;

  if (!DRIVER_A) DRIVER_A = standings[0]?.Driver.driverId;
  if (!DRIVER_B) DRIVER_B = standings[1]?.Driver.driverId;
  selectA.value = DRIVER_A;
  selectB.value = DRIVER_B;

  selectA.addEventListener("change", (e) => { DRIVER_A = e.target.value; loadComparison(); });
  selectB.addEventListener("change", (e) => { DRIVER_B = e.target.value; loadComparison(); });
}

async function loadComparison(){
  const content = document.getElementById("h2h-content");
  if (!DRIVER_A || !DRIVER_B){
    setPageTitle(t("compare_eyebrow"));
    content.innerHTML = `<div class="state-msg error">${t("error_not_enough_drivers")}</div>`;
    return;
  }
  content.innerHTML = `<div class="state-msg">${t("loading_comparison")}</div>`;
  try{
    const isLive = LATEST_SEASON == null || SEASON === LATEST_SEASON;
    const ttl = isLive ? TTL_LIVE : TTL_HISTORIC;

    const [statsA, statsB] = await Promise.all([
      fetchDriverSeasonStats(DRIVER_A, SEASON, ttl),
      fetchDriverSeasonStats(DRIVER_B, SEASON, ttl),
    ]);

    if (!statsA || !statsB){
      content.innerHTML = `<div class="state-msg">${t("error_driver_not_raced")}</div>`;
      return;
    }
    if (DRIVER_A === DRIVER_B){
      content.innerHTML = `<div class="state-msg error">${t("error_choose_different_drivers")}</div>`;
      return;
    }

    const h2h = headToHead(statsA, statsB);
    document.title = t("page_title_compare", { a: statsA.driver.familyName, b: statsB.driver.familyName });
    setPageTitle(`${statsA.driver.familyName} vs ${statsB.driver.familyName}`);

    content.innerHTML = `
      <div class="h2h-grid">
        ${sideHtml(statsA)}
        <div class="h2h-vs">
          <div class="h2h-score">${h2h.aAhead} × ${h2h.bAhead}</div>
          <div class="h2h-label">${t("h2h_label", { rounds: h2h.rounds })}</div>
        </div>
        ${sideHtml(statsB)}
      </div>`;
  } catch (err){
    content.innerHTML = `<div class="state-msg error">${t("error_load_comparison", { err: err.message })}</div>`;
    console.error(err);
  }
}

loadSeasonOptions().then(loadDriverOptions).then(loadComparison);
