// Diagnóstico: si hay base de datos conectada y qué variables ve (solo nombres, nunca valores).
const { redisConfig, redis, dbEnvNames } = require("./_lib");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const cfg = redisConfig();
  let ok = false;
  if (cfg) { try { await redis(cfg, [["PING"]]); ok = true; } catch (e) {} }
  res.status(200).json({ database: !!cfg, reachable: ok, vars: dbEnvNames() });
};
