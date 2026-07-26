/* =========================================================
   js/layout.js — cabeçalho compartilhado pras páginas "de detalhe"
   (calendário, corrida, treino, sprint, piloto, equipe). A home tem
   seu próprio topbar com seletor de temporada (script.js) e não usa
   este módulo.
   ========================================================= */

/* monta a barra do topo de uma página secundária: link de volta +
   título da página (definido depois, quando os dados carregarem).
   "extra" é HTML opcional anexado ao final (ex.: o seletor de
   temporada do calendário). */
export function renderSubpageHeader(el, { backHref = "index.html", backLabel = "Início", extra = "" } = {}){
  el.innerHTML = `
    <div class="topbar-inner">
      <a class="back-link" href="${backHref}">← ${backLabel}</a>
      <span class="sep">·</span>
      <span class="page-title" id="page-title">carregando…</span>
      ${extra}
    </div>`;
}

export function setPageTitle(text){
  const el = document.getElementById("page-title");
  if (el) el.textContent = text;
}

/* lê season/round/id/a/b da querystring da página atual (a/b: usados
   pelo comparador de pilotos, pra identificar os dois lados) */
export function pageParams(){
  const p = new URLSearchParams(location.search);
  return {
    season: p.get("season") ? Number(p.get("season")) : null,
    round: p.get("round") ? Number(p.get("round")) : null,
    id: p.get("id"),
    a: p.get("a"),
    b: p.get("b"),
  };
}
