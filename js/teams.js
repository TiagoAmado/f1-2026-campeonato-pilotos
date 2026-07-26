/* =========================================================
   js/teams.js — cor/nome de cada equipe, bandeiras e siglas de
   circuito. Reaproveitado por qualquer página que precise mostrar
   as mesmas cores por equipe (home, perfil de piloto, de equipe...).
   ========================================================= */

/* cor e nome de exibição de cada equipe */
export const TEAM_META = {
  mercedes:     { name:"Mercedes",     color:"#00D7B6" },
  ferrari:      { name:"Ferrari",      color:"#FF2D4D" },
  mclaren:      { name:"McLaren",      color:"#FF8000" },
  red_bull:     { name:"Red Bull",     color:"#4C86E0" },
  alpine:       { name:"Alpine",       color:"#FF87BC" },
  aston_martin: { name:"Aston Martin", color:"#2ECC91" },
  williams:     { name:"Williams",     color:"#64C4FF" },
  rb:           { name:"Racing Bulls", color:"#8C7CFF" },
  haas:         { name:"Haas",         color:"#D9A6AE" },
  audi:         { name:"Audi",         color:"#B58A57" },
  cadillac:     { name:"Cadillac",     color:"#8A8F98" },
};

/* nacionalidade (como a API descreve) -> código de país (usado pra
   mostrar a bandeira, via a biblioteca "flag-icons" carregada no HTML) */
export const NATIONALITY_CODE = {
  Italian:"it", British:"gb", Monegasque:"mc", Australian:"au", Dutch:"nl",
  French:"fr", German:"de", Spanish:"es", Brazilian:"br", Thai:"th",
  Finnish:"fi", Mexican:"mx", Canadian:"ca", "New Zealander":"nz", Argentine:"ar",
  American:"us", Japanese:"jp", Danish:"dk", Chinese:"cn", Indian:"in",
  Polish:"pl", Swedish:"se", Belgian:"be", Austrian:"at", Swiss:"ch",
  Russian:"ru", Indonesian:"id", Colombian:"co", Portuguese:"pt", Irish:"ie",
};

/* id do circuito (como a API identifica) -> sigla curta pro eixo X do gráfico */
export const CIRCUIT_CODE = {
  albert_park:"AUS", shanghai:"CHN", suzuka:"JPN", bahrain:"BHR", jeddah:"SAU",
  miami:"MIA", imola:"EMI", monaco:"MON", catalunya:"ESP", villeneuve:"CAN",
  red_bull_ring:"AUT", silverstone:"GBR", spa:"BEL", hungaroring:"HUN",
  zandvoort:"NED", monza:"ITA", baku:"AZE", marina_bay:"SIN", americas:"USA",
  rodriguez:"MEX", interlagos:"BRA", las_vegas:"LVG", losail:"QAT", yas_marina:"ABU",
};

export function flagFor(nat){
  const code = NATIONALITY_CODE[nat] || "xx";
  return `<span class="fi fi-${code}" title="${nat}"></span>`;
}

export function codeFor(circuitId, locality){
  return CIRCUIT_CODE[circuitId] || (locality || "???").slice(0,3).toUpperCase();
}

export function teamMeta(id, fallbackName){
  if (TEAM_META[id]) return TEAM_META[id];
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return { name: fallbackName, color: `hsl(${hash % 360} 70% 55%)` };
}
