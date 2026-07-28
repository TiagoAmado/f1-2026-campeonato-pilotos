/* =========================================================
   js/layout.js — cabeçalho compartilhado pras páginas "de detalhe"
   (calendário, corrida, treino, sprint, piloto, equipe). A home tem
   seu próprio topbar com seletor de temporada (script.js) e não usa
   este módulo.
   ========================================================= */

import { t, renderLangToggle } from "./i18n.js";

/* monta a barra do topo de uma página secundária: link de volta +
   título da página (definido depois, quando os dados carregarem) +
   toggle PT/EN. "extra" é HTML opcional anexado antes do toggle (ex.:
   o seletor de temporada do calendário). "backKey" é a chave de
   tradução do link de volta (não o texto literal), pra ele poder ser
   re-traduzido quando o idioma mudar. "onLangChange" roda depois de
   trocar o idioma, pra a página re-renderizar seu conteúdo dinâmico. */
export function renderSubpageHeader(el, { backHref = "index.html", backKey = "nav_home", extra = "", onLangChange } = {}){
  el.innerHTML = `
    <div class="topbar-inner">
      <a class="back-link" id="back-link" href="${backHref}">← ${t(backKey)}</a>
      <span class="sep">·</span>
      <span class="page-title" id="page-title">${t("state_loading")}</span>
      ${extra}
      <span class="lang-toggle" id="lang-toggle"></span>
    </div>`;
  renderLangToggle(document.getElementById("lang-toggle"), () => {
    const back = document.getElementById("back-link");
    if (back) back.textContent = `← ${t(backKey)}`;
    onLangChange?.();
  });
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
