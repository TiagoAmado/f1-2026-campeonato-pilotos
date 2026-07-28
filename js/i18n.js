/* =========================================================
   js/i18n.js — alternância PT/EN. Dicionário único pra todas as
   páginas (site pequeno o bastante pra não precisar dividir em
   arquivos por página), persistido em localStorage. Trocar de idioma
   nunca refaz chamadas à API — só re-renderiza com os dados já
   carregados (ver "onChange" em renderLangToggle).
   ========================================================= */

const STORAGE_KEY = "f1-lang";

const DICT = {
  pt: {
    // navegação / cabeçalho comum
    nav_home: "Início",
    nav_calendar: "Calendário",
    nav_calendar_full: "Calendário completo",
    nav_compare: "Comparar pilotos",
    lang_pt: "PT",
    lang_en: "EN",

    // home — topbar
    topbar_season: "TEMPORADA",

    // home — hero
    hero_eyebrow: "Fórmula 1 · Campeonato Mundial de Pilotos {season}",
    hero_title_l1: "Classificação atualizada,",
    hero_title_l2: "corrida a corrida.",
    hero_sub_loading: "Carregando dados ao vivo da temporada {season}…",
    hero_sub: "Pontuação de todos os {count} pilotos após as {completed} rodadas já disputadas em {season} — dados ao vivo da Jolpica F1 API, com gráfico dinâmico para comparar quem você quiser.",
    share_card_btn: "⬇ Baixar cartão do pódio",
    share_card_generating: "Gerando…",
    share_card_title_l1: "CLASSIFICAÇÃO",
    share_card_title_l2: "ATUALIZADA",
    share_card_footer: "DADOS OFICIAIS DA FIA VIA JOLPICA F1 API",

    page_title_home: "F1 {season} · Campeonato de Pilotos",
    topbar_round: "RODADA {completed}/{total} CONCLUÍDA",
    topbar_winner: "Vencedor: {flag} {name}",
    state_error_no_races: "Nenhuma corrida concluída encontrada para {season}.",
    state_error_round: "erro ao carregar dados ao vivo",

    // home — pódio
    podium_loading: "Carregando pódio…",
    podium_win: "vitória",
    podium_wins: "vitórias",
    podium_leader: "Líder do campeonato",
    podium_gap: "{gap} pts atrás do líder",
    podium_pts: "pts",

    // home — gráfico
    chart_title: "Evolução de pontos por corrida",
    chart_desc: "Eixo X = corridas da temporada · Eixo Y = pontos acumulados · cores = equipe. Clique nos pilotos abaixo para escolher quem aparece no gráfico.",
    chart_top5: "Top 5",
    chart_top10: "Top 10",
    chart_all: "Todos",
    chart_clear: "Limpar",
    chart_pts_label: "pts acumulados",

    // home — classificação
    standings_title: "Classificação de pilotos",
    standings_sub: "Após a rodada {completed} de {total} — {race}, {date}.",
    standings_th_pos: "Pos",
    standings_th_driver: "Piloto",
    standings_th_team: "Equipe",
    standings_th_points: "Pontos",
    standings_th_wins: "Vitórias",
    standings_th_gap: "Diferença",

    // home — calculadora de título
    title_math_season_over_champion: "🏆 Temporada encerrada — {name} é o campeão.",
    title_math_season_over: "Temporada encerrada.",
    title_math_decided: "🏆 Título matematicamente decidido: {name} não pode mais ser alcançado.",
    title_math_rounds_one: "Falta {n} corrida pra {name} confirmar o título matematicamente, se a diferença atual se mantiver.",
    title_math_rounds_many: "Faltam {n} corridas pra {name} confirmar o título matematicamente, se a diferença atual se mantiver.",
    title_math_open: "Título ainda em aberto até a última corrida — {max} pontos em disputa.",

    // home — vencedores de cada etapa
    winners_title: "Vencedores de cada etapa",
    winners_sub: "As {completed} corridas já disputadas em {season}.",
    winners_round: "RODADA {n}",

    // home — construtores
    constructors_title: "Campeonato de Construtores",
    constructors_desc: "Soma dos pontos das duas equipes de cada montadora.",

    // home — rodapé
    footer_meta: "Dados oficiais da FIA via Jolpica F1 API · {drivers} pilotos · {teams} equipes · {completed}/{total} corridas",
    footer_updated: "Atualizado ao vivo em {date} às {time}",
    footer_credit: "Dados oficiais da FIA via Jolpica F1 API",

    // estados genéricos
    state_error_load: "Não foi possível carregar os dados ao vivo agora ({err}). Tente recarregar a página em alguns instantes.",

    // subpáginas — cabeçalho e estados compartilhados
    state_loading: "Carregando…",
    no_race_selected: "Nenhuma corrida selecionada",
    select_race_prompt: 'Selecione uma corrida no <a href="calendario.html">calendário</a>.',
    round_season_label: "Rodada {round} · {season}",
    race_meta_line: "{circuit} · {locality}, {country} · rodada {round}, temporada {season}",

    // calendário
    calendar_eyebrow: "Calendário completo",
    calendar_title_l1: "Todas as corridas",
    calendar_title_l2: "da temporada.",
    loading_calendar: "Carregando calendário…",
    loading_races: "Carregando corridas…",
    calendar_hero_sub: "{count} corridas na temporada {season}.",
    page_title_calendar: "Calendário · {season}",
    countdown_today: "É hoje!",
    countdown_tomorrow: "Amanhã",
    countdown_days: "Daqui a {n} dias",
    link_race: "Corrida →",
    link_qualifying: "Treino →",
    link_sprint_result: "Sprint →",
    link_pitstops: "Paradas mais rápidas →",
    link_fastest_laps: "Voltas mais rápidas →",
    link_reliability: "Confiabilidade por equipe →",
    error_load_calendar: "Não foi possível carregar o calendário agora ({err}).",
    error_no_races_season: "Nenhuma corrida encontrada para {season}.",

    // resultado da corrida / sprint
    race_result_eyebrow: "Resultado da corrida",
    sprint_result_eyebrow: "Resultado da sprint",
    loading_result: "Carregando resultado…",
    page_title_race_result: "{name} · Resultado",
    error_load_result: "Não foi possível carregar o resultado ({err}).",
    no_sprint_data: "Não houve sprint nesta etapa.",

    // treino classificatório
    qualifying_eyebrow: "Treino classificatório",
    loading_qualifying: "Carregando treino…",
    page_title_qualifying: "{name} · Treino",
    no_qualifying_data: "Sem dados de treino classificatório pra esta corrida.",
    error_load_qualifying: "Não foi possível carregar o treino ({err}).",

    // tabela de resultados (corrida/sprint)
    results_th_result: "Resultado",
    fastest_lap_label: "Volta mais rápida",
    no_results_data: "Sem dados disponíveis pra esta etapa.",
    status_finished: "Terminou",
    status_retired: "Abandonou",
    status_accident: "Acidente",
    status_collision: "Colisão",
    status_engine: "Motor",
    status_gearbox: "Câmbio",
    status_disqualified: "Desclassificado",
    status_withdrew: "Retirou-se",
    status_dnq: "Não classificou",
    status_dns: "Não largou",
    status_spun_off: "Rodou e saiu",
    status_lapped: "Voltas de atraso",
  },

  en: {
    nav_home: "Home",
    nav_calendar: "Calendar",
    nav_calendar_full: "Full calendar",
    nav_compare: "Compare drivers",
    lang_pt: "PT",
    lang_en: "EN",

    topbar_season: "SEASON",

    hero_eyebrow: "Formula 1 · {season} World Drivers' Championship",
    hero_title_l1: "Standings updated,",
    hero_title_l2: "race by race.",
    hero_sub_loading: "Loading live data for the {season} season…",
    hero_sub: "Points for all {count} drivers after the {completed} rounds already raced in {season} — live data from the Jolpica F1 API, with a dynamic chart to compare whoever you want.",
    share_card_btn: "⬇ Download podium card",
    share_card_generating: "Generating…",
    share_card_title_l1: "STANDINGS",
    share_card_title_l2: "UPDATED",
    share_card_footer: "OFFICIAL FIA DATA VIA JOLPICA F1 API",

    page_title_home: "F1 {season} · Drivers Championship",
    topbar_round: "ROUND {completed}/{total} COMPLETE",
    topbar_winner: "Winner: {flag} {name}",
    state_error_no_races: "No completed races found for {season}.",
    state_error_round: "error loading live data",

    podium_loading: "Loading podium…",
    podium_win: "win",
    podium_wins: "wins",
    podium_leader: "Championship leader",
    podium_gap: "{gap} pts behind the leader",
    podium_pts: "pts",

    chart_title: "Points progression by race",
    chart_desc: "X axis = races of the season · Y axis = accumulated points · colors = team. Click the drivers below to choose who appears on the chart.",
    chart_top5: "Top 5",
    chart_top10: "Top 10",
    chart_all: "All",
    chart_clear: "Clear",
    chart_pts_label: "accumulated pts",

    standings_title: "Drivers' standings",
    standings_sub: "After round {completed} of {total} — {race}, {date}.",
    standings_th_pos: "Pos",
    standings_th_driver: "Driver",
    standings_th_team: "Team",
    standings_th_points: "Points",
    standings_th_wins: "Wins",
    standings_th_gap: "Gap",

    title_math_season_over_champion: "🏆 Season over — {name} is the champion.",
    title_math_season_over: "Season over.",
    title_math_decided: "🏆 Title mathematically decided: {name} can no longer be caught.",
    title_math_rounds_one: "{name} can mathematically confirm the title in {n} race, if the current gap holds.",
    title_math_rounds_many: "{name} can mathematically confirm the title in {n} races, if the current gap holds.",
    title_math_open: "Title still open until the last race — {max} points still up for grabs.",

    winners_title: "Winners of each round",
    winners_sub: "The {completed} races already held in {season}.",
    winners_round: "ROUND {n}",

    constructors_title: "Constructors' Championship",
    constructors_desc: "Combined points of both teams from each manufacturer.",

    footer_meta: "Official FIA data via Jolpica F1 API · {drivers} drivers · {teams} teams · {completed}/{total} races",
    footer_updated: "Updated live on {date} at {time}",
    footer_credit: "Official FIA data via Jolpica F1 API",

    state_error_load: "Could not load live data right now ({err}). Try reloading the page in a moment.",

    // subpáginas — cabeçalho e estados compartilhados
    state_loading: "Loading…",
    no_race_selected: "No race selected",
    select_race_prompt: 'Select a race in the <a href="calendario.html">calendar</a>.',
    round_season_label: "Round {round} · {season}",
    race_meta_line: "{circuit} · {locality}, {country} · round {round}, {season} season",

    // calendário
    calendar_eyebrow: "Full calendar",
    calendar_title_l1: "All the races",
    calendar_title_l2: "of the season.",
    loading_calendar: "Loading calendar…",
    loading_races: "Loading races…",
    calendar_hero_sub: "{count} races in the {season} season.",
    page_title_calendar: "Calendar · {season}",
    countdown_today: "Today!",
    countdown_tomorrow: "Tomorrow",
    countdown_days: "In {n} days",
    link_race: "Race →",
    link_qualifying: "Qualifying →",
    link_sprint_result: "Sprint →",
    link_pitstops: "Fastest pit stops →",
    link_fastest_laps: "Fastest laps →",
    link_reliability: "Reliability by team →",
    error_load_calendar: "Could not load the calendar right now ({err}).",
    error_no_races_season: "No races found for {season}.",

    // resultado da corrida / sprint
    race_result_eyebrow: "Race result",
    sprint_result_eyebrow: "Sprint result",
    loading_result: "Loading result…",
    page_title_race_result: "{name} · Result",
    error_load_result: "Could not load the result ({err}).",
    no_sprint_data: "There was no sprint at this round.",

    // treino classificatório
    qualifying_eyebrow: "Qualifying",
    loading_qualifying: "Loading qualifying…",
    page_title_qualifying: "{name} · Qualifying",
    no_qualifying_data: "No qualifying data available for this race.",
    error_load_qualifying: "Could not load qualifying ({err}).",

    // tabela de resultados (corrida/sprint)
    results_th_result: "Result",
    fastest_lap_label: "Fastest lap",
    no_results_data: "No data available for this round.",
    status_finished: "Finished",
    status_retired: "Retired",
    status_accident: "Accident",
    status_collision: "Collision",
    status_engine: "Engine",
    status_gearbox: "Gearbox",
    status_disqualified: "Disqualified",
    status_withdrew: "Withdrew",
    status_dnq: "Did not qualify",
    status_dns: "Did not start",
    status_spun_off: "Spun off",
    status_lapped: "Lapped",
  },
};

