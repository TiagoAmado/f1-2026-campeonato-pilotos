/* =========================================================
   js/resultsTable.js — tabela de resultado (grid → chegada, status,
   pontos), compartilhada entre corrida.html e sprint.html, já que a
   Jolpica devolve os dois no mesmo formato (Results/SprintResults).
   ========================================================= */

import { teamMeta, flagFor } from "./teams.js";
import { t } from "./i18n.js";

const STATUS_KEYS = {
  "Finished": "status_finished",
  "Retired": "status_retired",
  "Accident": "status_accident",
  "Collision": "status_collision",
  "Engine": "status_engine",
  "Gearbox": "status_gearbox",
  "Disqualified": "status_disqualified",
  "Withdrew": "status_withdrew",
  "Did not qualify": "status_dnq",
  "Did not start": "status_dns",
  "Spun off": "status_spun_off",
  "Lapped": "status_lapped",
};

/* traduz o status bruto da API ("Accident", "+1 Lap" etc.) pro
   idioma atual; usado aqui e na estatística de confiabilidade */
export function statusText(status){
  const key = STATUS_KEYS[status];
  return key ? t(key) : status;
}

export function renderResultsTable(container, results){
  if (!results.length){
    container.innerHTML = `<div class="state-msg">${t("no_results_data")}</div>`;
    return;
  }

  const fastestLapHolder = results.find(r => r.FastestLap && r.FastestLap.rank === "1");

  const rows = results.map(r => {
    const team = teamMeta(r.Constructor.constructorId, r.Constructor.name);
    const result = r.Time ? r.Time.time : statusText(r.status);
    return `
      <tr style="--c:${team.color}">
        <td class="mono">${r.positionText}</td>
        <td>
          <div class="drow">
            <span class="num-badge" style="--c:${team.color}">${r.number}</span>
            <div class="dname">${flagFor(r.Driver.nationality)} ${r.Driver.givenName} ${r.Driver.familyName}</div>
          </div>
        </td>
        <td class="dteam">${team.name}</td>
        <td class="num mono">${r.grid}</td>
        <td class="mono">${result}</td>
        <td class="num mono">${r.points}</td>
      </tr>`;
  }).join("");

  container.innerHTML = `
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>${t("standings_th_pos")}</th><th>${t("standings_th_driver")}</th><th>${t("standings_th_team")}</th>
            <th class="num">Grid</th><th>${t("results_th_result")}</th><th class="num">${t("standings_th_points")}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${fastestLapHolder ? `
      <div class="fastest-lap-callout">
        <span class="fl-label">${t("fastest_lap_label")}</span>
        <span class="fl-name">${flagFor(fastestLapHolder.Driver.nationality)} ${fastestLapHolder.Driver.givenName} ${fastestLapHolder.Driver.familyName}</span>
        <span class="fl-time mono">${fastestLapHolder.FastestLap.Time.time}</span>
      </div>` : ""}`;
}
