/* =========================================================
   js/pages/confiabilidade.js — abandonos por equipe na temporada:
   quantas vezes cada equipe não completou a corrida, taxa de
   conclusão e os motivos mais comuns.

   "Abandono" = qualquer status que não seja "terminou" (Finished ou
   "+N Lap(s)", carro que terminou só que voltas atrás — em temporadas
   antigas esse caso não tem o campo Time preenchido, então checar
   "tem Time?" sozinho classificava esses carros como abandono por
   engano) nem administrativo (Desclassificado, Não largou, Retirou-se
   antes da corrida).

   A Jolpica não expõe fabricante de motor separado da equipe (times
   que dividem motor, ex. clientes Mercedes/Ferrari, não aparecem
   distintos na API) — por isso esta página agrupa só por equipe,
   não por motor como o item original do brief sugeria.
   ========================================================= */

import { API, fetchCached, loadPool, fetchSeasons, TTL_LIVE, TTL_HISTORIC } from "../api.js";
import { teamMeta } from "../teams.js";
import { renderSubpageHeader, setPageTitle, pageParams } from "../layout.js";
import { statusText } from "../resultsTable.js";
import { t, applyStaticTranslations } from "../i18n.js";

const NON_RETIREMENT_STATUS = new Set(["Disqualified", "Did not start", "Withdrew"]);
const FINISHED_STATUS = /^(Finished|\+\d+ Laps?)$/;

let SEASON = pageParams().season;
let LATEST_SEASON = null;

renderSubpageHeader(document.getElementById("topbar"), {
  backHref: SEASON ? `calendario.html?season=${SEASON}` : "calendario.html",
  backKey: "nav_calendar",
  extra: `<span class="sep">·</span><b data-i18n="topbar_season">TEMPORADA</b><select id="rel-season-select" class="season-select" aria-label="Selecionar temporada"></select>`,
  onLangChange: load,
});
applyStaticTranslations();

async function loadSeasonOptions(){
  const seasons = await fetchSeasons();
  LATEST_SEASON = seasons[0] || null;
  if (!SEASON) SEASON = LATEST_SEASON || new Date().getFullYear();

  const select = document.getElementById("rel-season-select");
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
  const content = document.getElementById("reliability-content");
  content.innerHTML = `<div class="state-msg">${t("state_loading")}</div>`;
  try{
    const isLive = LATEST_SEASON == null || SEASON === LATEST_SEASON;
    const ttl = isLive ? TTL_LIVE : TTL_HISTORIC;

    const winnersData = await fetchCached(`${API}/${SEASON}/results/1.json?limit=40`, ttl);
    const races = winnersData.MRData.RaceTable.Races;
    if (!races.length) throw new Error(t("error_no_completed_races", { season: SEASON }));

    setPageTitle(t("page_title_reliability", { season: SEASON }));
    document.title = t("doc_title_reliability", { season: SEASON });
    document.getElementById("hero-sub").textContent =
      t("reliability_hero_sub", { count: races.length, season: SEASON });

    const resultsByRound = await loadPool(races.map(r => r.round), async (round) => {
      const data = await fetchCached(`${API}/${SEASON}/${round}/results.json?limit=40`, ttl);
      return data.MRData.RaceTable.Races[0]?.Results || [];
    });

    const teamStats = new Map();
    resultsByRound.flat().forEach(r => {
      const teamId = r.Constructor.constructorId;
      if (!teamStats.has(teamId)){
        teamStats.set(teamId, {
          team: teamMeta(teamId, r.Constructor.name),
          entries: 0,
          retirements: 0,
          reasons: new Map(),
        });
      }
      const stat = teamStats.get(teamId);
      stat.entries++;
      const isRetirement = !FINISHED_STATUS.test(r.status) && !NON_RETIREMENT_STATUS.has(r.status);
      if (isRetirement){
        stat.retirements++;
        stat.reasons.set(r.status, (stat.reasons.get(r.status) || 0) + 1);
      }
    });

    const list = [...teamStats.values()].map(s => ({
      ...s,
      rate: s.entries ? Math.round(((s.entries - s.retirements) / s.entries) * 1000) / 10 : 0,
    })).sort((a, b) => a.retirements - b.retirements || b.rate - a.rate);

    const rows = list.map(s => {
      const reasonsText = [...s.reasons.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([status, count]) => `${statusText(status)} (${count})`)
        .join(", ") || "—";
      return `
        <tr style="--c:${s.team.color}">
          <td class="dteam" style="color:var(--text);font-weight:600;">${s.team.name}</td>
          <td class="num mono">${s.entries}</td>
          <td class="num mono">${s.retirements}</td>
          <td class="num mono">${s.rate}%</td>
          <td class="dteam">${reasonsText}</td>
        </tr>`;
    }).join("");

    content.innerHTML = `
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>${t("standings_th_team")}</th><th class="num">${t("th_entries")}</th><th class="num">${t("th_retirements")}</th>
              <th class="num">${t("th_completion")}</th><th>${t("th_main_reasons")}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (err){
    content.innerHTML = `<div class="state-msg error">${t("error_load_reliability", { err: err.message })}</div>`;
    console.error(err);
  }
}

loadSeasonOptions().then(load);
