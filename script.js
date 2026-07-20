/* =========================================================
   F1 2026 · Campeonato de Pilotos — script.js

   Como este arquivo funciona, resumido:
   1. loadData()       busca os dados AO VIVO na API da Jolpica F1
                        (pontuação, corridas, vencedores, equipes).
   2. as funções renderX() pegam esses dados e escrevem o HTML/SVG
      de cada parte da página (pódio, gráfico, tabela, etc).
   3. init() (lá no final do arquivo) chama loadData() e depois
      todas as renderX(), na ordem certa, quando a página abre.

   Nenhum resultado de corrida fica fixo aqui no código — tudo é
   buscado de novo, ao vivo, toda vez que a página é aberta.
   ========================================================= */

const API = "https://api.jolpi.ca/ergast/f1";
let SEASON = 2026; // trocado pela caixa de seleção de temporada, lá embaixo

/* cor e nome de exibição de cada equipe */
const TEAM_META = {
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
const NATIONALITY_CODE = {
  Italian:"it", British:"gb", Monegasque:"mc", Australian:"au", Dutch:"nl",
  French:"fr", German:"de", Spanish:"es", Brazilian:"br", Thai:"th",
  Finnish:"fi", Mexican:"mx", Canadian:"ca", "New Zealander":"nz", Argentine:"ar",
  American:"us", Japanese:"jp", Danish:"dk", Chinese:"cn", Indian:"in",
  Polish:"pl", Swedish:"se", Belgian:"be", Austrian:"at", Swiss:"ch",
  Russian:"ru", Indonesian:"id", Colombian:"co", Portuguese:"pt", Irish:"ie",
};

/* id do circuito (como a API identifica) -> sigla curta pro eixo X do gráfico */
const CIRCUIT_CODE = {
  albert_park:"AUS", shanghai:"CHN", suzuka:"JPN", bahrain:"BHR", jeddah:"SAU",
  miami:"MIA", imola:"EMI", monaco:"MON", catalunya:"ESP", villeneuve:"CAN",
  red_bull_ring:"AUT", silverstone:"GBR", spa:"BEL", hungaroring:"HUN",
  zandvoort:"NED", monza:"ITA", baku:"AZE", marina_bay:"SIN", americas:"USA",
  rodriguez:"MEX", interlagos:"BRA", las_vegas:"LVG", losail:"QAT", yas_marina:"ABU",
};

const MONTHS_PT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function fmtDate(iso){
  const [y,m,d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_PT[m-1]}`;
}
function fmtDateLong(iso){
  const [y,m,d] = iso.split("-").map(Number);
  const months = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  return `${d} de ${months[m-1]} de ${y}`;
}
function flagFor(nat){
  const code = NATIONALITY_CODE[nat] || "xx";
  return `<span class="fi fi-${code}" title="${nat}"></span>`;
}
function codeFor(circuitId, locality){
  return CIRCUIT_CODE[circuitId] || (locality || "???").slice(0,3).toUpperCase();
}
function teamMeta(id, fallbackName){
  if (TEAM_META[id]) return TEAM_META[id];
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return { name: fallbackName, color: `hsl(${hash % 360} 70% 55%)` };
}

async function fetchJSON(url, attempt = 0){
  const res = await fetch(url);
  if (res.status === 429 && attempt < 4){
    const retryAfter = Number(res.headers.get("retry-after"));
    const delay = retryAfter ? retryAfter * 1000 : 600 * (attempt + 1);
    await new Promise(r => setTimeout(r, delay));
    return fetchJSON(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  return res.json();
}

/* limita concorrência das chamadas por rodada pra não estourar rate limit da API */
async function loadPool(items, worker, concurrency = 2){
  const results = new Array(items.length);
  let i = 0;
  async function run(){
    while (i < items.length){
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

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
let MAX_Y = 200;
let GRID_STEP = 25;
let leaderPts = 0;
let visible = new Set();
const SECOND_DRIVER = new Set();

/* arredonda o teto do eixo Y pro próximo número "redondo" (1/2/2.5/5/10 * 10^n) */
function niceAxis(maxValue, ticks = 5){
  const raw = Math.max(maxValue, 10);
  const roughStep = raw / ticks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const norm = roughStep / magnitude;
  const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  const step = niceNorm * magnitude;
  return { max: Math.ceil(raw / step) * step, step };
}

/* =========================================================
   CARREGAMENTO DOS DADOS (Jolpica F1 API)
   ========================================================= */
async function loadData(){
  const [winnersData, constructorsData, fullCalendar] = await Promise.all([
    fetchJSON(`${API}/${SEASON}/results/1.json?limit=40`),
    fetchJSON(`${API}/${SEASON}/constructorStandings.json`),
    fetchJSON(`${API}/${SEASON}.json?limit=40`),
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
    const data = await fetchJSON(`${API}/${SEASON}/${round}/driverStandings.json`);
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
      renderChart();
    });
  });
  el.querySelectorAll(".team-label").forEach(label=>{
    label.addEventListener("click", ()=>{
      const teamKey = label.dataset.team;
      const teamDrivers = DRIVERS.filter(d=>d.team===teamKey).map(d=>d.id);
      const allOn = teamDrivers.every(id=>visible.has(id));
      teamDrivers.forEach(id=> allOn ? visible.delete(id) : visible.add(id));
      syncChipStates();
      renderChart();
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
   RENDER: GRÁFICO SVG (evolução de pontos por corrida)
   ========================================================= */
const svgNS = "http://www.w3.org/2000/svg";
const PAD = { left:48, right:20, top:20, bottom:44 };
const VB_W = 1160, VB_H = 540;
const plotW = VB_W - PAD.left - PAD.right;
const plotH = VB_H - PAD.top - PAD.bottom;

function xFor(i){ return PAD.left + (i * (plotW / (RACES.length-1 || 1))); }
function yFor(v){ return PAD.top + (1 - v/MAX_Y) * plotH; }

/* elementos do SVG são criados uma única vez e reaproveitados nas
   atualizações seguintes (troca de seleção / rescala do eixo Y), só
   os atributos mudam — assim a transição CSS anima suavemente em vez
   de tudo piscar e recomeçar do zero a cada clique. */
let chartBuilt = false;
const gridTicks = [];
const driverEls = new Map();
const GRID_TICKS = 5;

function buildChartSkeleton(){
  const svg = document.getElementById("chart");
  svg.innerHTML = "";
  svg.setAttribute("viewBox", `0 0 ${VB_W} ${VB_H}`);

  const gridGroup = document.createElementNS(svgNS,"g");
  const xAxisGroup = document.createElementNS(svgNS,"g");
  const linesGroup = document.createElementNS(svgNS,"g");
  const dotsGroup = document.createElementNS(svgNS,"g");
  svg.append(gridGroup, xAxisGroup, linesGroup, dotsGroup);

  // cada tick da grade é um grupo com a linha+label na origem local;
  // o grupo inteiro é movido via transform (translateY), que é uma
  // propriedade CSS de verdade e por isso anima suave — diferente de
  // x1/y1/x2/y2 de <line>, que não são propriedades CSS animáveis.
  gridTicks.length = 0;
  for (let i=0; i<=GRID_TICKS; i++){
    const g = document.createElementNS(svgNS,"g");
    g.setAttribute("class", "grid-tick");

    const line = document.createElementNS(svgNS,"line");
    line.setAttribute("x1", PAD.left); line.setAttribute("x2", VB_W-PAD.right);
    line.setAttribute("y1", 0); line.setAttribute("y2", 0);
    line.setAttribute("class", "gridline" + (i===0 ? " zero" : ""));
    g.appendChild(line);

    const label = document.createElementNS(svgNS,"text");
    label.setAttribute("x", PAD.left - 10); label.setAttribute("y", 4);
    label.setAttribute("text-anchor","end"); label.setAttribute("class","axis-label");
    g.appendChild(label);

    gridGroup.appendChild(g);
    gridTicks.push({ g, label });
  }

  // eixo X (fixo pra temporada toda, não muda com a seleção)
  RACES.forEach((r,i)=>{
    const x = xFor(i);
    const label = document.createElementNS(svgNS,"text");
    label.setAttribute("x", x); label.setAttribute("y", VB_H - PAD.bottom + 26);
    label.setAttribute("class","race-label");
    label.textContent = r;
    xAxisGroup.appendChild(label);
  });

  const tooltip = document.getElementById("tooltip");

  driverEls.clear();
  DRIVERS.forEach(d=>{
    const team = TEAMS[d.team];
    const isSecond = SECOND_DRIVER.has(d.id);

    const path = document.createElementNS(svgNS,"path");
    path.setAttribute("class","driver-line hidden");
    path.setAttribute("stroke", team.color);
    if (isSecond) path.setAttribute("stroke-dasharray","6 4");
    path.dataset.id = d.id;
    linesGroup.appendChild(path);

    const dots = d.pts.map((v,i)=>{
      const c = document.createElementNS(svgNS,"circle");
      c.setAttribute("r", 3.4);
      c.setAttribute("fill", team.color);
      c.setAttribute("class","pt-dot hidden");
      c.dataset.id = d.id;

      c.addEventListener("mouseenter", ()=>{
        highlight(d.id, true);
        const rect = svg.getBoundingClientRect();
        const scaleX = rect.width / VB_W, scaleY = rect.height / VB_H;
        const cx = parseFloat(c.getAttribute("cx"));
        const cy = parseFloat(c.getAttribute("cy"));
        tooltip.style.left = (cx*scaleX) + "px";
        tooltip.style.top = (cy*scaleY) + "px";
        tooltip.querySelector(".sw").style.background = team.color;
        tooltip.querySelector(".tt-name").innerHTML = d.flag + " " + d.name;
        tooltip.querySelector(".tt-race").textContent = RACE_FULL[i];
        tooltip.querySelector(".tt-pts").textContent = d.pts[i] + " pts acumulados";
        tooltip.style.opacity = 1;
      });
      c.addEventListener("mouseleave", ()=>{
        highlight(d.id, false);
        tooltip.style.opacity = 0;
      });
      dotsGroup.appendChild(c);
      return c;
    });

    driverEls.set(d.id, { path, dots });
  });

  chartBuilt = true;
}

/* anima o número exibido de um valor antigo até o novo, em vez de
   trocar o texto instantaneamente — acompanha visualmente a mesma
   duração/curva da transição das linhas quando o eixo Y rescala. */
function tweenLabel(el, from, to, duration = 500){
  if (el._tweenRaf) cancelAnimationFrame(el._tweenRaf);
  if (from === to){ el.textContent = Math.round(to); return; }
  const start = performance.now();
  function step(now){
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    el._tweenRaf = t < 1 ? requestAnimationFrame(step) : null;
  }
  el._tweenRaf = requestAnimationFrame(step);
}

let prevMaxY = null;

/* redesenha o gráfico com quem estiver marcado como visível no momento */
function renderChart(){
  if (!chartBuilt) buildChartSkeleton();

  const shown = DRIVERS.filter(d => visible.has(d.id));
  const maxPts = shown.reduce((m,d) => Math.max(m, d.pts[d.pts.length-1]), 0);
  MAX_Y = niceAxis(maxPts).max;
  GRID_STEP = MAX_Y / GRID_TICKS;

  for (let i=0; i<=GRID_TICKS; i++){
    const v = GRID_STEP * i;
    const y = yFor(v);
    gridTicks[i].g.style.transform = `translateY(${y}px)`;
    const fromV = prevMaxY == null ? v : (prevMaxY / GRID_TICKS) * i;
    tweenLabel(gridTicks[i].label, fromV, v);
  }
  prevMaxY = MAX_Y;

  DRIVERS.forEach(d=>{
    const els = driverEls.get(d.id);
    const isVisible = visible.has(d.id);
    const points = d.pts.map((v,i)=>[xFor(i), yFor(v)]);
    const dAttr = points.map((p,i)=> (i===0?"M":"L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    els.path.setAttribute("d", dAttr);
    els.path.classList.toggle("hidden", !isVisible);
    points.forEach((p,i)=>{
      els.dots[i].setAttribute("cx", p[0]); els.dots[i].setAttribute("cy", p[1]);
      els.dots[i].classList.toggle("hidden", !isVisible);
    });
  });
}

/* ao passar o mouse num ponto, apaga um pouco as outras linhas pra
   destacar a que está sendo observada */
function highlight(id, on){
  document.querySelectorAll(`.driver-line[data-id="${id}"]`).forEach(l=>{
    l.classList.toggle("hot", on && visible.has(id));
  });
  if (!visible.has(id)) return;
  document.querySelectorAll(".driver-line:not(.hidden)").forEach(l=>{
    if (l.dataset.id !== id) l.classList.toggle("dim", on);
  });
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
      <tr>
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
  syncChipStates(); renderChart();
});
document.getElementById("btn-top10").addEventListener("click", ()=>{
  visible = new Set(DRIVERS.slice(0,10).map(d=>d.id));
  syncChipStates(); renderChart();
});
document.getElementById("btn-all").addEventListener("click", ()=>{
  visible = new Set(DRIVERS.map(d=>d.id));
  syncChipStates(); renderChart();
});
document.getElementById("btn-none").addEventListener("click", ()=>{
  visible = new Set();
  syncChipStates(); renderChart();
});

/* =========================================================
   CAIXA DE SELEÇÃO DE TEMPORADA
   ========================================================= */

/* busca todas as temporadas que a API tem disponível e monta as
   opções da caixa de seleção (a mais recente primeiro) */
async function loadSeasonOptions(){
  const select = document.getElementById("season-select");
  try{
    const data = await fetchJSON(`${API}/seasons.json?limit=100`);
    const seasons = data.MRData.SeasonTable.Seasons.map(s => Number(s.season)).sort((a,b) => b-a);
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
  chartBuilt = false;
  driverEls.clear();
  gridTicks.length = 0;
  SECOND_DRIVER.clear();
  prevMaxY = null;
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
    renderChart();
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
