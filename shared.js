// Shared helpers for the guest and admin pages.
(function () {
  const cfg = window.STEAL_CONFIG || {};
  const configured = Boolean(cfg.preview || (cfg.supabaseUrl && cfg.supabaseAnonKey));

  // Preview mode (config preview: true): sample data kept in memory, no database.
  const mock = cfg.preview ? (function () {
    // Same 21 supplies as supabase/migrations/003_supplies_and_beer.sql
    const supplies = [
      ["ragga", "Silver rum", "Bacardi or any white rum"], ["pilok", "Vodka", "Tito's, Absolut, any brand"],
      ["richards", "Bourbon", "any brand you like"], ["bleuterd", "Prosecco", "two bottles, or champagne"],
      ["ecola", "Coke", "a 12-pack or two 2-liters"], ["sprunk", "Sprite", "a 12-pack or two 2-liters"],
      ["strawberries", "Frozen strawberries", "two bags, any brand"], ["pineapple", "Pineapple juice", "one big can"],
      ["coconut", "Cream of coconut", "Coco López, not coconut milk"], ["oj", "Orange juice", "Simply or Tropicana"],
      ["citrus", "Limes and lemons", "a bag of each"],
      ["gin", "Gin", "any London dry, like Tanqueray"],
      ["tequila", "Tequila", "any blanco"],
      ["triplesec", "Triple sec", "or Cointreau"],
      ["simple", "Simple syrup", "one bottle, or a jar of sugar water"],
      ["bitters", "Angostura bitters", "one small bottle"],
      ["oranges", "Oranges", "a few, for the peel"],
      ["bigice", "Big ice cubes", "a bag, or a large-cube tray"],
      ["midori", "Midori", "one bottle"],
      ["curacao", "Blue curaçao", "one bottle"],
      ["pomegranate", "Pomegranate juice", "one bottle, like POM"]
    ].map(([id, name, bring]) => ({ id, name, bring }));
    const now = () => new Date().toISOString();
    let n = 20;
    const claims = [["ragga", "Dani"], ["pilok", "Marcus"], ["richards", "Sam"], ["ecola", "Priya"], ["sprunk", "Jo"]]
      .map(([supply_id, guest_name], i) => ({ id: i + 1, supply_id, guest_name, created_at: now() }));
    const beer = [{ id: 8, guest_name: "Chris", note: "A 12-pack of Modelo", created_at: now() }, { id: 9, guest_name: "Taylor", note: "A few local IPAs", created_at: now() }];
    const write_ins = [{ id: 10, guest_name: "Jen", item: "Mezcal", created_at: now() }];
    const rsvps = [{ id: 11, guest_name: "Mike", party_size: 2, note: "Bringing the speaker", guests: ["Ana"], created_at: now() }];
    const PIN = "2237";
    // Same starter list as supabase/migrations/004_host_checklist.sql
    let hid = 100;
    const host = [
      ["Ice and cold", "Bagged ice, about 2 lb per guest", "Cooler for beer and mixers", "Ice bucket and scoop"],
      ["Glasses and serving", "Plastic champagne flutes", "Plastic cups, short and tall", "Straws", "Cocktail napkins", "Paper plates", "Sharpie for names on cups"],
      ["Bar tools", "Pitcher for the Liberty City batch", "Blender, tested", "Shaker and jigger", "Bottle opener and corkscrew", "Cutting board and knife for citrus", "Cocktail picks for garnish"],
      ["Beer pong", "Beer pong cups", "Ping pong balls"],
      ["Midnight", "Backup prosecco for the toast", "Countdown on the TV"],
      ["Neon and florals", "String lights", "Glow sticks", "Tropical flowers or leis"],
      ["Food and water", "Backup snacks", "Bottled water", "Sparkling water for non-drinkers"],
      ["Cleanup", "Trash bags", "Paper towels", "Extra toilet paper", "A spot for recycling", "Ride-home plan for anyone who needs one"]
    ].flatMap(([section, ...names]) => names.map((name) => ({ id: ++hid, name, section, done: false })));
    host[0].done = true; host[3].done = true;
    const who = (id) => claims.filter((x) => x.supply_id === id).map((x) => x.guest_name);
    const pull = (list, id) => { const i = list.findIndex((c) => c.id === id); if (i >= 0) list.splice(i, 1); };
    return {
      get_board: () => ({
        supplies: supplies.map((s) => Object.assign({}, s, { claimers: who(s.id) })),
        beer: beer.map((b) => ({ guest_name: b.guest_name, note: b.note })),
        write_ins: write_ins.map((w) => ({ guest_name: w.guest_name, item: w.item })),
        crew: { guests: rsvps.reduce((t, r) => t + r.party_size, 0), rsvps: rsvps.length, claimed: new Set(claims.map((c) => c.supply_id)).size, supplies: supplies.length } }),
      submit_rsvp_v2: (a) => { if (!(a.p_name || "").trim()) return { status: "invalid" };
        const id = ++n, token = "preview-" + id;
        rsvps.push({ id, token, guest_name: a.p_name.trim(), party_size: a.p_party_size, note: a.p_note || null, guests: a.p_guests || [], created_at: now() });
        return { status: "ok", id, token }; },
      update_rsvp: (a) => { const r = rsvps.find((x) => x.id === a.p_id && x.token === a.p_token); if (!r) return "not_found";
        Object.assign(r, { guest_name: a.p_name.trim(), party_size: a.p_party_size, note: a.p_note || null, guests: a.p_guests || [] }); return "ok"; },
      cancel_rsvp: (a) => { const i = rsvps.findIndex((x) => x.id === a.p_id && x.token === a.p_token); if (i < 0) return "not_found"; rsvps.splice(i, 1); return "ok"; },
      claim_supply: (a) => { const name = (a.p_name || "").trim(); if (!name || !supplies.some((s) => s.id === a.p_supply_id)) return "invalid";
        if (who(a.p_supply_id).some((n) => n.toLowerCase() === name.toLowerCase())) return "already";
        claims.push({ id: ++n, supply_id: a.p_supply_id, guest_name: name, created_at: now() }); return "ok"; },
      add_beer: (a) => { const name = (a.p_name || "").trim(); if (!name) return "invalid";
        beer.push({ id: ++n, guest_name: name, note: (a.p_note || "").trim() || null, created_at: now() }); return "ok"; },
      add_write_in: (a) => { if (!(a.p_name || "").trim() || !(a.p_item || "").trim()) return "invalid";
        write_ins.push({ id: ++n, guest_name: a.p_name.trim(), item: a.p_item.trim(), created_at: now() }); return "ok"; },
      admin_dashboard: (a) => a.p_pin !== PIN ? { error: "bad_pin" } : {
        rsvps: rsvps.slice(), write_ins: write_ins.slice(), beer: beer.slice(),
        supply_claims: claims.map((c) => { const s = supplies.find((x) => x.id === c.supply_id); return { id: c.id, supply: s.name, bring: s.bring, guest_name: c.guest_name, created_at: c.created_at }; }),
        open_supplies: supplies.filter((s) => !who(s.id).length).map((s) => s.name),
        supplies: supplies.map((s) => ({ id: s.id, name: s.name, bring: s.bring,
          claims: claims.filter((c) => c.supply_id === s.id).map((c) => ({ id: c.id, guest_name: c.guest_name, created_at: c.created_at })) })),
        host_items: host.slice() },
      admin_host_toggle: (a) => { if (a.p_pin !== PIN) return "bad_pin"; const h = host.find((x) => x.id === a.p_id); if (!h) return "invalid"; h.done = !h.done; return "ok"; },
      admin_host_add: (a) => { if (a.p_pin !== PIN) return "bad_pin"; const nm = (a.p_name || "").trim(); if (!nm || nm.length > 80) return "invalid";
        host.push({ id: ++n, name: nm, section: (a.p_section || "").trim() || "Extras", done: false }); return "ok"; },
      admin_update_rsvp: (a) => { if (a.p_pin !== PIN) return "bad_pin"; const r = rsvps.find((x) => x.id === a.p_id); if (!r) return "not_found";
        const g = (a.p_guests || []).map((x) => x.trim()).filter(Boolean); const nm = (a.p_name || "").trim();
        if (!nm || nm.length > 40 || !(a.p_party_size >= 1 && a.p_party_size <= 10) || g.length > a.p_party_size - 1) return "invalid";
        Object.assign(r, { guest_name: nm, party_size: a.p_party_size, note: (a.p_note || "").trim() || null, guests: g }); return "ok"; },
      admin_update_beer: (a) => { if (a.p_pin !== PIN) return "bad_pin"; const b = beer.find((x) => x.id === a.p_id); if (!b) return "not_found";
        const nm = (a.p_name || "").trim(); if (!nm) return "invalid"; b.guest_name = nm; b.note = (a.p_note || "").trim() || null; return "ok"; },
      admin_update_write_in: (a) => { if (a.p_pin !== PIN) return "bad_pin"; const w = write_ins.find((x) => x.id === a.p_id); if (!w) return "not_found";
        const nm = (a.p_name || "").trim(), it = (a.p_item || "").trim(); if (!nm || !it) return "invalid"; w.guest_name = nm; w.item = it; return "ok"; },
      admin_update_claim: (a) => { if (a.p_pin !== PIN) return "bad_pin"; const c = claims.find((x) => x.id === a.p_id); if (!c) return "not_found";
        const nm = (a.p_name || "").trim(); if (!nm) return "invalid";
        if (claims.some((x) => x !== c && x.supply_id === c.supply_id && x.guest_name.toLowerCase() === nm.toLowerCase())) return "already";
        c.guest_name = nm; return "ok"; },
      admin_host_delete: (a) => { if (a.p_pin !== PIN) return "bad_pin"; pull(host, a.p_id); return "ok"; },
      admin_release_supply: (a) => { if (a.p_pin !== PIN) return "bad_pin"; pull(claims, a.p_id); return "ok"; },
      admin_delete_beer: (a) => { if (a.p_pin !== PIN) return "bad_pin"; pull(beer, a.p_id); return "ok"; },
      admin_delete_write_in: (a) => { if (a.p_pin !== PIN) return "bad_pin"; pull(write_ins, a.p_id); return "ok"; },
      admin_delete_rsvp: (a) => { if (a.p_pin !== PIN) return "bad_pin"; pull(rsvps, a.p_id); return "ok"; }
    };
  })() : null;

  // Call a Postgres function through Supabase's REST API.
  async function rpc(fn, args) {
    if (mock) { await new Promise((r) => setTimeout(r, 150)); return JSON.parse(JSON.stringify(mock[fn](args || {}))); }
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
        const label = theme === "night" ? "Switch to day" : "Switch to night";
        // The sun/moon button keeps its pictures and only changes its label; a plain button shows the words.
        if (button.classList.contains("theme-btn")) { button.setAttribute("aria-label", label); button.title = label; }
        else button.textContent = label;
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

  function confirmAction(msg) { if (cfg.preview) return true; try { return window.confirm(msg); } catch (e) { return true; } }

  // The 8 cocktails, shared by the guest page and the crew dashboard.
  // real: what guests see under the name. prep: how Sean and Grace make it (crew dashboard only).
  const DRINKS = [
    { id: "vice", name: "Vice City", real: "Miami Vice", prep: "Blender. Half strawberry daiquiri, half piña colada.", kind: "blender", heat: 2, needs: ["ragga", "strawberries", "pineapple", "coconut", "citrus", "simple"] },
    { id: "liberty", name: "Liberty City Iced Tea", real: "Long Island Iced Tea", prep: "Big batch", kind: "batch", heat: 5, needs: ["pilok", "ragga", "gin", "tequila", "triplesec", "citrus", "simple", "ecola"] },
    { id: "kingpin", name: "The Kingpin", real: "Old Fashioned", prep: "Made ahead", kind: "rocks", heat: 4, needs: ["richards", "simple", "bitters", "oranges", "bigice"] },
    { id: "hotwire", name: "Hotwire", real: "Screwdriver", prep: "Pour and go", kind: "highball", heat: 2, needs: ["pilok", "oj"] },
    { id: "libre", name: "eCola Libre", real: "Cuba Libre", prep: "Pour and go", kind: "highball", heat: 2, needs: ["ragga", "ecola", "citrus"] },
    { id: "spike", name: "Sprunk Spike", real: "Vodka and Sprite", prep: "A splash of Midori turns it green", kind: "highball", heat: 2, needs: ["pilok", "sprunk", "midori"] },
    { id: "keys", name: "Leonida Keys", real: "Frozen Blue Hawaiian", prep: "Blender", kind: "blender", heat: 3, needs: ["ragga", "pineapple", "coconut", "curacao"] },
    { id: "mission", name: "Mission Passed", real: "Prosecco and pomegranate", prep: "Pour at 11:50 so every glass is full when the clock hits midnight", kind: "flute", heat: 1, needs: ["bleuterd", "pomegranate"] }
  ];

  window.Steal = { configured, rpc, headerArt, initTheme, el, confirmAction, preview: Boolean(cfg.preview), DRINKS };
})();
