/* =========================================================
   F1 · Campeonato de Pilotos — script.js (home)

   Como este arquivo funciona, resumido:
   1. loadData()       busca os dados AO VIVO na API da Jolpica F1
                        (pontuação, corridas, vencedores, equipes),
                        com cache em localStorage (js/api.js).
   2. as funções renderX() pegam esses dados e escrevem o HTML/SVG
      de cada parte da página (pódio, gráfico, tabela, etc).
   3. init() (lá no final do arquivo) chama loadData() e depois
      todas as renderX(), na ordem certa, quando a página abre.

   Nenhum resultado de corrida fica fixo aqui no código — tudo é
   buscado de novo (ou vem do cache local), toda vez que a página é
   aberta. Lógica compartilhada com futuras páginas mora em js/.
   ========================================================= */

import { API, fetchCached, loadPool, TTL_LIVE, TTL_HISTORIC } from "./js/api.js";
import { teamMeta, flagFor, codeFor } from "./js/teams.js";
import { fmtDate, fmtDateLong } from "./js/format.js";
import { createLineChart } from "./js/chart.js";

let SEASON = 2026; // trocado pela caixa de seleção de temporada, lá embaixo
let LATEST_SEASON = null; // temporada mais recente disponível na API (define o TTL do cache)

/* =========================================================
   ESTADO
   (variáveis que guardam os dados já carregados, pra todas as
   funções de renderização poderem usar)
   ========================================================= */
let TEAMS = {};
let RACES = [];
let RACE_FULL = [];
let DRIVERS = [];
let WINNERS = [];
let CONSTRUCTORS = [];
let leaderPts = 0;
let visible = new Set();
const SECOND_DRIVER = new Set();
let chart = null;

/* =========================================================
   CARREGAMENTO DOS DADOS (Jolpica F1 API)
   ========================================================= */
