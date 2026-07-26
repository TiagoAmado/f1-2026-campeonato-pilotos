/* =========================================================
   js/api.js — acesso à Jolpica F1 API, com retry e cache local.
   Usado pela home (script.js) e por todas as páginas futuras.
   ========================================================= */

export const API = "https://api.jolpi.ca/ergast/f1";

/* TTLs sugeridos pra fetchCached: temporada em andamento muda a cada
   corrida (TTL curto), temporada encerrada não muda mais (TTL longo). */
export const TTL_LIVE = 10 * 60 * 1000;
export const TTL_HISTORIC = 7 * 24 * 60 * 60 * 1000;

export async function fetchJSON(url, attempt = 0){
  const res = await fetch(url);
  if (res.status === 429 && attempt < 4){
    const retryAfter = Number(res.headers.get("retry-after"));
    const delay = retryAfter ? retryAfter * 1000 : 600 * (attempt + 1);
    await new Promise(r => setTimeout(r, delay));
    return fetchJSON(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  return res.json();
}

/* limita concorrência das chamadas por rodada pra não estourar rate limit da API */
export async function loadPool(items, worker, concurrency = 2){
  const results = new Array(items.length);
  let i = 0;
  async function run(){
    while (i < items.length){
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

const CACHE_PREFIX = "f1cache:";

function cacheGet(key, ttlMs){
  try{
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    if (Date.now() - t > ttlMs) return null;
    return v;
  } catch {
    return null; // localStorage indisponível (modo privado, quota cheia etc.)
  }
}

function cacheSet(key, value){
  try{
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
  } catch {
    // sem cache não é erro fatal — só busca de novo na próxima vez
  }
}

/* busca com cache em localStorage; ttlMs<=0 pula o cache */
export async function fetchCached(url, ttlMs){
  if (ttlMs > 0){
    const cached = cacheGet(url, ttlMs);
    if (cached) return cached;
  }
  const data = await fetchJSON(url);
  if (ttlMs > 0) cacheSet(url, data);
  return data;
}
