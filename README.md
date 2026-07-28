# F1 · Campeonato de Pilotos

Site com a classificação da Fórmula 1 sempre atualizada — sem precisar editar nada manualmente. Os dados são buscados ao vivo direto de uma API pública, com identidade visual inspirada em pôsteres de GP vintage.

**🔗 Acesse:** https://tiagoamado.github.io/f1-2026-campeonato-pilotos/

## O que o site mostra

**Na home:**
- **Pódio** com o Top 3 do campeonato de pilotos, com botão pra baixar um cartão-pôster do pódio atual
- **Gráfico** da evolução de pontos corrida a corrida, com um chip por piloto pra escolher quem aparece
- **Tabela completa** de classificação (pontos, vitórias, diferença pro líder)
- **Calculadora de título** — quantas corridas faltam pro líder confirmar o campeonato matematicamente
- **Vencedores** de cada etapa já disputada e **Campeonato de Construtores**
- **Seletor de temporada**, no topo da página — dá pra ver qualquer ano desde 1950 até a temporada atual

**Páginas de detalhe** (a partir de links na home e no calendário):

| Página | O que mostra |
|---|---|
| `calendario.html?season=` | Calendário completo da temporada — corridas passadas e futuras, contagem regressiva pra próxima etapa |
| `corrida.html?season=&round=` | Resultado completo de uma corrida — grid, chegada, status, volta mais rápida |
| `treino.html?season=&round=` | Resultado do treino classificatório (Q1/Q2/Q3) |
| `sprint.html?season=&round=` | Resultado da corrida sprint, quando a etapa tem uma |
| `piloto.html?id=` | Perfil de um piloto na temporada — pontos, vitórias, pódios, poles, evolução de pontos |
| `equipe.html?id=` | Perfil de uma equipe — mesma ideia, mais a contribuição de cada piloto |
| `comparador.html?a=&b=&season=` | Comparação cabeça a cabeça entre dois pilotos, incluindo confrontos diretos |
| `paradas.html?season=` | Ranking das paradas nos boxes mais rápidas da temporada |
| `voltas-rapidas.html?season=` | Ranking da volta mais rápida de cada corrida |
| `confiabilidade.html?season=` | Abandonos e taxa de conclusão por equipe |

Todas as páginas têm alternância de idioma **PT/EN**, com a preferência salva no navegador.

## Como funciona

O site é só HTML + CSS + JavaScript puro, sem framework e sem etapa de build — cada página de detalhe é um `.html` estático próprio, parametrizado por querystring (`?season=&round=`, `?id=`), sem router de hash. A lógica compartilhada (busca de dados, cores de equipe, formatação, gráfico, cabeçalho das páginas, tradução) mora em módulos ES importados por todas as páginas.

Os dados vêm ao vivo da [Jolpica F1 API](https://github.com/jolpica/jolpica-f1) (um substituto comunitário e gratuito da antiga Ergast API). Cada resposta é cacheada em `localStorage`: temporadas encerradas ficam em cache por dias (o dado não muda mais), a temporada corrente por minutos. Nenhum resultado de corrida fica gravado no código.

Times ou pilotos que não estão nas listas fixas do código (cores de equipe, bandeiras) caem num "plano B" automático, então temporadas antigas com equipes que não existem mais (ex: AlphaTauri, Alfa Romeo) também funcionam.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.html`, `script.js` | Home — busca os dados da temporada e monta pódio, gráfico, tabela, vencedores, construtores |
| `*.html` (demais) | Uma página estática por tipo de conteúdo (calendário, corrida, treino, sprint, piloto, equipe, comparador, paradas, voltas rápidas, confiabilidade) |
| `js/pages/*.js` | Lógica de cada página de detalhe, um arquivo por página |
| `style.css` | Toda a aparência — cores, tipografia, layout, animações |
| `js/api.js` | Acesso à Jolpica F1 API (fetch com retry, pool de requisições, cache em `localStorage`) |
| `js/teams.js` | Cor/nome de cada equipe, bandeiras e siglas de circuito |
| `js/format.js` | Formatação de datas (PT/EN) |
| `js/chart.js` | Motor do gráfico SVG de evolução de pontos, reaproveitado por várias páginas |
| `js/layout.js` | Cabeçalho compartilhado das páginas de detalhe (link de volta + toggle de idioma) |
| `js/i18n.js` | Dicionário PT/EN e alternância de idioma, persistida em `localStorage` |
| `js/driverStats.js` | Estatísticas de um piloto numa temporada, reaproveitado por `piloto.html` e `comparador.html` |
| `js/resultsTable.js` | Tabela de resultado (grid → chegada, status, pontos), compartilhada entre `corrida.html` e `sprint.html` |
| `js/shareCard.js` | Gera o cartão-pôster do pódio (PNG via `<canvas>`) pra download |

Os scripts são carregados como módulos ES (`<script type="module">`) e importam uns dos outros — por isso, rodando localmente com `file://` direto no navegador o Chrome bloqueia os módulos por CORS; sirva a pasta com um servidor estático simples (ex. `python -m http.server`) pra testar.

## Rodando localmente

Não precisa instalar nada além de um servidor estático simples pra servir os arquivos (por causa dos módulos ES — veja acima).

```
git clone https://github.com/TiagoAmado/f1-2026-campeonato-pilotos.git
cd f1-2026-campeonato-pilotos
python -m http.server 8080
```

Depois é só abrir `http://localhost:8080`, ou subir a pasta pro GitHub Pages (ou qualquer outra hospedagem de arquivos estáticos).

## Créditos

- Dados: [Jolpica F1 API](https://api.jolpi.ca) (dados oficiais da FIA, servidos por um projeto comunitário e gratuito)
- Bandeiras: [flag-icons](https://github.com/lipis/flag-icons)
- Fontes: [Racing Sans One, Staatliches, Inter e JetBrains Mono](https://fonts.google.com/)

Projeto pessoal e não-oficial — sem qualquer vínculo com a FIA, Formula 1 ou as equipes citadas.
