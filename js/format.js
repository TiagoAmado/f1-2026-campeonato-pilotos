/* =========================================================
   js/format.js — formatação de datas em pt-BR/en, compartilhada
   entre a home e as páginas novas. Recebe o idioma como parâmetro
   (normalmente vindo de js/i18n.js getLang()) em vez de importar
   i18n.js diretamente, pra não criar dependência circular.
   ========================================================= */

const MONTHS_SHORT = {
  pt: ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"],
  en: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
};

const MONTHS_LONG = {
  pt: ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"],
  en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
};

export function fmtDate(iso, lang = "pt"){
  const [y, m, d] = iso.split("-").map(Number);
  const months = MONTHS_SHORT[lang] || MONTHS_SHORT.pt;
  return lang === "en" ? `${months[m-1]} ${d}` : `${d} ${months[m-1]}`;
}

export function fmtDateLong(iso, lang = "pt"){
  const [y, m, d] = iso.split("-").map(Number);
  const months = MONTHS_LONG[lang] || MONTHS_LONG.pt;
  return lang === "en" ? `${months[m-1]} ${d}, ${y}` : `${d} de ${months[m-1]} de ${y}`;
}