async function loadData(){
  // temporada em andamento cacheia por pouco tempo (dados mudam a cada
  // corrida); temporada encerrada cacheia por muito tempo (não muda mais)
  const isLive = LATEST_SEASON == null || SEASON === LATEST_SEASON;
  const ttl = isLive ? TTL_LIVE : TTL_HISTORIC;

  const [winnersData, constructorsData, fullCalendar] = await Promise.all([
    fetchCached(`${API}/${SEASON}/results/1.json?limit=40`, ttl),
    fetchCached(`${API}/${SEASON}/constructorStandings.json`, ttl),
    fetchCached(`${API}/${SEASON}.json?limit=40`, ttl),
  ]);

  const races = winnersData.MRData.RaceTable.Races;
  if (races.length === 0) throw new Error(`Nenhuma corrida concluída encontrada para ${SEASON}.`);

  const totalRounds = fullCalendar.MRData.RaceTable.Races.length;
  const totalCompleted = races.length;

  RACES = races.map(r => codeFor(r.Circuit.circuitId, r.Circuit.Location.locality));
  RACE_FULL = races.map(r => `${r.Circuit.Location.locality} (${fmtDate(r.date)})`);
  WINNERS = races.map(r => ({
    id: r.Results[0].Driver.driverId,
    team: r.Results[0].Constructor.constructorId,
  }));

  const standingsByRound = await loadPool(races.map(r => r.round), async (round) => {
    const data = await fetchCached(`${API}/${SEASON}/${round}/driverStandings.json`, ttl);
    return data.MRData.StandingsTable.StandingsLists[0].DriverStandings;
  });

  const consStandings = constructorsData.MRData.StandingsTable.StandingsLists[0].ConstructorStandings;
  CONSTRUCTORS = consStandings.map(c => ({ team: c.Constructor.constructorId, pts: Number(c.points) }));

  TEAMS = {};
  consStandings.forEach(c => {
    TEAMS[c.Constructor.constructorId] = teamMeta(c.Constructor.constructorId, c.Constructor.name);
  });

  const pointsIndex = standingsByRound.map(list => {
    const m = new Map();
    list.forEach(e => m.set(e.Driver.driverId, Number(e.points)));
    return m;
  });

  const finalStandings = standingsByRound[standingsByRound.length - 1];

  DRIVERS = finalStandings.map(entry => {
    const d = entry.Driver;
    const teamId = entry.Constructors[0].constructorId;
    if (!TEAMS[teamId]) TEAMS[teamId] = teamMeta(teamId, entry.Constructors[0].name);

    let last = 0;
    const pts = pointsIndex.map(m => {
      if (m.has(d.driverId)) last = m.get(d.driverId);
      return last;
    });

    return {
      id: d.driverId,
      name: `${d.givenName} ${d.familyName}`,
      num: Number(d.permanentNumber) || 0,
      team: teamId,
      flag: flagFor(d.nationality),
      wins: Number(entry.wins),
      pts,
    };
  });

  leaderPts = DRIVERS[0].pts[DRIVERS[0].pts.length - 1];

  const seenTeams = new Set();
  DRIVERS.forEach(d => {
    if (seenTeams.has(d.team)) SECOND_DRIVER.add(d.id);
    seenTeams.add(d.team);
  });

  visible = new Set(DRIVERS.slice(0, 5).map(d => d.id));

  const lastRace = races[races.length - 1];
  const winnerDriver = DRIVERS.find(d => d.id === WINNERS[WINNERS.length - 1].id);

  document.title = `F1 ${SEASON} · Campeonato de Pilotos`;
  document.getElementById("eyebrow-season").textContent =
    `Fórmula 1 · Campeonato Mundial de Pilotos ${SEASON}`;

  document.getElementById("live-dot").classList.remove("err");
  document.getElementById("tb-round").textContent = `RODADA ${totalCompleted}/${totalRounds} CONCLUÍDA`;
  document.getElementById("tb-race").textContent = lastRace.raceName;
  document.getElementById("tb-winner").innerHTML = winnerDriver
    ? `Vencedor: ${winnerDriver.flag} ${winnerDriver.name}`
    : "";

  document.getElementById("hero-sub").textContent =
    `Pontuação de todos os ${DRIVERS.length} pilotos após as ${totalCompleted} rodadas já disputadas em ${SEASON} — dados ao vivo da Jolpica F1 API, com gráfico dinâmico para comparar quem você quiser.`;

  document.getElementById("standings-sub").textContent =
    `Após a rodada ${totalCompleted} de ${totalRounds} — ${lastRace.raceName}, ${fmtDateLong(lastRace.date)}.`;

  document.getElementById("calendar-sub").textContent =
    `As ${totalCompleted} corridas já disputadas em ${SEASON}.`;

  document.getElementById("footer-meta").textContent =
    `Dados oficiais da FIA via Jolpica F1 API · ${DRIVERS.length} pilotos · ${Object.keys(TEAMS).length} equipes · ${totalCompleted}/${totalRounds} corridas`;

  const now = new Date();
  document.getElementById("footer-time").textContent =
    `Atualizado ao vivo em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}`;
}

/* =========================================================
   RENDER: PÓDIO (os 3 primeiros colocados, no topo da página)
   ========================================================= */
function renderPodium(){
  const el = document.getElementById("podium");
  el.innerHTML = DRIVERS.slice(0,3).map((d,i)=>{
    const team = TEAMS[d.team];
    const last = d.pts[d.pts.length-1];
    const gap = i===0 ? "Líder do campeonato" : `${leaderPts - last} pts atrás do líder`;
    return `
      <div class="p-card" style="--team-color:${team.color}">
        <div class="rank"><span>P${i+1}</span><span class="badge">${d.wins} vitória${d.wins===1?"":"s"}</span></div>
        <p class="name">${d.flag} ${d.name}</p>
        <p class="team">${team.name} · #${d.num}</p>
        <p class="pts">${last}<span>pts</span></p>
        <p class="gap">${gap}</p>
      </div>`;
  }).join("");
}

/* =========================================================
   RENDER: CHIPS DE SELEÇÃO (agrupados por equipe)
   Cada botão pequeno abaixo do gráfico, um por piloto.
   ========================================================= */
