// Admin dashboard. The PIN is checked by the database, never here.
(function () {
  const SUPPLY_NAMES = { ragga: "Silver rum", pilok: "Vodka", richards: "Bourbon", bleuterd: "Prosecco", ecola: "Coke", sprunk: "Sprite",
    strawberries: "Frozen strawberries", pineapple: "Pineapple juice", coconut: "Cream of coconut", oj: "Orange juice", citrus: "Limes and lemons",
    gin: "Gin", tequila: "Tequila", triplesec: "Triple sec", simple: "Simple syrup", bitters: "Angostura bitters", oranges: "Oranges",
    bigice: "Big ice cubes", midori: "Midori", curacao: "Blue curaçao", pomegranate: "Pomegranate juice" };
  // Crew-only recipes. Each ingredient line names the supply it comes from, so it shows "covered" once a guest has it.
  // A null supply is something from the host run (ice, water). A line ending in "half" is a sub-heading.
  const RECIPES = {
    vice: { makes: "2 drinks", items: [
        ["Strawberry half", null], ["2 oz silver rum", "ragga"], ["1 cup frozen strawberries", "strawberries"], ["1 oz lime juice", "citrus"], ["3/4 oz simple syrup", "simple"], ["1 cup ice", null],
        ["Piña colada half", null], ["2 oz silver rum", "ragga"], ["2 oz pineapple juice", "pineapple"], ["1 1/2 oz cream of coconut", "coconut"], ["1 cup ice", null]],
      steps: ["Blend the strawberry half until smooth. Pour it into a pitcher and rinse the blender.",
        "Blend the piña colada half until smooth.",
        "Fill each glass halfway with piña colada, then pour the strawberry half down the side. One swirl with a straw so both colors show."] },
    liberty: { makes: "a pitcher, about 12 drinks", items: [
        ["6 oz vodka", "pilok"], ["6 oz silver rum", "ragga"], ["6 oz gin", "gin"], ["6 oz tequila", "tequila"], ["6 oz triple sec", "triplesec"],
        ["9 oz fresh lemon juice (about 6 lemons)", "citrus"], ["6 oz simple syrup", "simple"], ["Coke, to top each glass", "ecola"]],
      steps: ["Stir everything except the Coke together in the pitcher and chill it. This part can be done hours ahead.",
        "To serve, fill a tall cup with ice and pour in about 3 1/2 oz from the pitcher.",
        "Top with about 1 oz of Coke so it turns the color of iced tea. Add the Coke per glass, not to the pitcher, so it stays fizzy.",
        "Single drink: 1/2 oz of each of the five liquors, 3/4 oz lemon, 1/2 oz simple syrup, Coke on top."] },
    kingpin: { makes: "8 drinks, made ahead", items: [
        ["16 oz bourbon", "richards"], ["2 oz simple syrup", "simple"], ["16 dashes Angostura bitters", "bitters"], ["2 oz water", null],
        ["Orange peels", "oranges"], ["Big ice cubes", "bigice"]],
      steps: ["Stir the bourbon, simple syrup, bitters and water together in a bottle or jar. The water stands in for the melt you'd get from stirring with ice.",
        "Chill it in the fridge for at least an hour.",
        "To serve, pour about 2 1/2 oz over one big cube in a short glass.",
        "Cut a strip of orange peel, squeeze it over the glass so the oils spray on top, then drop it in.",
        "Single drink: 2 oz bourbon, 1/4 oz simple syrup, 2 dashes bitters, stirred with ice for 20 seconds."] },
    hotwire: { makes: "1 drink", items: [["2 oz vodka", "pilok"], ["4 oz orange juice", "oj"], ["Ice", null]],
      steps: ["Fill a glass with ice.", "Pour in the vodka, then the orange juice.", "Stir once and hand it off."] },
    libre: { makes: "1 drink", items: [["2 oz silver rum", "ragga"], ["4 oz Coke", "ecola"], ["1/2 lime", "citrus"], ["Ice", null]],
      steps: ["Squeeze the half lime into a glass and drop the shell in.", "Fill with ice and add the rum.", "Top with Coke and give it a quick stir."] },
    spike: { makes: "1 drink", items: [["2 oz vodka", "pilok"], ["4 oz Sprite", "sprunk"], ["1/2 oz Midori", "midori"], ["Ice", null]],
      steps: ["Fill a glass with ice and add the vodka.", "Top with Sprite.", "Pour the Midori in last. It sinks and turns the drink green; stir if you want it even."] },
    keys: { makes: "2 drinks", items: [["3 oz silver rum", "ragga"], ["2 oz blue curaçao", "curacao"], ["4 oz pineapple juice", "pineapple"], ["2 oz cream of coconut", "coconut"], ["2 cups ice", null]],
      steps: ["Put everything in the blender, ice last.", "Blend until smooth and slushy. Add a little more ice if it's thin.", "Pour into two glasses. It should be bright Leonida blue."] },
    mission: { makes: "1 flute", items: [["3/4 oz pomegranate juice", "pomegranate"], ["About 4 oz prosecco", "bleuterd"]],
      steps: ["Around 11:45, line up the flutes and add the pomegranate juice to each.",
        "At 11:50, top each one with cold prosecco, pouring slowly so it doesn't foam over.",
        "Hand them out so every glass is full when the countdown hits zero. One bottle fills about 6 flutes."] }
  };
  const S = window.Steal;
  S.initTheme(document.getElementById("theme-toggle"));
  const $ = (id) => document.getElementById(id);
  let pin = "";
  try { pin = sessionStorage.getItem("steal-pin") || ""; } catch (e) {}

  const MESSAGES = {
    bad_pin: "That PIN didn't match.",
    locked: "Too many wrong tries. Admin is locked for 15 minutes.",
    not_configured: "The database isn't connected yet. Fill in config.js."
  };
  const when = (iso) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  function setStatus(node, text, kind) { node.textContent = text || ""; node.className = "status" + (kind ? " " + kind : ""); }

  function showDash(on) {
    $("gate").hidden = on;
    $("dash").hidden = !on;
  }

  const ICON_CHECK = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"></path></svg>';
  let filter = "todo";
  let last = null;

  // One list row: a title, an optional muted line under it, and an optional quiet button on the right.
  function item(title, sub, action) {
    const li = S.el("li", { class: "adm-row" });
    const words = S.el("div", { class: "adm-row-words" });
    words.appendChild(S.el("span", { class: "adm-row-title" }, title));
    if (sub) words.appendChild(S.el("span", { class: "adm-row-sub" }, sub));
    li.appendChild(words);
    if (action) {
      const b = S.el("button", { type: "button", class: "btn btn-quiet btn-small" }, action.label);
      b.addEventListener("click", action.run);
      li.appendChild(b);
    }
    return li;
  }
  function emptyRow(list, text) { list.appendChild(S.el("li", { class: "adm-empty" }, text)); }

  async function act(fn, id, confirmText) {
    if (confirmText && !S.confirmAction(confirmText)) return;
    try {
      const r = await S.rpc(fn, { p_pin: pin, p_id: id });
      if (r !== "ok") { setStatus($("dash-status"), MESSAGES[r] || "That didn't work.", "err"); return; }
      await load();
    } catch (e) { setStatus($("dash-status"), "Couldn't reach the server.", "err"); }
  }

  function renderRun(d) {
    const host = d.host_items || [], sup = d.supplies || [];
    const hostDone = host.filter((h) => h.done).length;
    const supDone = sup.filter((s) => (s.claims || []).length).length;
    const total = host.length + sup.length, done = hostDone + supDone;
    $("run-count").textContent = done + " of " + total;
    $("run-fill").style.width = total ? "calc(" + (done / total * 100) + "% - 4px)" : "0";
    const frac = (node, a, b) => { node.textContent = a; node.appendChild(S.el("small", { class: "stat-of" }, "/" + b)); };
    frac($("stat-run"), hostDone, host.length);
    frac($("stat-claims"), supDone, sup.length);
    const todo = filter === "todo";

    // Your run: grouped by section; each row is a real checkbox.
    const hl = $("host-list"); hl.textContent = "";
    const sections = [];
    host.forEach((h) => { let g = sections.find((x) => x.name === h.section); if (!g) sections.push(g = { name: h.section, items: [] }); g.items.push(h); });
    let shown = 0;
    sections.forEach((g) => {
      const items = todo ? g.items.filter((h) => !h.done) : g.items;
      if (!items.length) return;
      const box = S.el("div", { class: "check-group" });
      box.appendChild(S.el("p", { class: "check-group-h" }, g.name + "  " + g.items.filter((h) => h.done).length + "/" + g.items.length));
      const ul = S.el("ul", { class: "check-list" });
      items.forEach((h) => {
        shown++;
        const li = S.el("li", { class: "check-row" + (h.done ? " is-done" : "") });
        const lab = S.el("label", { class: "check-hit" });
        const cb = S.el("input", { type: "checkbox", class: "check-input" });
        cb.checked = h.done;
        cb.addEventListener("change", () => { li.classList.toggle("is-done", cb.checked); setTimeout(() => act("admin_host_toggle", h.id), todo ? 450 : 0); });
        const mark = S.el("span", { class: "check-box", "aria-hidden": "true" }); mark.innerHTML = ICON_CHECK;
        lab.append(cb, mark, S.el("span", { class: "check-name" }, h.name));
        li.appendChild(lab);
        const del = S.el("button", { type: "button", class: "check-del", "aria-label": "Remove " + h.name }, "×");
        del.addEventListener("click", () => act("admin_host_delete", h.id, "Take " + h.name + " off your run?"));
        li.appendChild(del);
        ul.appendChild(li);
      });
      box.appendChild(ul); hl.appendChild(box);
    });
    if (!shown) hl.appendChild(S.el("p", { class: "adm-empty" }, host.length ? "Your run is done. Go get dressed." : "Nothing on your run yet."));

    // From the crew: checks itself when anyone claims it. Tap a name to release that claim.
    const cl = $("crew-checks"); cl.textContent = "";
    const rows = todo ? sup.filter((s) => !(s.claims || []).length) : sup;
    rows.forEach((s) => {
      const has = (s.claims || []).length;
      const li = S.el("li", { class: "check-row is-auto" + (has ? " is-done" : "") });
      const mark = S.el("span", { class: "check-box", "aria-hidden": "true" }); mark.innerHTML = ICON_CHECK;
      const words = S.el("div", { class: "check-words" });
      words.appendChild(S.el("span", { class: "check-name" }, s.name));
      if (has) {
        const who = S.el("span", { class: "check-who" });
        s.claims.forEach((c) => {
          const b = S.el("button", { type: "button", class: "who-pill", "aria-label": "Release " + c.guest_name + "'s claim on " + s.name }, c.guest_name);
          b.appendChild(S.el("span", { class: "who-x", "aria-hidden": "true" }, "×"));
          b.addEventListener("click", () => act("admin_release_supply", c.id, "Release " + c.guest_name + "'s claim on " + s.name + "?"));
          who.appendChild(b);
        });
        words.appendChild(who);
      } else {
        words.appendChild(S.el("span", { class: "adm-row-sub" }, "Nobody yet \u00b7 " + s.bring));
      }
      li.append(mark, words);
      cl.appendChild(li);
    });
    if (!rows.length) emptyRow(cl, "The crew has every supply covered.");
  }

  function render(d) {
    last = d;
    const rs = d.rsvps || [], wi = d.write_ins || [], br = d.beer || [];
    const guests = rs.reduce((n, r) => n + (r.party_size || 0), 0);
    $("stat-guests").textContent = guests;
    $("stat-rsvps").textContent = rs.length;
    renderRun(d);

    const tr = $("t-rsvps"); tr.textContent = "";
    $("guests-count").textContent = guests + (guests === 1 ? " person" : " people");
    if (!rs.length) emptyRow(tr, "No RSVPs yet.");
    rs.forEach((r) => {
      const extra = (r.guests || []).length ? "with " + r.guests.join(", ") : (r.party_size > 1 ? "+" + (r.party_size - 1) : "");
      const sub = [extra, r.note ? "“" + r.note + "”" : "", when(r.created_at)].filter(Boolean).join(" · ");
      tr.appendChild(item(r.guest_name + (r.party_size > 1 ? "  (" + r.party_size + ")" : ""), sub,
        { label: "Remove", run: () => act("admin_delete_rsvp", r.id, "Remove " + r.guest_name + "'s RSVP?") }));
    });

    const tb = $("t-beer"); tb.textContent = "";
    if (!br.length) emptyRow(tb, "Nobody's on beer yet.");
    br.forEach((b) => tb.appendChild(item(b.guest_name, [b.note, when(b.created_at)].filter(Boolean).join(" · "),
      { label: "Remove", run: () => act("admin_delete_beer", b.id, "Remove " + b.guest_name + " from the beer list?") })));

    const tw = $("t-writeins"); tw.textContent = "";
    if (!wi.length) emptyRow(tw, "Nothing extra yet.");
    wi.forEach((w) => tw.appendChild(item(w.item, w.guest_name + " · " + when(w.created_at),
      { label: "Remove", run: () => act("admin_delete_write_in", w.id, "Remove " + w.item + "?") })));

    // Drink prep: one tap opens a drink's real name, how to make it, and what's covered.
    const claimed = new Set((d.supplies || []).filter((s) => (s.claims || []).length).map((s) => s.id));
    const tp = $("t-prep"); const open = new Set([...tp.querySelectorAll("details[open]")].map((x) => x.dataset.id)); tp.textContent = "";
    (S.DRINKS || []).forEach((dr) => {
      const needs = dr.needs || [];
      const have = needs.filter((id) => claimed.has(id)).length;
      const det = S.el("details", { class: "prep" + (have === needs.length ? " is-ready" : ""), "data-id": dr.id });
      if (open.has(String(dr.id))) det.open = true;
      const sum = S.el("summary");
      const words = S.el("span", { class: "prep-words" });
      words.appendChild(S.el("span", { class: "prep-name" }, dr.name));
      words.appendChild(S.el("span", { class: "adm-row-sub" }, dr.real));
      sum.appendChild(words);
      sum.appendChild(S.el("span", { class: "prep-have" + (have === needs.length ? " is-ready" : "") }, have === needs.length ? "Ready" : have + "/" + needs.length));
      det.appendChild(sum);
      const body = S.el("div", { class: "prep-body" });
      if (dr.prep) body.appendChild(S.el("p", { class: "prep-how" }, dr.prep));
      const rec = RECIPES[dr.id];
      if (rec) {
        body.appendChild(S.el("p", { class: "recipe-h" }, "Makes " + rec.makes));
        const ing = S.el("ul", { class: "recipe-ing" });
        rec.items.forEach(([text, sid]) => {
          if (sid === null && /half$/.test(text)) { ing.appendChild(S.el("li", { class: "recipe-part" }, text)); return; }
          const li = S.el("li", { class: sid ? (claimed.has(sid) ? "is-have" : "is-open") : "is-host" }, text);
          if (sid) li.appendChild(S.el("span", { class: "recipe-src" }, claimed.has(sid) ? "covered" : "open"));
          ing.appendChild(li);
        });
        body.appendChild(ing);
        const ol = S.el("ol", { class: "recipe-steps" });
        rec.steps.forEach((t) => ol.appendChild(S.el("li", null, t)));
        body.appendChild(ol);
      }
      det.appendChild(body);
      tp.appendChild(det);
    });
  }

  function setFilter(f) {
    filter = f;
    $("seg-todo").setAttribute("aria-selected", f === "todo" ? "true" : "false");
    $("seg-all").setAttribute("aria-selected", f === "all" ? "true" : "false");
    if (last) renderRun(last);
  }
  $("seg-todo").addEventListener("click", () => setFilter("todo"));
  $("seg-all").addEventListener("click", () => setFilter("all"));
  $("host-add").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const v = $("host-new").value.trim();
    if (!v) return;
    try {
      const r = await S.rpc("admin_host_add", { p_pin: pin, p_name: v, p_section: "Extras" });
      if (r !== "ok") { setStatus($("dash-status"), MESSAGES[r] || "That didn't work.", "err"); return; }
      $("host-new").value = "";
      await load();
    } catch (e) { setStatus($("dash-status"), "Couldn't reach the server.", "err"); }
  });

  async function load() {
    try {
      const d = await S.rpc("admin_dashboard", { p_pin: pin });
      if (d && d.error) {
        try { sessionStorage.removeItem("steal-pin"); } catch (e) {}
        showDash(false);
        setStatus($("pin-status"), MESSAGES[d.error] || "That didn't work.", "err");
        return false;
      }
      try { sessionStorage.setItem("steal-pin", pin); } catch (e) {}
      showDash(true);
      setStatus($("dash-status"), "");
      render(d);
      return true;
    } catch (e) {
      setStatus($("pin-status"), MESSAGES[e.message] || "Couldn't reach the server.", "err");
      return false;
    }
  }

  $("pin-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    pin = $("pin").value.trim();
    if (!pin) return;
    setStatus($("pin-status"), "Checking...");
    const ok = await load();
    $("pin").value = "";
    if (ok) setStatus($("pin-status"), "");
  });
  $("refresh").addEventListener("click", load);
  $("lock").addEventListener("click", () => {
    pin = "";
    try { sessionStorage.removeItem("steal-pin"); } catch (e) {}
    showDash(false);
  });

  showDash(false);
  if (pin) load();
})();
