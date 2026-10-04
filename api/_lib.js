const crypto = require("crypto");

// La app guarda en Redis (Upstash) o en Postgres (Neon), según la base de datos
// que se haya conectado al proyecto en Vercel. Vercel crea las variables al conectarla,
// a veces con un prefijo (p. ej. STORAGE_KV_REST_API_URL o STORAGE_DATABASE_URL).

function findEnv(re) {
  const k = Object.keys(process.env).sort((a, b) => a.length - b.length).find(n => re.test(n) && process.env[n]);
  return k ? process.env[k] : null;
}

function redisConfig() {
  const env = process.env;
  const direct = [["KV_REST_API_URL", "KV_REST_API_TOKEN"], ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]];
  for (const [u, t] of direct) if (env[u] && env[t]) return { url: env[u].replace(/\/$/, ""), token: env[t] };
  for (const k of Object.keys(env)) {
    const m = k.match(/^(.*)(KV_REST_API|REDIS_REST)_URL$/);
    if (!m) continue;
    const tok = env[m[1] + m[2] + "_TOKEN"];
    if (env[k] && tok) return { url: env[k].replace(/\/$/, ""), token: tok };
  }
  return null;
}

function postgresUrl() {
  const v = findEnv(/(^|_)DATABASE_URL$/) || findEnv(/(^|_)POSTGRES_URL$/);
  return v && /^postgres(ql)?:\/\//.test(v) ? v : null;
}

// Solo nombres (nunca valores) de variables que parecen de la base de datos, para diagnosticar.
const dbEnvNames = () => Object.keys(process.env).filter(k => /(^|_)(KV|REDIS|UPSTASH|DATABASE|POSTGRES|PG[A-Z]*|NEON)(_|$)/.test(k)).sort();

const hashPin = pin => crypto.createHash("sha256").update("panel-casa:" + pin).digest("hex");

// ---------- Redis ----------
async function redis(cfg, commands) {
  const r = await fetch(cfg.url + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + cfg.token, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error("redis " + r.status);
  const out = await r.json();
  for (const x of out) if (x.error) throw new Error(x.error);
  return out.map(x => x.result);
}

function redisStore(cfg) {
  const P = "panel:";
  return {
    kind: "redis",
    async ping() { await redis(cfg, [["PING"]]); },
    async getAll(cols) {
      const res = await redis(cfg, cols.map(c => ["HGETALL", P + c]));
      const data = {};
      cols.forEach((c, i) => {
        const flat = res[i] || [], docs = {};
        for (let k = 0; k < flat.length; k += 2) { try { docs[flat[k]] = JSON.parse(flat[k + 1]); } catch {} }
        data[c] = docs;
      });
      return data;
    },
    async set(col, id, json) { await redis(cfg, [["HSET", P + col, id, json]]); },
    async del(col, id) { await redis(cfg, [["HDEL", P + col, id]]); },
    async getPin() { return (await redis(cfg, [["HGET", P + "config", "pin"]]))[0] || null; },
    async setPinIfAbsent(h) { return (await redis(cfg, [["HSETNX", P + "config", "pin", h]]))[0] === 1; },
  };
}

// ---------- Postgres (Neon) ----------
let pgReady = null;
function pgStore(url) {
  const { neon } = require("@neondatabase/serverless");
  const sql = neon(url);
  const q = (text, params) => sql.query(text, params || []);
  const init = () => pgReady || (pgReady = (async () => {
    await q("CREATE TABLE IF NOT EXISTS panel_docs (col text NOT NULL, id text NOT NULL, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (col, id))");
    await q("CREATE TABLE IF NOT EXISTS panel_config (key text PRIMARY KEY, value text NOT NULL)");
  })().catch(e => { pgReady = null; throw e; }));
  return {
    kind: "postgres",
    async ping() { await init(); await q("SELECT 1"); },
    async getAll(cols) {
      await init();
      const rows = await q("SELECT col, id, data FROM panel_docs WHERE col = ANY($1)", [cols]);
      const data = {}; cols.forEach(c => data[c] = {});
      for (const r of rows) data[r.col][r.id] = r.data;
      return data;
    },
    async set(col, id, json) {
      await init();
      await q("INSERT INTO panel_docs (col, id, data) VALUES ($1, $2, $3::jsonb) ON CONFLICT (col, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()", [col, id, json]);
    },
    async del(col, id) { await init(); await q("DELETE FROM panel_docs WHERE col = $1 AND id = $2", [col, id]); },
    async getPin() { await init(); const r = await q("SELECT value FROM panel_config WHERE key = 'pin'"); return r[0] ? r[0].value : null; },
    async setPinIfAbsent(h) {
      await init();
      const r = await q("INSERT INTO panel_config (key, value) VALUES ('pin', $1) ON CONFLICT (key) DO NOTHING RETURNING key", [h]);
      return r.length === 1;
    },
  };
}

function getStore() {
  const r = redisConfig();
  if (r) return redisStore(r);
  const pg = postgresUrl();
  if (pg) return pgStore(pg);
  return null;
}

// true si la petición trae el código de la casa correcto
async function checkPin(store, req) {
  const pin = String(req.headers["x-casa-pin"] || "");
  if (!pin) return false;
  const stored = await store.getPin();
  return !!stored && stored === hashPin(pin);
}

module.exports = { getStore, checkPin, hashPin, dbEnvNames };