function renderChips(){
  const groups = {};
  DRIVERS.forEach(d=>{
    (groups[d.team] = groups[d.team] || []).push(d);
  });

  const el = document.getElementById("chip-groups");
  el.innerHTML = Object.keys(groups).map(teamKey=>{
    const team = TEAMS[teamKey];
    const chips = groups[teamKey].map(d=>{
      const last = d.pts[d.pts.length-1];
      return `<button class="chip" data-id="${d.id}" style="--c:${team.color}">
        <span class="dot"></span>${d.flag} ${d.name.split(" ").slice(-1)[0]}
        <span class="pts">${last}</span>
      </button>`;
    }).join("");
    return `
      <div class="chip-group">
        <span class="team-label" data-team="${teamKey}"><span class="sw" style="background:${team.color}"></span>${team.name}</span>
        <div class="chip-row">${chips}</div>
      </div>`;
  }).join("");

  syncChipStates();

  el.querySelectorAll(".chip").forEach(chip=>{
    chip.addEventListener("click", ()=>{
      const id = chip.dataset.id;
      if (visible.has(id)) visible.delete(id); else visible.add(id);
      syncChipStates();
      updateChart();
    });
  });
  el.querySelectorAll(".team-label").forEach(label=>{
    label.addEventListener("click", ()=>{
      const teamKey = label.dataset.team;
      const teamDrivers = DRIVERS.filter(d=>d.team===teamKey).map(d=>d.id);
      const allOn = teamDrivers.every(id=>visible.has(id));
      teamDrivers.forEach(id=> allOn ? visible.delete(id) : visible.add(id));
      syncChipStates();
      updateChart();
    });
  });
}

/* deixa cada chip "aceso" ou "apagado" de acordo com quem está selecionado */
function syncChipStates(){
  document.querySelectorAll(".chip").forEach(chip=>{
    chip.classList.toggle("on", visible.has(chip.dataset.id));
  });
}

/* =========================================================
   GRÁFICO (evolução de pontos por corrida) — motor em js/chart.js
   ========================================================= */

/* monta a série do gráfico a partir dos pilotos carregados; chamado
   uma vez por temporada, logo depois de loadData() */
function buildChart(){
  chart = createLineChart({
    svg: document.getElementById("chart"),
    tooltip: document.getElementById("tooltip"),
    xLabels: RACES,
    xLabelsFull: RACE_FULL,
    valueLabel: "pts acumulados",
  });
  chart.setSeries(DRIVERS.map(d => ({
    id: d.id,
    color: TEAMS[d.team].color,
    dashed: SECOND_DRIVER.has(d.id),
    label: `${d.flag} ${d.name}`,
    pts: d.pts,
  })));
  updateChart();
}

/* redesenha o gráfico com quem estiver marcado como visível no momento */
function updateChart(){
  chart.setVisible(visible);
  chart.render();
}

/* =========================================================
   RENDER: TABELA DE CLASSIFICAÇÃO
   ========================================================= */
function renderStandings(){
  const body = document.getElementById("standings-body");
  body.innerHTML = DRIVERS.map((d,i)=>{
    const team = TEAMS[d.team];
    const last = d.pts[d.pts.length-1];
    const gap = i===0 ? "—" : "-" + (leaderPts - last);
    return `
      <tr style="--c:${team.color}">
        <td class="mono">${i+1}</td>
        <td>
          <div class="drow">
            <span class="num-badge" style="--c:${team.color}">${d.num}</span>
            <div>
              <div class="dname">${d.flag} ${d.name}</div>
            </div>
          </div>
        </td>
        <td class="dteam">${team.name}</td>
        <td class="num mono">${last}</td>
        <td class="num">${d.wins ? `<span class="wins-badge">${d.wins}</span>` : `<span class="dteam">0</span>`}</td>
        <td class="num mono dteam">${gap}</td>
      </tr>`;
  }).join("");
}

/* =========================================================
   RENDER: TIRA DE VENCEDORES (um cartão por corrida já disputada)
   ========================================================= */
