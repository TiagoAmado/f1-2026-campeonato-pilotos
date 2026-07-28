/* =========================================================
   js/pages/treino.js — resultado do treino classificatório
   (Q1/Q2/Q3) de uma etapa.
   ========================================================= */

import { API, fetchCached, TTL_LIVE } from "../api.js";
import { teamMeta, flagFor } from "../teams.js";
import { renderSubpageHeader, setPageTitle, pageParams } from "../layout.js";
import { t, applyStaticTranslations } from "../i18n.js";

const { season: SEASON, round: ROUND } = pageParams();

renderSubpageHeader(document.getElementById("topbar"), {
  backHref: SEASON ? `calendario.html?season=${SEASON}` : "calendario.html",
  backKey: "nav_calendar",
  onLangChange: load,
});
applyStaticTranslations();

async function load(){
  const content = document.getElementById("quali-content");
  if (!SEASON || !ROUND){
    setPageTitle(t("qualifying_eyebrow"));
    document.getElementById("race-title").textContent = t("no_race_selected");
    content.innerHTML = `<div class="state-msg error">${t("select_race_prompt")}</div>`;
    return;
  }
  try{
    const data = await fetchCached(`${API}/${SEASON}/${ROUND}/qualifying.json?limit=40`, TTL_LIVE);
    const race = data.MRData.RaceTable.Races[0];
    if (!race){
      // a Jolpica não devolve nem a corrida quando não há dado de treino
      // pra ela (comum em temporadas bem antigas) — não é um erro real
      setPageTitle(t("qualifying_eyebrow"));
      document.getElementById("race-title").textContent = t("round_season_label", { round: ROUND, season: SEASON });
      content.innerHTML = `<div class="state-msg">${t("no_qualifying_data")}</div>`;
      return;
    }

    document.title = t("page_title_qualifying", { name: race.raceName });
    setPageTitle(t("page_title_qualifying", { name: race.raceName }));
    document.getElementById("race-title").textContent = race.raceName;
    document.getElementById("hero-sub").textContent = t("race_meta_line", {
      circuit: race.Circuit.circuitName,
      locality: race.Circuit.Location.locality,
      country: race.Circuit.Location.country,
      round: race.round,
      season: SEASON,
    });

    const quali = race.QualifyingResults || [];
    if (!quali.length){
      content.innerHTML = `<div class="state-msg">${t("no_qualifying_data")}</div>`;
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
            <tr><th>${t("standings_th_pos")}</th><th>${t("standings_th_driver")}</th><th>${t("standings_th_team")}</th><th class="num">Q1</th><th class="num">Q2</th><th class="num">Q3</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (err){
    content.innerHTML = `<div class="state-msg error">${t("error_load_qualifying", { err: err.message })}</div>`;
    console.error(err);
  }
}
load();
