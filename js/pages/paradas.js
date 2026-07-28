/* =========================================================
   js/pages/paradas.js — ranking das paradas nos boxes mais rápidas
   da temporada. A Jolpica só tem esse dado a partir de ~2012; em
   temporadas mais antigas a página mostra uma mensagem em vez de erro.
   ========================================================= */

import { API, fetchCached, loadPool, fetchSeasons, TTL_LIVE, TTL_HISTORIC } from "../api.js";
import { teamMeta, flagFor } from "../teams.js";
import { renderSubpageHeader, setPageTitle, pageParams } from "../layout.js";
import { t, applyStaticTranslations } from "../i18n.js";

/* a maioria das paradas vem como "2.345" (segundos), mas paradas muito
   longas (problema no carro, safety car etc.) vêm como "1:02.596"
   (minutos:segundos) — parseFloat sozinho cortaria isso em "1" */
function durationToSeconds(d){
  if (d.includes(":")){
    const [min, rest] = d.split(":");
    return Number(min) * 60 + Number(rest);
  }
  return parseFloat(d);
}

let SEASON = pageParams().season;
let LATEST_SEASON = null;

renderSubpageHeader(document.getElementById("topbar"), {
  backHref: SEASON ? `calendario.html?season=${SEASON}` : "calendario.html",
  backKey: "nav_calendar",
  extra: `<span class="sep">·</span><b data-i18n="topbar_season">TEMPORADA</b><select id="ps-season-select" class="season-select" aria-label="Selecionar temporada"></select>`,
  onLangChange: load,
});
applyStaticTranslations();

async function loadSeasonOptions(){
  const seasons = await fetchSeasons();
  LATEST_SEASON = seasons[0] || null;
  if (!SEASON) SEASON = LATEST_SEASON || new Date().getFullYear();

  const select = document.getElementById("ps-season-select");
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
  const content = document.getElementById("pitstops-content");
  content.innerHTML = `<div class="state-msg">${t("loading_pitstops")}</div>`;
  try{
    const isLive = LATEST_SEASON == null || SEASON === LATEST_SEASON;
    const ttl = isLive ? TTL_LIVE : TTL_HISTORIC;

    const [winnersData, standingsData] = await Promise.all([
      fetchCached(`${API}/${SEASON}/results/1.json?limit=40`, ttl),
      fetchCached(`${API}/${SEASON}/driverStandings.json`, ttl),
    ]);

    const races = winnersData.MRData.RaceTable.Races;
    if (!races.length) throw new Error(t("error_no_completed_races", { season: SEASON }));

    setPageTitle(t("page_title_pitstops", { season: SEASON }));
    document.title = t("doc_title_pitstops", { season: SEASON });
    document.getElementById("hero-sub").textContent =
      t("pitstops_hero_sub", { count: races.length, season: SEASON });

    const standings = standingsData.MRData.StandingsTable.StandingsLists[0]?.DriverStandings || [];
    const driverMap = new Map(standings.map(s => [s.Driver.driverId, {
      name: `${s.Driver.givenName} ${s.Driver.familyName}`,
      flag: flagFor(s.Driver.nationality),
      team: teamMeta(s.Constructors[0].constructorId, s.Constructors[0].name),
    }]));

    const pitstopsByRound = await loadPool(races.map(r => r.round), async (round) => {
      const data = await fetchCached(`${API}/${SEASON}/${round}/pitstops.json?limit=100`, ttl);
      const race = data.MRData.RaceTable.Races[0];
      const raceName = races.find(r => r.round === round)?.raceName || "";
      return (race?.PitStops || []).map(s => ({ ...s, raceName }));
    });

    const allStops = pitstopsByRound.flat();
    if (!allStops.length){
      content.innerHTML = `<div class="state-msg">${t("no_pitstop_data", { season: SEASON })}</div>`;
      return;
    }

    allStops.sort((a, b) => durationToSeconds(a.duration) - durationToSeconds(b.duration));
    const top = allStops.slice(0, 20);

    const rows = top.map((s, i) => {
      const d = driverMap.get(s.driverId) || { name: s.driverId, flag: "", team: { name: "—", color: "#888" } };
      return `
        <tr style="--c:${d.team.color}">
          <td class="mono">${i + 1}</td>
          <td class="dname">${d.flag} ${d.name}</td>
          <td class="dteam">${d.team.name}</td>
          <td>${s.raceName}</td>
          <td class="num mono">${s.lap}</td>
          <td class="num mono">${s.duration}s</td>
        </tr>`;
    }).join("");

    content.innerHTML = `
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>${t("standings_th_pos")}</th><th>${t("standings_th_driver")}</th><th>${t("standings_th_team")}</th><th>${t("th_race")}</th><th class="num">${t("th_lap")}</th><th class="num">${t("th_duration")}</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (err){
    content.innerHTML = `<div class="state-msg error">${t("error_load_pitstops", { err: err.message })}</div>`;
    console.error(err);
  }
}

loadSeasonOptions().then(load);
