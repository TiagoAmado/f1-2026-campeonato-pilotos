# Roadmap de melhorias — F1 · Campeonato de Pilotos

> Documento de planejamento gerado a partir do brief `melhorias-f1-2026-vintage-racing.md`, adaptado à estrutura real do projeto (ver seção "O que existe hoje"). Cada fase é pensada pra ser implementada numa sessão própria, na ordem abaixo — a Fase 0 é pré-requisito técnico das demais.

---

## 0. Resumo

O site hoje é um dashboard de classificação ao vivo funcional, mas com identidade visual genérica (fundo quase-preto + acento roxo neon, um padrão comum em qualquer produto de dados gerado por IA sem direção de estilo, sem relação com o universo da F1) e mostra só a "foto final" do campeonato — classificação e vencedores. A Jolpica F1 API, que já alimenta o site, também expõe resultado completo de corrida, treino classificatório, sprint, paradas e voltas, e nada disso é usado hoje.

O plano ataca as duas frentes em fases separadas:

1. **Fase 0** — fundação técnica (extrair código compartilhado, cache, navegação) necessária antes de qualquer página nova.
2. **Fase 1** — nova identidade visual "vintage racing", sobre a estrutura atual, sem página nova nenhuma.
3. **Fases 2-4** — páginas e funcionalidades novas, em ordem de prioridade (P0 → P1 → P2), usando a fundação da Fase 0.

---

## 1. O que existe hoje

Levantado diretamente do código em `index.html`, `style.css` e `script.js` (não do site publicado):

- **Stack**: HTML/CSS/JS puro. Sem `package.json`, sem bundler, sem framework, sem testes, sem CI. Três arquivos na raiz do repo. Deploy via GitHub Pages direto da branch.
- **Fonte de dados**: `script.js:16` — `const API = "https://api.jolpi.ca/ergast/f1"`. Helper de fetch com retry em 429 (`script.js:79-89`) e um pool com concorrência limitada pra chamadas por rodada (`script.js:92-103`, evita estourar rate limit).
- **Endpoints já usados**: `/{season}/results/1.json` (vencedores), `/{season}/constructorStandings.json`, `/{season}.json` (calendário completo, só pra contar rodadas), `/{season}/{round}/driverStandings.json` (uma chamada por rodada concluída, pra montar a evolução de pontos), `/seasons.json` (lista de temporadas do seletor).
- **Cache**: nenhum. Toda troca de temporada refaz todas as chamadas acima do zero.
- **Tokens de cor** (`style.css:8-21`): `--bg:#0A0C10`, `--panel`, `--border`, `--text`, `--accent:#B14EFF` (roxo neon), `--green:#39FF88`, `--red:#FF5C5C`. Além disso, um padrão local de custom property por elemento — `--team-color` (cards do pódio) e `--c` (chips, tabela, cards de corrida, linhas de construtores) — injetado inline via JS a partir da cor de cada equipe.
- **Fontes**: Titillium Web (títulos), Inter (corpo), JetBrains Mono (dados/labels) via Google Fonts (`index.html:16`), mais a lib `flag-icons` via CDN (`index.html:17`).
- **Mapeamento de cor por equipe**: `TEAM_META` (`script.js:20-32`) com fallback via hash em `teamMeta()` (`script.js:72-77`) pra equipes fora da lista fixa (temporadas antigas).
- **Gráfico**: SVG desenhado à mão, sem lib (`script.js:319-479`) — esqueleto construído uma vez (`buildChartSkeleton`) e só os atributos mudam nas atualizações seguintes, pra animar via transição CSS.
- **Navegação**: nenhuma. Um único `index.html`, sem menu, sem links internos, sem outras páginas.

---

## 2. Decisões de arquitetura (já tomadas — não re-discutir nas próximas sessões)

