// Shared helpers for the guest and admin pages.
(function () {
  const cfg = window.STEAL_CONFIG || {};
  const configured = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);

  // Call a Postgres function through Supabase's REST API.
  async function rpc(fn, args) {
    if (!configured) throw new Error("not_configured");
    const res = await fetch(cfg.supabaseUrl.replace(/\/$/, "") + "/rest/v1/rpc/" + fn, {
      method: "POST",
      // New sb_publishable_ keys go in the apikey header only; legacy anon JWTs also go in Authorization.
      headers: Object.assign(
        { apikey: cfg.supabaseAnonKey, "Content-Type": "application/json" },
        cfg.supabaseAnonKey.startsWith("sb_") ? {} : { Authorization: "Bearer " + cfg.supabaseAnonKey }
      ),
      body: JSON.stringify(args || {})
    });
    if (!res.ok) throw new Error("http_" + res.status);
    return res.json();
  }

  // Pricedown header art: file and size for each numbered header (see the word list).
  const K_ITEM = 20 / 480;
  const HEADERS = {
    12: ["12-pisswasser.svg", 2503, 331], 13: ["13-patriot-beer.svg", 2738, 427],
    14: ["14-logger-beer.svg", 2463, 427], 15: ["15-cerveza-barracho.svg", 3829, 504],
    16: ["16-benedict-light.svg", 2992, 504], 17: ["17-ecola.svg", 1115, 427],
    18: ["18-sprunk.svg", 1501, 427], 19: ["19-fizzazz.svg", 1561, 427],
    20: ["20-pisswasser-nein.svg", 3479, 427], 21: ["21-ragga-rum.svg", 2217, 427],
    22: ["22-pilok.svg", 999, 427], 23: ["23-richards-whiskey.svg", 3850, 504]
  };
  function headerArt(id, label, k) {
    const h = HEADERS[id];
    const el = document.createElement("span");
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", label);
    if (!h) { el.textContent = label; el.style.fontWeight = "600"; return el; }
    const scale = k || K_ITEM;
    el.className = "pd";
    const url = 'url("assets/headers/' + h[0] + '")';
    el.style.webkitMaskImage = url; el.style.maskImage = url;
    el.style.width = Math.round(h[1] * scale) + "px";
    el.style.height = Math.round(h[2] * scale) + "px";
    return el;
  }

  // Day/night toggle, remembered on this device when the browser allows it.
  function initTheme(button) {
    let theme = "night";
    try { theme = localStorage.getItem("steal-theme") || "night"; } catch (e) {}
    const apply = () => {
      document.documentElement.setAttribute("data-theme", theme);
      if (button) {
        button.textContent = theme === "night" ? "Switch to day" : "Switch to night";
        button.setAttribute("aria-pressed", theme === "golden" ? "true" : "false");
      }
    };
    apply();
    if (button) button.addEventListener("click", () => {
      theme = theme === "night" ? "golden" : "night";
      try { localStorage.setItem("steal-theme", theme); } catch (e) {}
      apply();
    });
  }

  function el(tag, attrs, text) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  window.Steal = { configured, rpc, headerArt, initTheme, el };
})();
