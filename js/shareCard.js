/* =========================================================
   js/shareCard.js — gera um cartão (imagem PNG) estilo pôster
   vintage com o pódio atual, pra baixar e compartilhar em redes
   sociais. Lê as cores direto das custom properties do CSS, então
   segue a paleta da Fase 1 automaticamente se ela mudar.
   ========================================================= */

const W = 1080, H = 1080;

function cssVar(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* o canvas não espera fontes web carregarem sozinho — sem isso, o
   texto desenharia com a fonte de fallback do sistema */
async function ensureFontsLoaded(){
  await Promise.all([
    document.fonts.load('900 64px "Racing Sans One"'),
    document.fonts.load('32px "Staatliches"'),
    document.fonts.load('700 40px "JetBrains Mono"'),
    document.fonts.load('700 42px "Inter"'),
    document.fonts.load('28px "Inter"'),
  ]);
}

export async function generatePodiumCard({ season, drivers, teams }){
  await ensureFontsLoaded();

  const bgVoid = cssVar('--bg-void') || '#0A0C0A';
  const paper = cssVar('--paper') || '#EFE6D2';
  const text = cssVar('--text') || '#EDEAE0';
  const text2 = cssVar('--text-2') || '#9B9686';
  const text3 = cssVar('--text-3') || '#5C5A4C';
  const amber = cssVar('--burnt-amber') || '#E2762A';

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // fundo com leve gradiente radial, no mesmo espírito do fundo do site
  const bg = ctx.createRadialGradient(160, 0, 0, W / 2, H / 2, 900);
  bg.addColorStop(0, '#12241c');
  bg.addColorStop(1, bgVoid);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // faixa quadriculada no topo, ecoando o divisor de seção do site
  const check = 22;
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = paper;
  for (let x = 0; x < W; x += check * 2) ctx.fillRect(x, 0, check, 10);
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';

  ctx.fillStyle = amber;
  ctx.font = '32px Staatliches';
  ctx.fillText(`TEMPORADA ${season}`, W / 2, 110);

  ctx.fillStyle = text;
  ctx.font = '900 62px "Racing Sans One"';
  ctx.fillText('CLASSIFICAÇÃO', W / 2, 190);
  ctx.fillText('ATUALIZADA', W / 2, 258);

  const startY = 360;
  const rowH = 200;
  drivers.slice(0, 3).forEach((d, i) => {
    const y = startY + i * rowH;
    const team = teams[d.team];
    const last = d.pts[d.pts.length - 1];

    // faixa lateral de equipe, como o card do pódio no site
    ctx.fillStyle = team.color;
    ctx.fillRect(80, y, 6, rowH - 40);

    // roundel de posição, na cor da equipe (mesmo padrão da tabela)
    ctx.beginPath();
    ctx.arc(165, y + (rowH - 40) / 2, 48, 0, Math.PI * 2);
    ctx.fillStyle = team.color;
    ctx.fill();
    ctx.fillStyle = bgVoid;
    ctx.font = '700 38px "JetBrains Mono"';
    ctx.fillText(`P${i + 1}`, 165, y + (rowH - 40) / 2 + 13);

    ctx.textAlign = 'left';
    ctx.fillStyle = text;
    ctx.font = '700 44px Inter';
    ctx.fillText(d.name, 250, y + 60);

    ctx.fillStyle = text2;
    ctx.font = '28px Inter';
    ctx.fillText(team.name, 250, y + 102);

    ctx.textAlign = 'right';
    ctx.fillStyle = amber;
    ctx.font = '700 46px "JetBrains Mono"';
    ctx.fillText(`${last} PTS`, W - 80, y + 78);
    ctx.textAlign = 'left';
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = text3;
  ctx.font = '22px "JetBrains Mono"';
  ctx.fillText('DADOS OFICIAIS DA FIA VIA JOLPICA F1 API', W / 2, H - 50);

  return canvas;
}

export function downloadCanvas(canvas, filename){
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