| Decisão | Escolha | Por quê |
|---|---|---|
| Roteamento das páginas novas | **Páginas HTML estáticas separadas** (`corrida.html?season=&round=`, `piloto.html?id=`, etc.), não um router de hash dentro de `index.html` | Preserva a simplicidade "sem build" atual, dá URLs diretas e compartilháveis, evita transformar `script.js` num mini-framework de rotas |
| Compartilhamento de código entre páginas | **ES modules nativos** (`<script type="module">`, sem bundler) — extrair lógica comum pra arquivos em `js/` | Import/export nativo do browser funciona direto no GitHub Pages, sem etapa de build; evita duplicar fetch/cores/formatação em cada página nova |
| Cache de API | **`localStorage`** com TTL diferenciado — temporadas encerradas cacheiam por muito tempo (dados não mudam mais), temporada corrente com TTL curto (minutos) | A Jolpica F1 é mantida por voluntários; evita bater na API a cada troca de temporada/página com dado que não muda |
| Navegação entre páginas | Cabeçalho/nav simples e consistente, montado por um módulo JS compartilhado (não HTML duplicado em cada arquivo) | Site deixa de ser single-page; precisa de um jeito de ir de uma página pra outra sem duplicar o topbar em 7+ arquivos `.html` |

---

## 3. Fase 0 — Fundação técnica

**Objetivo**: preparar o código pra suportar páginas novas sem duplicar lógica, antes de mexer no visual ou adicionar conteúdo.

**Sem mudança visual perceptível ao final desta fase.**

- Extrair de `script.js` pra módulos ES reutilizáveis:
  - `js/api.js` — `fetchJSON`, `loadPool`, constante `API`, wrapper de cache em `localStorage`.
  - `js/teams.js` — `TEAM_META`, `teamMeta()`, `NATIONALITY_CODE`, `CIRCUIT_CODE`, `flagFor()`, `codeFor()`.
  - `js/format.js` — `fmtDate`, `fmtDateLong`, `MONTHS_PT`.
  - `js/chart.js` — motor do gráfico SVG (`buildChartSkeleton`/`renderChart` de `script.js:319-479`), parametrizado por lista de "séries" (pilotos ou equipes) em vez de assumir sempre `DRIVERS` global — necessário pra reaproveitar no perfil de equipe (Fase 2).
  - `js/layout.js` — monta topbar + nav + footer a partir de um template, pra toda página incluir sem duplicar HTML.
- Migrar `index.html` pra `<script type="module" src="script.js">` e ajustar `script.js` pra importar dos módulos acima.
- Implementar o cache em `js/api.js`: chave por `(endpoint, season)`, TTL curto (ex. 10-15 min) pra temporada corrente, TTL longo (ex. 1 dia+) pra temporadas já encerradas — dado que não muda mais não precisa recarregar.
- ~~Adicionar nav simples no `js/layout.js`~~ — descoberto durante a implementação que não faz sentido antes de existir uma segunda página pra navegar; adiado pra Fase 2, junto com a primeira página nova (evita módulo criado sem nenhum consumidor real).

**Arquivos**: `index.html`, `script.js` (refatorado), novos `js/api.js`, `js/teams.js`, `js/format.js`, `js/chart.js`.

**Dependência**: nenhuma — pode começar imediatamente. Todas as fases seguintes dependem desta.

**Status**: ✅ concluída — ver PR da Fase 0. Testado manualmente: temporada corrente (2026) e uma temporada encerrada com equipes extintas (2023, AlphaTauri/Alfa Romeo via cor-fallback), toolbar (Top 5/Top 10/Todos/Limpar), toggle de chip individual, e confirmação de que o cache em `localStorage` é escrito por endpoint.

---

## 4. Fase 1 — Identidade visual "vintage racing"

**Objetivo**: substituir o acento roxo/vermelho genérico por uma linguagem cromática e tipográfica inspirada em pôsteres de GP e liveries dos anos 60-70, mantendo o fundo escuro para legibilidade.

**Novos tokens** (substituindo os de `style.css:8-21`):

