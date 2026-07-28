/* =========================================================
   F1 · Campeonato de Pilotos — script.js (home)

   Como este arquivo funciona, resumido:
   1. loadData()       busca os dados AO VIVO na API da Jolpica F1
                        (pontuação, corridas, vencedores, equipes),
                        com cache em localStorage (js/api.js). Só
                        busca e guarda estado bruto — não escreve
                        texto na tela.
   2. renderAll()      pega o estado já carregado e chama todas as
                        funções renderX() (pódio, gráfico, tabela
                        etc). Roda depois de loadData() e de novo
                        toda vez que o idioma muda (sem refazer
                        nenhuma chamada à API).
   3. init() (lá no final do arquivo) chama loadData() e depois
      renderAll(), quando a página abre.

   Nenhum resultado de corrida fica fixo aqui no código — tudo é
   buscado de novo (ou vem do cache local), toda vez que a página é
   aberta. Lógica compartilhada com futuras páginas mora em js/.
   ========================================================= */

import { API, fetchCached, loadPool, fetchSeasons, TTL_LIVE, TTL_HISTORIC } from "./js/api.js";
import { teamMeta, flagFor, codeFor } from "./js/teams.js";
import { fmtDate, fmtDateLong } from "./js/format.js";
import { createLineChart } from "./js/chart.js";
import { generatePodiumCard, downloadCanvas } from "./js/shareCard.js";
import { getLang, t, applyStaticTranslations, renderLangToggle } from "./js/i18n.js";

let SEASON = 2026; // trocado pela caixa de seleção de temporada, lá embaixo
let LATEST_SEASON = null; // temporada mais recente disponível na API (define o TTL do cache)

/* =========================================================
   ESTADO
   (variáveis que guardam os dados já carregados, pra todas as
   funções de renderização poderem usar — inclusive de novo, na
   mesma temporada, quando o idioma muda)
   ========================================================= */
let TEAMS = {};
let RACES_RAW = [];    // corridas já concluídas, como a API devolve
let RACES = [];        // siglas curtas do eixo X (não dependem de idioma)
let DRIVERS = [];
let WINNERS = [];
let CONSTRUCTORS = [];
let FULL_CALENDAR = null;
let TOTAL_ROUNDS = 0;
let TOTAL_COMPLETED = 0;
let leaderPts = 0;
let visible = new Set();
const SECOND_DRIVER = new Set();
let chart = null;
let gapRef = null; // id do piloto usado como referência da coluna "Diferença" — null = líder

/* descrição completa de cada corrida pro eixo X do gráfico e pra tira
   de vencedores — recalculada a cada render porque o formato de data
   muda com o idioma */
function raceFullLabels(){
  const lang = getLang();
  return RACES_RAW.map(r => `${r.Circuit.Location.locality} (${fmtDate(r.date, lang)})`);
}

/* calcula em quantas rodadas restantes o título fica matematicamente
   decidido, comparando o líder com o 2º colocado (simplificação comum
   pra esse tipo de cálculo: não considera outros rivais mais distantes,
   que teoricamente já estariam fora mesmo antes do líder x vice). */
function computeTitleMath(fullCalendar, totalCompleted, leader, second){
  const remaining = fullCalendar.MRData.RaceTable.Races.slice(totalCompleted);
  const gap = leader.pts[leader.pts.length - 1] - second.pts[second.pts.length - 1];

  if (remaining.length === 0){
    return { seasonOver: true, gap };
  }

  const POINTS_RACE_MAX = 26; // 25 (vitória) + 1 (volta mais rápida)
  const POINTS_SPRINT_MAX = 8; // vitória na sprint
  const maxRemainingTotal = remaining.reduce(
    (sum, r) => sum + POINTS_RACE_MAX + (r.Sprint ? POINTS_SPRINT_MAX : 0), 0
  );

  if (gap > maxRemainingTotal){
    return { seasonOver: false, decidedNow: true, gap };
  }

  let cumulative = 0;
  for (let i = 0; i < remaining.length; i++){
    cumulative += POINTS_RACE_MAX + (remaining[i].Sprint ? POINTS_SPRINT_MAX : 0);
    if (gap > maxRemainingTotal - cumulative){
      return { seasonOver: false, decidedNow: false, roundsToDecide: i + 1, gap };
    }
  }
  return { seasonOver: false, decidedNow: false, roundsToDecide: null, gap, maxRemainingTotal };
}

function renderTitleMath(math, leader){
  const el = document.getElementById("title-math");
  if (!el) return;
  let text;
  if (math.seasonOver){
    text = math.gap > 0
      ? t("title_math_season_over_champion", { name: leader.name })
      : t("title_math_season_over");
  } else if (math.decidedNow){
    text = t("title_math_decided", { name: leader.name });
  } else if (math.roundsToDecide){
    text = math.roundsToDecide === 1
      ? t("title_math_rounds_one", { n: math.roundsToDecide, name: leader.name })
      : t("title_math_rounds_many", { n: math.roundsToDecide, name: leader.name });
  } else {
    text = t("title_math_open", { max: math.maxRemainingTotal });
  }
  el.textContent = text;
}

