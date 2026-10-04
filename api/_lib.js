const crypto = require("crypto");

// Upstash conectado desde Vercel crea variables como KV_REST_API_URL / KV_REST_API_TOKEN,
// pero con otro prefijo si se eligió uno al conectar (p. ej. STORAGE_KV_REST_API_URL).
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

// Solo nombres (nunca valores) de variables que parecen de la base de datos, para diagnosticar.
const dbEnvNames = () => Object.keys(process.env).filter(k => /KV|REDIS|UPSTASH/.test(k)).sort();

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

const hashPin = pin => crypto.createHash("sha256").update("panel-casa:" + pin).digest("hex");

// true si la petición trae el código de la casa correcto
async function checkPin(cfg, req) {
  const pin = String(req.headers["x-casa-pin"] || "");
  if (!pin) return false;
  const [stored] = await redis(cfg, [["HGET", "panel:config", "pin"]]);
  return !!stored && stored === hashPin(pin);
}

module.exports = { dbEnvNames, redisConfig, redis, hashPin, checkPin };
