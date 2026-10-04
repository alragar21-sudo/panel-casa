// Datos compartidos del panel: un hash de Redis (Upstash) por colección.
// GET  /api/data                      -> { checks: {id: doc}, gastos: {...}, compras: {...}, ideas: {...} }
// POST /api/data   {col, id, data}    -> guarda (reemplaza) un documento
// DELETE /api/data {col, id}          -> borra un documento
// Todas necesitan la cabecera X-Casa-Pin con el código de la casa.

const { redisConfig, redis, checkPin } = require("./_lib");

const COLS = ["checks", "gastos", "compras", "ideas"];
const ID_RE = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
const PREFIX = "panel:";

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const cfg = redisConfig();
  if (!cfg) return res.status(503).json({ error: "no_database" });

  try {
    if (!(await checkPin(cfg, req))) return res.status(401).json({ error: "bad_pin" });

    if (req.method === "GET") {
      const results = await redis(cfg, COLS.map(c => ["HGETALL", PREFIX + c]));
      const data = {};
      COLS.forEach((c, i) => {
        const flat = results[i] || [];
        const docs = {};
        for (let k = 0; k < flat.length; k += 2) {
          try { docs[flat[k]] = JSON.parse(flat[k + 1]); } catch {}
        }
        data[c] = docs;
      });
      return res.status(200).json(data);
    }

    const { col, id, data } = readBody(req);
    if (!COLS.includes(col) || typeof id !== "string" || !ID_RE.test(id)) {
      return res.status(400).json({ error: "invalid_argument" });
    }

    if (req.method === "POST") {
      if (!data || typeof data !== "object" || Array.isArray(data)) return res.status(400).json({ error: "invalid_argument" });
      const json = JSON.stringify(data);
      if (json.length > 8000) return res.status(413).json({ error: "too_large" });
      await redis(cfg, [["HSET", PREFIX + col, id, json]]);
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      await redis(cfg, [["HDEL", PREFIX + col, id]]);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    return res.status(500).json({ error: "unavailable" });
  }
};
