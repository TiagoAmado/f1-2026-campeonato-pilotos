/* =========================================================
   js/resultsTable.js — tabela de resultado (grid → chegada, status,
   pontos), compartilhada entre corrida.html e sprint.html, já que a
   Jolpica devolve os dois no mesmo formato (Results/SprintResults).
   ========================================================= */

import { teamMeta, flagFor } from "./teams.js";

const STATUS_PT = {
  "Finished": "Terminou",
  "Retired": "Abandonou",
  "Accident": "Acidente",
  "Collision": "Colisão",
  "Engine": "Motor",
  "Gearbox": "Câmbio",
  "Disqualified": "Desclassificado",
  "Withdrew": "Retirou-se",
  "Did not qualify": "Não classificou",
  "Did not start": "Não largou",
  "Spun off": "Rodou e saiu",
  "Lapped": "Voltas de atraso",
};

function statusText(status){
  return STATUS_PT[status] || status;
}

export function renderResultsTable(container, results){
  if (!results.length){
    container.innerHTML = '<div class="state-msg">Sem dados disponíveis pra esta etapa.</div>';
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
            <th>Pos</th><th>Piloto</th><th>Equipe</th>
            <th class="num">Grid</th><th>Resultado</th><th class="num">Pontos</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${fastestLapHolder ? `
      <div class="fastest-lap-callout">
        <span class="fl-label">Volta mais rápida</span>
        <span class="fl-name">${flagFor(fastestLapHolder.Driver.nationality)} ${fastestLapHolder.Driver.givenName} ${fastestLapHolder.Driver.familyName}</span>
        <span class="fl-time mono">${fastestLapHolder.FastestLap.Time.time}</span>
      </div>` : ""}`;
}
