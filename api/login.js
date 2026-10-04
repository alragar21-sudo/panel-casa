// Código de la casa. El primero que entra lo crea; después se comprueba.
// GET  /api/login        -> { hasPin: bool }
// POST /api/login {pin}  -> { ok: true, created?: true } o 401
const { getStore, hashPin, dbEnvNames } = require("./_lib");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const store = getStore();
  if (!store) return res.status(503).json({ error: "no_database", vars: dbEnvNames() });
  try {
    if (req.method === "GET") return res.status(200).json({ hasPin: !!(await store.getPin()) });
    if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
    const body = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
    const pin = String(body.pin || "").trim();
    if (!/^\d{4,8}$/.test(pin)) return res.status(400).json({ error: "pin_format" });
    const h = hashPin(pin);
    if (await store.setPinIfAbsent(h)) return res.status(200).json({ ok: true, created: true });
    return (await store.getPin()) === h ? res.status(200).json({ ok: true }) : res.status(401).json({ error: "bad_pin" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "unavailable" });
  }
};
