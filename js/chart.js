/* =========================================================
   js/chart.js — motor do gráfico SVG de evolução de pontos por
   corrida. Extraído do script.js original pra poder ser reaproveitado
   em outras séries além dos pilotos da home (ex.: evolução de pontos
   por equipe, na Fase 2) — cada chamada de createLineChart() guarda
   seu próprio estado, isolado das demais.
   ========================================================= */

const svgNS = "http://www.w3.org/2000/svg";
const PAD = { left:48, right:20, top:20, bottom:44 };
const VB_W = 1160, VB_H = 540;
const plotW = VB_W - PAD.left - PAD.right;
const plotH = VB_H - PAD.top - PAD.bottom;
const GRID_TICKS = 5;

/* arredonda o teto do eixo Y pro próximo número "redondo" (1/2/2.5/5/10 * 10^n) */
function niceAxis(maxValue, ticks = GRID_TICKS){
  const raw = Math.max(maxValue, 10);
  const roughStep = raw / ticks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const norm = roughStep / magnitude;
  const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  const step = niceNorm * magnitude;
  return { max: Math.ceil(raw / step) * step, step };
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

/* series: [{ id, color, dashed, label (HTML), pts: number[] }]
   xLabels: siglas curtas do eixo X (uma por corrida)
   xLabelsFull: descrição completa pra tooltip (opcional, usa xLabels se ausente) */
export function createLineChart({ svg, tooltip, xLabels, xLabelsFull, valueLabel = "pts acumulados" }){
  let series = [];
  let visible = new Set();
  let MAX_Y = 200;
  let prevMaxY = null;
  let chartBuilt = false;
  const gridTicks = [];
  const seriesEls = new Map();

  function xFor(i){ return PAD.left + (i * (plotW / (xLabels.length-1 || 1))); }
  function yFor(v){ return PAD.top + (1 - v/MAX_Y) * plotH; }

  /* elementos do SVG são criados uma única vez e reaproveitados nas
     atualizações seguintes (troca de seleção / rescala do eixo Y), só
     os atributos mudam — assim a transição CSS anima suavemente em vez
     de tudo piscar e recomeçar do zero a cada clique. */
  function build(){
    svg.innerHTML = "";
    svg.setAttribute("viewBox", `0 0 ${VB_W} ${VB_H}`);

    const gridGroup = document.createElementNS(svgNS,"g");
    const xAxisGroup = document.createElementNS(svgNS,"g");
    const linesGroup = document.createElementNS(svgNS,"g");
    const dotsGroup = document.createElementNS(svgNS,"g");
    svg.append(gridGroup, xAxisGroup, linesGroup, dotsGroup);

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

    xLabels.forEach((r,i)=>{
      const x = xFor(i);
      const label = document.createElementNS(svgNS,"text");
      label.setAttribute("x", x); label.setAttribute("y", VB_H - PAD.bottom + 26);
      label.setAttribute("class","race-label");
      label.textContent = r;
      xAxisGroup.appendChild(label);
    });

    seriesEls.clear();
    series.forEach(s=>{
      const path = document.createElementNS(svgNS,"path");
      path.setAttribute("class","driver-line hidden");
      path.setAttribute("stroke", s.color);
      if (s.dashed) path.setAttribute("stroke-dasharray","6 4");
      path.dataset.id = s.id;
      linesGroup.appendChild(path);

      const dots = s.pts.map((v,i)=>{
        const c = document.createElementNS(svgNS,"circle");
        c.setAttribute("r", 3.4);
        c.setAttribute("fill", s.color);
        c.setAttribute("class","pt-dot hidden");
        c.dataset.id = s.id;

        c.addEventListener("mouseenter", ()=>{
          highlight(s.id, true);
          const rect = svg.getBoundingClientRect();
          const scaleX = rect.width / VB_W, scaleY = rect.height / VB_H;
          const cx = parseFloat(c.getAttribute("cx"));
          const cy = parseFloat(c.getAttribute("cy"));
          tooltip.style.left = (cx*scaleX) + "px";
          tooltip.style.top = (cy*scaleY) + "px";
          tooltip.querySelector(".sw").style.background = s.color;
          tooltip.querySelector(".tt-name").innerHTML = s.label;
          tooltip.querySelector(".tt-race").textContent = (xLabelsFull && xLabelsFull[i]) || xLabels[i];
          tooltip.querySelector(".tt-pts").textContent = `${s.pts[i]} ${valueLabel}`;
          tooltip.style.opacity = 1;
        });
        c.addEventListener("mouseleave", ()=>{
          highlight(s.id, false);
          tooltip.style.opacity = 0;
        });
        dotsGroup.appendChild(c);
        return c;
      });

      seriesEls.set(s.id, { path, dots });
    });

    chartBuilt = true;
  }

  /* redesenha o gráfico com quem estiver marcado como visível no momento */
  function render(){
    if (!chartBuilt) build();

    const shown = series.filter(s => visible.has(s.id));
    const maxPts = shown.reduce((m,s) => Math.max(m, s.pts[s.pts.length-1]), 0);
    MAX_Y = niceAxis(maxPts).max;
    const gridStep = MAX_Y / GRID_TICKS;

    for (let i=0; i<=GRID_TICKS; i++){
      const v = gridStep * i;
      const y = yFor(v);
      gridTicks[i].g.style.transform = `translateY(${y}px)`;
      const fromV = prevMaxY == null ? v : (prevMaxY / GRID_TICKS) * i;
      tweenLabel(gridTicks[i].label, fromV, v);
    }
    prevMaxY = MAX_Y;

    series.forEach(s=>{
      const els = seriesEls.get(s.id);
      const isVisible = visible.has(s.id);
      const points = s.pts.map((v,i)=>[xFor(i), yFor(v)]);
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
    svg.querySelectorAll(`.driver-line[data-id="${id}"]`).forEach(l=>{
      l.classList.toggle("hot", on && visible.has(id));
    });
    if (!visible.has(id)) return;
    svg.querySelectorAll(".driver-line:not(.hidden)").forEach(l=>{
      if (l.dataset.id !== id) l.classList.toggle("dim", on);
    });
  }

  return {
    /* troca o conjunto de séries (ex.: nova temporada carregada) e força
       reconstrução do esqueleto SVG na próxima chamada de render() */
    setSeries(newSeries){
      series = newSeries;
      chartBuilt = false;
      seriesEls.clear();
      gridTicks.length = 0;
      prevMaxY = null;
    },
    setVisible(idsSet){
      visible = idsSet;
    },
    getVisible(){
      return visible;
    },
    render,
  };
}