/* =========================================================
   CARREGAMENTO DOS DADOS (Jolpica F1 API)
   — só busca e guarda estado bruto, não escreve texto na tela
   (isso é papel de renderHeaderTexts/renderAll, chamadas depois)
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
  if (races.length === 0) throw new Error(t("state_error_no_races", { season: SEASON }));

  FULL_CALENDAR = fullCalendar;
  TOTAL_ROUNDS = fullCalendar.MRData.RaceTable.Races.length;
  TOTAL_COMPLETED = races.length;
  RACES_RAW = races;

  RACES = races.map(r => codeFor(r.Circuit.circuitId, r.Circuit.Location.locality));
  WINNERS = races.map(r => ({
    id: r.Results[0].Driver.driverId,
    team: r.Results[0].Constructor.constructorId,
    round: Number(r.round),
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
}

/* =========================================================
   RENDER: textos derivados do estado (título da página, topbar,
   sub-títulos de seção, calculadora de título, rodapé) — tudo isso
   depende do idioma atual, então roda de novo a cada troca de idioma
   ========================================================= */
function renderHeaderTexts(){
  const lang = getLang();
  const lastRace = RACES_RAW[RACES_RAW.length - 1];
  const winnerDriver = DRIVERS.find(d => d.id === WINNERS[WINNERS.length - 1].id);

  document.title = t("page_title_home", { season: SEASON });
  document.getElementById("eyebrow-season").textContent = t("hero_eyebrow", { season: SEASON });

  document.getElementById("live-dot").classList.remove("err");
  document.getElementById("tb-round").textContent = t("topbar_round", { completed: TOTAL_COMPLETED, total: TOTAL_ROUNDS });
  document.getElementById("tb-race").textContent = lastRace.raceName;
  document.getElementById("tb-winner").innerHTML = winnerDriver
    ? t("topbar_winner", { flag: winnerDriver.flag, name: winnerDriver.name })
    : "";

  document.getElementById("hero-sub").textContent = t("hero_sub", {
    count: DRIVERS.length, completed: TOTAL_COMPLETED, season: SEASON,
  });

  document.getElementById("standings-sub").textContent = t("standings_sub", {
    completed: TOTAL_COMPLETED, total: TOTAL_ROUNDS, race: lastRace.raceName, date: fmtDateLong(lastRace.date, lang),
  });

  document.getElementById("calendar-sub").textContent = t("winners_sub", {
    completed: TOTAL_COMPLETED, season: SEASON,
  });

  document.getElementById("footer-meta").textContent = t("footer_meta", {
    drivers: DRIVERS.length, teams: Object.keys(TEAMS).length, completed: TOTAL_COMPLETED, total: TOTAL_ROUNDS,
  });

  const now = new Date();
  const locale = lang === "en" ? "en-US" : "pt-BR";
  document.getElementById("footer-time").textContent = t("footer_updated", {
    date: now.toLocaleDateString(locale),
    time: now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
  });

  if (DRIVERS.length > 1){
    renderTitleMath(computeTitleMath(FULL_CALENDAR, TOTAL_COMPLETED, DRIVERS[0], DRIVERS[1]), DRIVERS[0]);
  }
}

/* =========================================================
   RENDER: PÓDIO (os 3 primeiros colocados, no topo da página)
   ========================================================= */
