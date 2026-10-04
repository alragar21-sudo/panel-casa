// Diagnóstico: qué base de datos ve la app y si responde (solo nombres de variables, nunca valores).
const { getStore, dbEnvNames } = require("./_lib");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const store = getStore();
  let reachable = false, error = null;
  if (store) { try { await store.ping(); reachable = true; } catch (e) { error = String(e && e.message || e).slice(0, 200); } }
  res.status(200).json({ database: store ? store.kind : false, reachable, error, vars: dbEnvNames() });
};