| Token | Hex | Uso |
|---|---|---|
| `--bg-void` | `#0A0C0A` | Fundo geral |
| `--bg-panel` | `#13160F` | Cards, tabela, painéis |
| `--paper` | `#EFE6D2` | Badges, "selos", texto sobre áreas escuras de destaque |
| `--racing-green` | `#0B3D2E` | Acento primário (substitui `--accent` roxo) |
| `--heritage-blue` | `#1C4E80` | Acento secundário — links, estados neutros |
| `--burnt-amber` | `#E2762A` | Destaque/CTA, líder do campeonato, hover |
| `--brass-gold` | `#C9A227` | 1º lugar, troféus, recordes |
| `--chrome` | `#B8BCC2` | 2º lugar, divisores |
| `--oxide-red` | `#8C2F2F` | Alertas, DNF, abandono (substitui `--red`) |

- Mapear todo uso direto de `var(--accent)`, `var(--green)`, `var(--red)` no CSS (eyebrow, live-dot, hover de botões, tooltip) pros novos tokens correspondentes.
- Preservar o padrão `--team-color`/`--c` por elemento — não muda, só as cores fixas ao redor dele.
- Trocar tipografia de título/hero por **Racing Sans One** (Google Fonts) em caixa alta; eyebrows/labels/badges por **Staatliches**; manter **JetBrains Mono** pros dados (ativar `font-variant-numeric: tabular-nums`); manter **Inter** no corpo.
- **Elemento de assinatura**: redesenhar a tabela de classificação como "prancheta de cronometragem vintage" — cabeçalho estilo papel/selo, roundel circular no número de posição (em vez do número solto atual), par de faixas (cor da equipe + linha fina `--paper`) reaproveitando o `--c` que já existe por linha.
- Textura sutil de grão/halftone (5-8% opacidade) atrás do header e dos divisores de seção; divisor fino "quadriculado" entre seções, substituindo o `border-top` simples atual — usar com moderação, só nesses dois lugares.
- Aplicar a paleta nova em todos os componentes existentes: pódio, chips do gráfico, tira de vencedores, linhas de construtores — a maioria é automática (já usa `--c`/`--team-color`), só os acentos fixos precisam de atenção manual.

**Arquivos**: `style.css` (tokens + componentes), `index.html` (link de fontes, favicon, theme-color), `script.js` (injeta `--c` no `<tr>` da tabela, pra alimentar o par de faixas).

**Dependência**: nenhuma técnica, mas fica mais fácil de revisar depois da Fase 0 (menos chance de conflito de merge).

**Status**: ✅ concluída — ver PR da Fase 1. Ajustes feitos durante a implementação:
- `--racing-green` (bem escuro) não tinha contraste suficiente pra uso direto em texto (eyebrow, badges, tooltip); esses papéis foram pro `--burnt-amber` (que o próprio brief já descrevia como "Destaque/CTA, líder do campeonato, hover"), deixando `--racing-green`/`--heritage-blue` como tons estruturais (glow de fundo, faixa padrão da tabela).
- O indicador "ao vivo" (bolinha verde pulsante) e a mensagem de erro usam variantes clareadas via `color-mix()` (`--live-green`, `--oxide-red-bright`) pra manter contraste de texto/visibilidade sem reintroduzir um verde/vermelho neon.
- Nome do piloto no card do pódio (`.p-card .name`) ficou em Inter (corpo), não em Racing Sans One — nomes próprios variam muito de tamanho e a fonte condensada de título prejudicava a legibilidade.
- Testado manualmente (temporada corrente, uma temporada antiga com grid de 21 pilotos, troca de temporada, fontes carregando via `document.fonts`, sem overflow horizontal novo introduzido em mobile).

---

## 5. Fase 2 — Páginas novas (P0)

**Objetivo**: usar os endpoints da Jolpica já mapeados no brief pra criar as páginas de maior impacto, todas consumindo os módulos da Fase 0.

| # | Página | Endpoint Jolpica | Notas |
|---|---|---|---|
| 1 | `calendario.html` | `/{season}.json` (já buscado hoje, só não é exibido por completo) | Próximas corridas, data/horário, circuito, contagem regressiva pra próxima etapa |
| 2 | `corrida.html?season=&round=` | `/{season}/{round}/results.json` | Grid → chegada, tempo/diferença, status (DNF etc.), volta mais rápida |
| 3 | `treino.html?season=&round=` | `/{season}/{round}/qualifying.json` | Q1/Q2/Q3 |
| 4 | `sprint.html?season=&round=` | `/{season}/{round}/sprint.json` | Resultado de sprint, separado da corrida principal |
| 5 | `piloto.html?id=` | dados já carregados em `loadData()` + `/qualifying` pra poles | Número, equipe, nacionalidade, pontos, vitórias, pódios, poles na temporada |
| 6 | `equipe.html?id=` | `constructorStandings` (já buscado) + `js/chart.js` da Fase 0 | Motor, base, pilotos, evolução de pontos da equipe ao longo da temporada |

