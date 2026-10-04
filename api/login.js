// Código de la casa. El primero que entra lo crea; después se comprueba.
// GET  /api/login        -> { hasPin: bool }
// POST /api/login {pin}  -> { ok: true, created?: true } o 401
const { redisConfig, redis, hashPin, dbEnvNames } = require("./_lib");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const cfg = redisConfig();
  if (!cfg) return res.status(503).json({ error: "no_database", vars: dbEnvNames() });
  try {
    if (req.method === "GET") {
      const [h] = await redis(cfg, [["HGET", "panel:config", "pin"]]);
      return res.status(200).json({ hasPin: !!h });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
    const body = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
    const pin = String(body.pin || "").trim();
    if (!/^\d{4,8}$/.test(pin)) return res.status(400).json({ error: "pin_format" });
    const h = hashPin(pin);
    const [created] = await redis(cfg, [["HSETNX", "panel:config", "pin", h]]);
    if (created === 1) return res.status(200).json({ ok: true, created: true });
    const [stored] = await redis(cfg, [["HGET", "panel:config", "pin"]]);
    return stored === h ? res.status(200).json({ ok: true }) : res.status(401).json({ error: "bad_pin" });
  } catch (e) {
    return res.status(500).json({ error: "unavailable" });
  }
};