function renderRaceStrip(){
  const el = document.getElementById("race-strip");
  el.innerHTML = WINNERS.map((w,i)=>{
    const d = DRIVERS.find(x=>x.id===w.id);
    const team = TEAMS[w.team];
    return `
      <div class="race-card" style="--c:${team.color}">
        <div class="rnum">RODADA ${i+1}</div>
        <div class="rname">${RACE_FULL[i]}</div>
        <div class="rwinner">${d ? d.flag + " " + d.name : w.id}</div>
        <div class="rteam">${team.name}</div>
      </div>`;
  }).join("");
}

/* =========================================================
   RENDER: CAMPEONATO DE CONSTRUTORES
   ========================================================= */
function renderConstructors(){
  const el = document.getElementById("cons-grid");
  el.innerHTML = CONSTRUCTORS.map((c,i)=>{
    const team = TEAMS[c.team];
    return `
      <div class="cons-row" style="--c:${team.color}">
        <span class="pos mono">${i+1}</span>
        <span class="sw"></span>
        <span class="cname">${team.name}</span>
        <span class="cpts mono">${c.pts} pts</span>
      </div>`;
  }).join("");
}

/* =========================================================
   BOTÕES "Top 5 / Top 10 / Todos / Limpar"
   ========================================================= */
document.getElementById("btn-top5").addEventListener("click", ()=>{
  visible = new Set(DRIVERS.slice(0,5).map(d=>d.id));
  syncChipStates(); updateChart();
});
document.getElementById("btn-top10").addEventListener("click", ()=>{
  visible = new Set(DRIVERS.slice(0,10).map(d=>d.id));
  syncChipStates(); updateChart();
});
document.getElementById("btn-all").addEventListener("click", ()=>{
  visible = new Set(DRIVERS.map(d=>d.id));
  syncChipStates(); updateChart();
});
document.getElementById("btn-none").addEventListener("click", ()=>{
  visible = new Set();
  syncChipStates(); updateChart();
});

/* =========================================================
   CAIXA DE SELEÇÃO DE TEMPORADA
   ========================================================= */

/* busca todas as temporadas que a API tem disponível e monta as
   opções da caixa de seleção (a mais recente primeiro) */
async function loadSeasonOptions(){
  const select = document.getElementById("season-select");
  try{
    const data = await fetchCached(`${API}/seasons.json?limit=100`, TTL_HISTORIC);
    const seasons = data.MRData.SeasonTable.Seasons.map(s => Number(s.season)).sort((a,b) => b-a);
    LATEST_SEASON = seasons[0];
    select.innerHTML = seasons.map(y => `<option value="${y}">${y}</option>`).join("");
  } catch (err){
    // se a lista de temporadas falhar, ao menos deixa a atual escolhível
    select.innerHTML = `<option value="${SEASON}">${SEASON}</option>`;
  }
  select.value = SEASON;
}

/* limpa tudo que foi montado pra temporada anterior antes de buscar
   os dados da temporada nova escolhida na caixa de seleção */
function resetForNewSeason(){
  chart = null;
  SECOND_DRIVER.clear();
  visible = new Set();

  document.getElementById("podium").innerHTML = '<div class="state-msg">Carregando pódio…</div>';
  document.getElementById("chip-groups").innerHTML = "";
  document.getElementById("chart").innerHTML = "";
  document.getElementById("standings-body").innerHTML = "";
  document.getElementById("race-strip").innerHTML = "";
  document.getElementById("cons-grid").innerHTML = "";
}

document.getElementById("season-select").addEventListener("change", (e)=>{
  SEASON = Number(e.target.value);
  resetForNewSeason();
  init();
});

/* =========================================================
   INICIALIZAÇÃO — roda assim que a página abre (e de novo toda
   vez que a temporada é trocada na caixa de seleção)
   ========================================================= */
async function init(){
  try{
    await loadData();
    renderPodium();
    renderChips();
    buildChart();
    renderStandings();
    renderRaceStrip();
    renderConstructors();
  } catch (err){
    document.getElementById("live-dot").classList.add("err");
    document.getElementById("tb-round").textContent = "erro ao carregar dados ao vivo";
    document.getElementById("podium").innerHTML =
      `<div class="state-msg error">Não foi possível carregar os dados ao vivo agora (${err.message}). Tente recarregar a página em alguns instantes.</div>`;
    console.error(err);
  }
}
loadSeasonOptions();
init();