export function getLang(){
  try{
    const l = localStorage.getItem(STORAGE_KEY);
    return l === "en" ? "en" : "pt";
  } catch {
    return "pt";
  }
}

export function setLang(lang){
  try{ localStorage.setItem(STORAGE_KEY, lang); } catch {}
}

/* traduz "chave" pro idioma atual, com interpolação {var} simples */
export function t(key, vars){
  const lang = getLang();
  let str = DICT[lang]?.[key] ?? DICT.pt[key] ?? key;
  if (vars){
    for (const [k, v] of Object.entries(vars)) str = str.split(`{${k}}`).join(v);
  }
  return str;
}

/* aplica tradução em todo elemento com data-i18n="chave" (textContent) */
export function applyStaticTranslations(root = document){
  root.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.documentElement.lang = getLang() === "en" ? "en" : "pt-BR";
}

/* monta o botão PT/EN dentro de "el"; "onChange" roda depois de trocar
   o idioma e reaplicar as traduções estáticas — cada página usa isso
   pra re-renderizar o conteúdo dinâmico (tabelas, gráfico etc.) com
   os dados já carregados, sem refazer chamadas à API */
export function renderLangToggle(el, onChange){
  function paint(){
    const lang = getLang();
    el.innerHTML = `
      <button type="button" class="lang-btn ${lang === "pt" ? "on" : ""}" data-lang="pt">${t("lang_pt")}</button>
      <button type="button" class="lang-btn ${lang === "en" ? "on" : ""}" data-lang="en">${t("lang_en")}</button>`;
    el.querySelectorAll("[data-lang]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.dataset.lang === getLang()) return;
        setLang(btn.dataset.lang);
        paint();
        applyStaticTranslations();
        onChange?.();
      });
    });
  }
  paint();
}