function renderPodium(){
  const el = document.getElementById("podium");
  el.innerHTML = DRIVERS.slice(0,3).map((d,i)=>{
    const team = TEAMS[d.team];
    const last = d.pts[d.pts.length-1];
    const gap = i===0 ? t("podium_leader") : t("podium_gap", { gap: leaderPts - last });
    const winsLabel = d.wins === 1 ? t("podium_win") : t("podium_wins");
    return `
      <div class="p-card" style="--team-color:${team.color}">
        <div class="rank"><span>P${i+1}</span><span class="badge">${d.wins} ${winsLabel}</span></div>
        <p class="name"><a href="piloto.html?id=${d.id}&season=${SEASON}">${d.flag} ${d.name}</a></p>
        <p class="team"><a href="equipe.html?id=${d.team}&season=${SEASON}">${team.name}</a> · #${d.num}</p>
        <p class="pts">${last}<span>${t("podium_pts")}</span></p>
        <p class="gap">${gap}</p>
      </div>`;
  }).join("");

  document.getElementById("btn-share-card").hidden = false;
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
   sempre que os dados ou o idioma mudam (o esqueleto do SVG é
   reconstruído do zero, mas a seleção em "visible" é preservada) */
function buildChart(){
  chart = createLineChart({
    svg: document.getElementById("chart"),
    tooltip: document.getElementById("tooltip"),
    xLabels: RACES,
    xLabelsFull: raceFullLabels(),
    valueLabel: t("chart_pts_label"),
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
  const refDriver = (gapRef && DRIVERS.find(d => d.id === gapRef)) || DRIVERS[0];
  const refPts = refDriver.pts[refDriver.pts.length - 1];

  body.innerHTML = DRIVERS.map((d,i)=>{
    const team = TEAMS[d.team];
    const last = d.pts[d.pts.length-1];
    const gapVal = last - refPts;
    const gap = gapVal === 0 ? "—" : (gapVal > 0 ? `+${gapVal}` : `${gapVal}`);
    const isRef = d.id === refDriver.id;
    return `
      <tr style="--c:${team.color}" class="std-row${isRef ? " gap-ref" : ""}" data-id="${d.id}">
        <td class="mono">${i+1}</td>
        <td>
          <div class="drow">
            <span class="num-badge" style="--c:${team.color}">${d.num}</span>
            <div>
              <div class="dname"><a href="piloto.html?id=${d.id}&season=${SEASON}">${d.flag} ${d.name}</a></div>
            </div>
          </div>
        </td>
        <td class="dteam"><a href="equipe.html?id=${d.team}&season=${SEASON}">${team.name}</a></td>
        <td class="num mono">${last}</td>
        <td class="num">${d.wins ? `<span class="wins-badge">${d.wins}</span>` : `<span class="dteam">0</span>`}</td>
        <td class="num mono ${isRef ? "" : "dteam"} gap-cell">${gap}</td>
      </tr>`;
  }).join("");

  const hint = document.getElementById("standings-hint");
  if (hint) hint.textContent = gapRef ? t("standings_gap_ref", { name: refDriver.name }) : t("standings_gap_hint");

  body.querySelectorAll(".std-row").forEach(row => {
    row.addEventListener("click", (e) => {
      // não intercepta clique nos links de piloto/equipe dentro da linha
      if (e.target.closest("a")) return;
      const id = row.dataset.id;
      gapRef = gapRef === id ? null : id;
      renderStandings();
    });
  });
}

/* =========================================================
   RENDER: TIRA DE VENCEDORES (um cartão por corrida já disputada)
   ========================================================= */
function renderRaceStrip(){
  const raceFull = raceFullLabels();
  const el = document.getElementById("race-strip");
  el.innerHTML = WINNERS.map((w,i)=>{
    const d = DRIVERS.find(x=>x.id===w.id);
    const team = TEAMS[w.team];
    return `
      <a class="race-card" href="corrida.html?season=${SEASON}&round=${w.round}" style="--c:${team.color}">
        <div class="rnum">${t("winners_round", { n: i + 1 })}</div>
        <div class="rname">${raceFull[i]}</div>
        <div class="rwinner">${d ? d.flag + " " + d.name : w.id}</div>
        <div class="rteam">${team.name}</div>
      </a>`;
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
        <span class="cname"><a href="equipe.html?id=${c.team}&season=${SEASON}">${team.name}</a></span>
        <span class="cpts mono">${c.pts} ${t("podium_pts")}</span>
      </div>`;
  }).join("");
}

/* chama todas as funções de renderização a partir do estado já
   carregado — usado depois de loadData() e de novo toda vez que o
   idioma muda (sem refazer nenhuma chamada à API) */
function renderAll(){
  if (!DRIVERS.length) return;
  renderHeaderTexts();
  renderPodium();
  renderChips();
  buildChart();
  renderStandings();
  renderRaceStrip();
  renderConstructors();
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

document.getElementById("btn-share-card").addEventListener("click", async (e)=>{
  const btn = e.currentTarget;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = t("share_card_generating");
  try{
    const canvas = await generatePodiumCard({ season: SEASON, drivers: DRIVERS, teams: TEAMS });
    downloadCanvas(canvas, `f1-${SEASON}-podio.png`);
  } catch (err){
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

/* alternância de idioma: troca o texto estático (data-i18n) e depois
   re-renderiza tudo que já foi carregado, sem refazer chamadas à API */
renderLangToggle(document.getElementById("lang-toggle"), () => {
  renderAll();
});
applyStaticTranslations();

/* =========================================================
   CAIXA DE SELEÇÃO DE TEMPORADA
   ========================================================= */

/* busca todas as temporadas que a API tem disponível e monta as
   opções da caixa de seleção (a mais recente primeiro) */
async function loadSeasonOptions(){
  const select = document.getElementById("season-select");
  const seasons = await fetchSeasons();
  if (seasons.length){
    LATEST_SEASON = seasons[0];
    select.innerHTML = seasons.map(y => `<option value="${y}">${y}</option>`).join("");
  } else {
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
  gapRef = null;

  document.getElementById("podium").innerHTML = `<div class="state-msg">${t("podium_loading")}</div>`;
  document.getElementById("chip-groups").innerHTML = "";
  document.getElementById("chart").innerHTML = "";
  document.getElementById("standings-body").innerHTML = "";
  document.getElementById("race-strip").innerHTML = "";
  document.getElementById("cons-grid").innerHTML = "";
  document.getElementById("title-math").textContent = "";
  document.getElementById("btn-share-card").hidden = true;
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
    renderAll();
  } catch (err){
    document.getElementById("live-dot").classList.add("err");
    document.getElementById("tb-round").textContent = t("state_error_round");
    document.getElementById("podium").innerHTML =
      `<div class="state-msg error">${t("state_error_load", { err: err.message })}</div>`;
    console.error(err);
  }
}
loadSeasonOptions();
init();
