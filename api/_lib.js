const crypto = require("crypto");

function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

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

module.exports = { redisConfig, redis, hashPin, checkPin };
