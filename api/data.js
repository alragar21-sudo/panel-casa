// Datos compartidos del panel, en la base de datos conectada en Vercel (Redis o Postgres).
// GET  /api/data                      -> { checks: {id: doc}, gastos: {...}, compras: {...}, ideas: {...} }
// POST /api/data   {col, id, data}    -> guarda (reemplaza) un documento
// DELETE /api/data {col, id}          -> borra un documento
// Todas necesitan la cabecera X-Casa-Pin con el código de la casa.

const { getStore, checkPin } = require("./_lib");

const COLS = ["checks", "gastos", "compras", "ideas"];
const ID_RE = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const store = getStore();
  if (!store) return res.status(503).json({ error: "no_database" });

  try {
    if (!(await checkPin(store, req))) return res.status(401).json({ error: "bad_pin" });

    if (req.method === "GET") return res.status(200).json(await store.getAll(COLS));

    const { col, id, data } = readBody(req);
    if (!COLS.includes(col) || typeof id !== "string" || !ID_RE.test(id)) {
      return res.status(400).json({ error: "invalid_argument" });
    }

    if (req.method === "POST") {
      if (!data || typeof data !== "object" || Array.isArray(data)) return res.status(400).json({ error: "invalid_argument" });
      const json = JSON.stringify(data);
      if (json.length > 8000) return res.status(413).json({ error: "too_large" });
      await store.set(col, id, json);
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      await store.del(col, id);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "unavailable" });
  }
};
