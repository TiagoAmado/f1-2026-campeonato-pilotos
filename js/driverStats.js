/* =========================================================
   js/driverStats.js — estatísticas de um piloto numa temporada
   (resultado por rodada, pontos, vitórias, pódios, poles). Extraído
   de piloto.js pra ser reaproveitado pelo comparador cabeça a cabeça,
   que precisa buscar os mesmos dados pra dois pilotos.
   ========================================================= */

import { API, fetchCached } from "./api.js";
import { teamMeta } from "./teams.js";

/* retorna null se o piloto não correu nessa temporada */
export async function fetchDriverSeasonStats(driverId, season, ttl){
  const [resultsData, qualiData, sprintData] = await Promise.all([
    fetchCached(`${API}/${season}/drivers/${driverId}/results.json?limit=40`, ttl),
    fetchCached(`${API}/${season}/drivers/${driverId}/qualifying.json?limit=40`, ttl),
    fetchCached(`${API}/${season}/drivers/${driverId}/sprint.json?limit=40`, ttl),
  ]);

  const races = resultsData.MRData.RaceTable.Races;
  if (!races.length) return null;

  const driver = races[0].Results[0].Driver;
  const lastResult = races[races.length - 1].Results[0];
  const team = teamMeta(lastResult.Constructor.constructorId, lastResult.Constructor.name);

  // pontos de corrida + pontos de sprint (a Jolpica devolve os dois
  // separados; a pontuação total do piloto soma ambos)
  const sprintPtsByRound = new Map(
    sprintData.MRData.RaceTable.Races.map(r => [Number(r.round), Number(r.SprintResults[0].points)])
  );

  let cum = 0;
  const byRound = new Map();
  const ptsEvolution = races.map(r => {
    const round = Number(r.round);
    const res = r.Results[0];
    const roundPts = Number(res.points) + (sprintPtsByRound.get(round) || 0);
    cum += roundPts;
    byRound.set(round, {
      raceName: r.raceName,
      grid: res.grid,
      position: res.position,
      positionText: res.positionText,
      points: roundPts,
    });
    return cum;
  });

  const wins = races.filter(r => r.Results[0].positionText === "1").length;
  const podiums = races.filter(r => {
    const pos = Number(r.Results[0].position);
    return !isNaN(pos) && pos <= 3;
  }).length;

  const qualiRaces = qualiData.MRData.RaceTable.Races;
  const poles = qualiRaces.filter(r => r.QualifyingResults[0].position === "1").length;

  return { driverId, driver, team, races, ptsEvolution, totalPts: cum, wins, podiums, poles, byRound };
}
