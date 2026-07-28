/* =========================================================
   js/pages/corrida.js — resultado completo de uma corrida
   (grid → chegada, tempo/status, volta mais rápida).
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
    setPageTitle(t("race_result_eyebrow"));
    document.getElementById("race-title").textContent = t("no_race_selected");
    content.innerHTML = `<div class="state-msg error">${t("select_race_prompt")}</div>`;
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

    document.title = t("page_title_race_result", { name: race.raceName });
    setPageTitle(race.raceName);
    document.getElementById("race-title").textContent = race.raceName;
    document.getElementById("hero-sub").textContent = t("race_meta_line", {
      circuit: race.Circuit.circuitName,
      locality: race.Circuit.Location.locality,
      country: race.Circuit.Location.country,
      round: race.round,
      season: SEASON,
    });

    renderResultsTable(content, race.Results || []);
  } catch (err){
    content.innerHTML = `<div class="state-msg error">${t("error_load_result", { err: err.message })}</div>`;
    console.error(err);
  }
}
load();
