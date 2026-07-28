/* =========================================================
   js/pages/sprint.js — resultado da corrida sprint de uma etapa.
   Mesmo formato de resultado da corrida principal, por isso reaproveita
   js/resultsTable.js. Nem toda etapa/temporada tem sprint.
   ========================================================= */

import { API, fetchCached, TTL_LIVE } from "../api.js";
import { renderSubpageHeader, setPageTitle, pageParams } from "../layout.js";
import { renderResultsTable } from "../resultsTable.js";
import { t, applyStaticTranslations } from "../i18n.js";

const { season: SEASON, round: ROUND } = pageParams();

renderSubpageHeader(document.getElementById("topbar"), {
  backHref: SEASON ? `calendario.html?season=${SEASON}` : "calendario.html",
  backKey: "nav_calendar",
  onLangChange: load,
});
applyStaticTranslations();

async function load(){
  const content = document.getElementById("result-content");
  if (!SEASON || !ROUND){
    setPageTitle(t("sprint_result_eyebrow"));
    document.getElementById("race-title").textContent = t("no_race_selected");
    content.innerHTML = `<div class="state-msg error">${t("select_race_prompt")}</div>`;
    return;
  }
  try{
    const data = await fetchCached(`${API}/${SEASON}/${ROUND}/sprint.json?limit=40`, TTL_LIVE);
    const race = data.MRData.RaceTable.Races[0];
    if (!race){
      // a Jolpica não devolve nem a corrida quando a etapa não teve
      // sprint — não é um erro real
      setPageTitle(t("sprint_result_eyebrow"));
      document.getElementById("race-title").textContent = t("round_season_label", { round: ROUND, season: SEASON });
      content.innerHTML = `<div class="state-msg">${t("no_sprint_data")}</div>`;
      return;
    }

    document.title = `${race.raceName} · Sprint`;
    setPageTitle(`${race.raceName} · Sprint`);
    document.getElementById("race-title").textContent = race.raceName;
    document.getElementById("hero-sub").textContent = t("race_meta_line", {
      circuit: race.Circuit.circuitName,
      locality: race.Circuit.Location.locality,
      country: race.Circuit.Location.country,
      round: race.round,
      season: SEASON,
    });

    const results = race.SprintResults || [];
    if (!results.length){
      document.getElementById("result-content").innerHTML =
        `<div class="state-msg">${t("no_sprint_data")}</div>`;
      return;
    }
    renderResultsTable(content, results);
  } catch (err){
    content.innerHTML = `<div class="state-msg error">${t("error_load_result", { err: err.message })}</div>`;
    console.error(err);
  }
}
load();
