// Conecta la página con /api/data. Expone la misma forma que usa la página
// (claude.use("db") con doc().set/delete y collection().onSnapshot), así que
// el resto del código no cambia. Si la base de datos no está configurada,
// use("db") devuelve null y la página guarda solo en el dispositivo.
(function () {
  const POLL_MS = 5000;
  const cache = {};          // col -> {id: doc}
  const listeners = {};      // col -> [fn]
  const lastJson = {};       // col -> string, para avisar solo si cambia
  let ready = null;
  let pendingWrites = 0;

  function snapOf(col) {
    const obj = cache[col] || {};
    const docs = Object.keys(obj).map(id => ({ id, exists: true, data: () => obj[id], metadata: { fromCache: false, hasPendingWrites: false } }));
    return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
  }
  function emit(col) {
    const s = JSON.stringify(cache[col] || {});
    if (s === lastJson[col]) return;
    lastJson[col] = s;
    (listeners[col] || []).forEach(fn => { try { fn(snapOf(col)); } catch (e) { console.error(e); } });
  }

  async function pull() {
    const r = await fetch("/api/data", { cache: "no-store" });
    if (!r.ok) throw Object.assign(new Error("http " + r.status), { status: r.status });
    const data = await r.json();
    if (pendingWrites) return;   // no pisar un cambio que aún se está guardando
    Object.keys(data).forEach(col => { cache[col] = data[col] || {}; emit(col); });
  }

  async function send(method, col, id, data) {
    pendingWrites++;
    try {
      const r = await fetch("/api/data", {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ col, id, data })
      });
      if (!r.ok) throw { code: r.status === 400 ? "transform_error" : "unavailable", message: "HTTP " + r.status };
      cache[col] = Object.assign({}, cache[col]);
      if (method === "DELETE") delete cache[col][id]; else cache[col][id] = data;
      emit(col);
    } finally { pendingWrites--; }
  }

  const db = {
    doc(path) {
      const [col, id] = path.split("/");
      return {
        id, path,
        set: data => send("POST", col, id, data),
        delete: () => send("DELETE", col, id)
      };
    },
    collection(col) {
      return {
        path: col,
        onSnapshot(fn) {
          (listeners[col] = listeners[col] || []).push(fn);
          if (cache[col]) fn(snapOf(col));
          return () => { listeners[col] = (listeners[col] || []).filter(f => f !== fn); };
        }
      };
    }
  };

  function start() {
    if (!ready) {
      ready = pull().then(() => {
        setInterval(() => { if (!document.hidden) pull().catch(() => {}); }, POLL_MS);
        document.addEventListener("visibilitychange", () => { if (!document.hidden) pull().catch(() => {}); });
        window.addEventListener("focus", () => pull().catch(() => {}));
        return db;
      }).catch(() => null);
    }
    return ready;
  }

  window.claude = {
    use(name) {
      if (name === "db") return start();
      return Promise.resolve(null);
    }
  };
})();
