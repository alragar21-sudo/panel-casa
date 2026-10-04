// Pantalla de entrada: cada una elige su nombre y pone el código de la casa.
// El nombre queda en window.CASA_USER y se guarda con todo lo que hace.
(function () {
  const PEOPLE = ["Paula", "Alba", "María", "Lolu"];
  const COLORS = ["var(--yellow)", "var(--pink)", "var(--lilac)", "var(--sage)"];
  let user = "", pin = "";
  try { user = localStorage.getItem("casa.user") || ""; pin = localStorage.getItem("casa.pin") || ""; } catch (e) {}
  window.CASA_USER = PEOPLE.includes(user) ? user : "";
  window.casaLogout = function () {
    try { localStorage.removeItem("casa.user"); localStorage.removeItem("casa.pin"); } catch (e) {}
    location.reload();
  };

  // Ya ha entrado antes: comprobar en segundo plano que el código sigue valiendo lo hace sync.js.
  if (window.CASA_USER && pin) return;

  document.documentElement.classList.add("locked");
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function boot() {
    let mode = "check";   // check | create | local
    try {
      const r = await fetch("/api/login", { cache: "no-store" });
      if (r.status === 503) mode = "local";
      else if (r.ok) mode = (await r.json()).hasPin ? "check" : "create";
    } catch (e) { mode = "local"; }

    let chosen = window.CASA_USER;
    const el = document.createElement("div");
    el.className = "login";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-labelledby", "loginTitle");
    el.innerHTML =
      '<div class="login-card">'
      + '<span class="eyebrow">Panel de casa</span>'
      + '<h1 id="loginTitle">¿Quién<span>eres?</span></h1>'
      + '<div class="login-people" role="group" aria-label="Elige tu nombre">'
      + PEOPLE.map((p, i) => '<button type="button" class="lp" data-p="' + esc(p) + '" style="background:' + COLORS[i] + '" aria-pressed="' + (chosen === p) + '">' + esc(p) + '</button>').join("")
      + '</div>'
      + (mode === "local" ? "" :
        '<div class="field"><label for="loginPin">' + (mode === "create" ? "Crea el código de la casa (4 a 8 números)" : "Código de la casa") + '</label>'
        + '<input class="inp" id="loginPin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="8" placeholder="Ej: 2468"></div>'
        + (mode === "create" ? '<p class="hint">Eres la primera en entrar. Pásales este código a las demás para que puedan entrar.</p>' : ''))
      + '<p class="login-err" id="loginErr" role="alert"></p>'
      + '<button type="button" class="go" id="loginGo">Entrar</button>'
      + '</div>';
    document.body.appendChild(el);

    const go = el.querySelector("#loginGo"), err = el.querySelector("#loginErr"), pinEl = el.querySelector("#loginPin");
    el.querySelector(".login-people").addEventListener("click", e => {
      const b = e.target.closest(".lp"); if (!b) return;
      chosen = b.dataset.p;
      el.querySelectorAll(".lp").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      err.textContent = "";
      if (pinEl) pinEl.focus();
    });
    async function submit() {
      if (!chosen) { err.textContent = "Elige tu nombre."; return; }
      let p = "-";   // sin base de datos no hay código; "-" marca que ya ha entrado
      if (mode !== "local") {
        p = pinEl.value.trim();
        if (!/^\d{4,8}$/.test(p)) { err.textContent = "El código tiene que tener de 4 a 8 números."; return; }
        go.disabled = true; go.textContent = "Entrando…";
        try {
          const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: p }) });
          if (r.status === 401) { err.textContent = "Ese no es el código de la casa."; go.disabled = false; go.textContent = "Entrar"; return; }
          if (!r.ok) throw new Error();
        } catch (e) { err.textContent = "No hay conexión. Inténtalo de nuevo."; go.disabled = false; go.textContent = "Entrar"; return; }
      }
      try {
        localStorage.setItem("casa.user", chosen);
        localStorage.setItem("casa.pin", p);
        if (!localStorage.getItem("limpieza.me")) localStorage.setItem("limpieza.me", chosen);
      } catch (e) {}
      location.reload();
    }
    go.addEventListener("click", submit);
    if (pinEl) pinEl.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
