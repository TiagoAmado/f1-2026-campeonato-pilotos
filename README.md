# F1 · Campeonato de Pilotos

Site com a classificação da Fórmula 1 sempre atualizada — sem precisar editar nada manualmente. Os dados são buscados ao vivo direto de uma API pública toda vez que a página é aberta.

**🔗 Acesse:** https://tiagoamado.github.io/f1-2026-campeonato-pilotos/

## O que o site mostra

- **Pódio** com o Top 3 do campeonato de pilotos
- **Gráfico** da evolução de pontos corrida a corrida, com um chip por piloto pra escolher quem aparece
- **Tabela completa** de classificação (pontos, vitórias, diferença pro líder)
- **Vencedores** de cada etapa já disputada
- **Campeonato de Construtores**
- **Seletor de temporada**, no topo da página — dá pra ver qualquer ano desde 1950 até a temporada atual

## Como funciona

O site é só HTML + CSS + JavaScript puro, sem framework e sem etapa de build. Quando a página abre, o `script.js` busca os dados da temporada selecionada na [Jolpica F1 API](https://github.com/jolpica/jolpica-f1) (um substituto comunitário e gratuito da antiga Ergast API) e monta toda a página a partir dessa resposta — pódio, gráfico, tabela, vencedores e construtores. Nenhum resultado de corrida fica gravado no código.

Times ou pilotos que não estão nas listas fixas do código (cores de equipe, bandeiras) caem num "plano B" automático, então temporadas antigas com equipes que não existem mais (ex: AlphaTauri, Alfa Romeo) também funcionam.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Estrutura da página (títulos, seções, onde cada bloco vai) |
| `style.css` | Toda a aparência — cores, layout, fontes, animações |
| `script.js` | Toda a lógica — busca os dados, desenha o gráfico, monta as tabelas |

## Rodando localmente

Não precisa instalar nada. Basta baixar os três arquivos na mesma pasta e abrir o `index.html` no navegador.

```
git clone https://github.com/TiagoAmado/f1-2026-campeonato-pilotos.git
cd f1-2026-campeonato-pilotos
```

Depois é só abrir o `index.html`, ou subir a pasta pro GitHub Pages (ou qualquer outro hospedagem de arquivos estáticos).

## Créditos

- Dados: [Jolpica F1 API](https://api.jolpi.ca) (dados oficiais da FIA, servidos por um projeto comunitário e gratuito)
- Bandeiras: [flag-icons](https://github.com/lipis/flag-icons)
- Fontes: [Titillium Web, Inter e JetBrains Mono](https://fonts.google.com/)

Projeto pessoal e não-oficial — sem qualquer vínculo com a FIA, Formula 1 ou as equipes citadas.
