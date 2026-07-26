/* =========================================================
   js/format.js — formatação de datas em pt-BR, compartilhada
   entre a home e as páginas novas.
   ========================================================= */

export const MONTHS_PT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

export function fmtDate(iso){
  const [y,m,d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_PT[m-1]}`;
}

export function fmtDateLong(iso){
  const [y,m,d] = iso.split("-").map(Number);
  const months = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  return `${d} de ${months[m-1]} de ${y}`;
}