- Ligar as páginas às existentes: nome do piloto na tabela → `piloto.html`; nome da equipe → `equipe.html`; card de "vencedores de cada etapa" → `corrida.html`; nav (Fase 0) ganha link pra `calendario.html`.
- Cards densos (grid vs. chegada, Q1/Q2/Q3) devem virar lista de cards empilhados abaixo do mesmo breakpoint mobile já usado na tabela atual (720px).

**Arquivos**: novos `calendario.html`, `corrida.html`, `treino.html`, `sprint.html`, `piloto.html`, `equipe.html` + seus scripts (`js/pages/*.js`, um por página, todos importando de `js/api.js`/`js/teams.js`/`js/chart.js`), mais links adicionados em `script.js`/`index.html` (tabela, tira de vencedores).

**Dependência**: Fase 0 completa (módulos compartilhados e nav). Fase 1 opcional mas recomendável antes, senão as páginas novas nascem no visual antigo e precisam ser re-visitadas depois.

---

## 6. Fase 3 — P1 (prioridade média)

- Ranking de paradas nos boxes (mais rápidas da corrida/temporada) — endpoint `/{season}/{round}/pitstops.json`.
- Comparador cabeça a cabeça entre dois pilotos (classificação, corrida, pontos, confrontos diretos).
- Ranking de voltas mais rápidas da temporada.
- Calculadora "o que falta pro título" — cálculo local a partir da diferença de pontos e corridas restantes, sem endpoint novo.
- Estatística de confiabilidade (abandonos por equipe/motor), usando o campo de status já presente em `/results`.
- Alternância de idioma PT/EN.
- Cartão de compartilhamento estilo "pôster vintage" do pódio/classificação atual, pra redes sociais.

**Dependência**: Fases 0-2 (reaproveita páginas e dados já buscados).

---

## 7. Fase 4 — P2 (nice-to-have)

- Mapa/traçado simplificado do circuito por corrida, em estilo selo vintage (coordenadas de `/circuits`).
- Linha do tempo histórica comparando evolução de pontos do líder atual com temporadas anteriores.
- Alternância de tema "garagem" (escuro) vs. "pôster" (claro/creme).
- Busca/filtro global por piloto, equipe ou circuito.
- Acessibilidade de cor: segundo indicador além da cor (textura/ícone/padrão) pras cores de equipe, pra leitores com daltonismo.
- Resumo textual automático por corrida (2-3 linhas: vencedor, ultrapassagens decisivas, safety car).

**Dependência**: Fases 0-2. Sem urgência — implementar conforme tempo disponível.

---

## 8. Checklist de acompanhamento

- [x] **Fase 0** — módulos `js/api.js`, `js/teams.js`, `js/format.js`, `js/chart.js`; `script.js` como ES module; cache em `localStorage` com TTL diferenciado por temporada. `js/layout.js`/nav ficou pra Fase 2, quando existir mais de uma página pra navegar entre (evita módulo sem consumidor nesta fase)
- [ ] **Fase 1** — tokens de cor e tipografia novos; tabela de classificação redesenhada como prancheta vintage; textura e divisor aplicados com moderação
- [ ] **Fase 2** — `calendario.html`, `corrida.html`, `treino.html`, `sprint.html`, `piloto.html`, `equipe.html`, com links a partir da home
- [ ] **Fase 3** — paradas, comparador, voltas rápidas, calculadora de título, confiabilidade, PT/EN, cartão de compartilhamento
- [ ] **Fase 4** — mapa de circuito, linha do tempo histórica, tema claro, busca global, acessibilidade de cor, resumo automático
