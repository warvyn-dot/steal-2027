// Guest app: Sean's call, tabs, RSVP (create/edit/cancel), drink claims, write-ins, party mode.
(function () {
  const S = window.Steal;
  S.initTheme(document.getElementById("theme-toggle"));
  const $ = (id) => document.getElementById(id);

  const LOST = "Lost the signal. Try again in a moment.";
  function setStatus(node, text, kind) {
    node.textContent = text || "";
    node.className = "status" + (kind ? " " + kind : "");
  }
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } },
    set(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  // ---------- Tabs: #home, #dress-code, #drinks, #location ----------
  const VIEWS = ["home", "dress-code", "drinks", "location"];
  function route() {
    const name = (location.hash || "#home").slice(1);
    const view = VIEWS.indexOf(name) >= 0 ? name : "home";
    VIEWS.forEach((v) => { $("view-" + v).hidden = v !== view; });
    document.querySelectorAll(".tabbar a").forEach((a) => {
      if (a.dataset.tab === view) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    // Each tab has its own top-left lettering: New mission, Side mission (Drinks), Suit up (Dress), Rendezvous (Location).
    const MT = { home: ["main", "New mission"], drinks: ["side", "Side mission"], "dress-code": ["suit", "Suit up"], location: ["rv", "Rendezvous"] };
    const mt = MT[view] || MT.home;
    document.documentElement.dataset.mission = mt[0];
    const tag = $("mission-tag");
    if (tag) tag.setAttribute("aria-label", mt[1]);
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();

  // ---------- Sean's call: the way in, once per phone ----------
  const LINES = [
    "Got a job for you. One night only.",
    "December 31st, 9 PM. My place. Wear something loud. Bring a drink from the list.",
    "You in?"
  ];
  const TYPING_MS = [800, 3200, 1100];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let declines = 0;
  function showCall() {
    $("call").hidden = false; $("call").classList.remove("leaving");
    $("call-ring").hidden = false; $("call-chat").hidden = true;
    $("call-status").textContent = "Incoming call"; $("call-sub").textContent = "mobile";
    $("bubbles").textContent = ""; $("call-go").hidden = true; $("call-go").classList.remove("typed");
    $("call-accept").focus();
  }
  async function acceptCall() {
    $("call-ring").hidden = true; $("call-chat").hidden = false;
    const list = $("bubbles");
    for (const line of LINES) {
      if (!calm) {
        const typing = S.el("li", { class: "typing", "aria-hidden": "true" });
        for (let i = 0; i < 3; i++) typing.appendChild(S.el("span", { class: "dot" }));
        list.appendChild(typing);
        // How long he "types" before each text lands: quick opener, a long pause for the details.
        await wait(TYPING_MS[LINES.indexOf(line)] || 1100);
        typing.remove();
      }
      list.appendChild(S.el("li", null, line));
      if (!calm) await wait(450);
    }
    // The guest's reply types itself out like a message being written, then starts to glow.
    const go = $("call-go"), reply = go.dataset.text || (go.dataset.text = go.textContent);
    go.setAttribute("aria-label", reply);
    if (calm) { go.textContent = reply; go.hidden = false; go.classList.add("typed"); go.focus(); return; }
    await wait(500);
    go.textContent = ""; go.classList.remove("typed"); go.hidden = false;
    const caret = S.el("span", { class: "type-caret", "aria-hidden": "true" });
    const typed = document.createTextNode("");
    go.append(typed, caret);
    for (const ch of reply) { typed.data += ch; await wait(ch === "." ? 260 : 45 + Math.random() * 45); }
    await wait(250);
    caret.remove();
    go.classList.add("typed");
    go.focus();
  }
  async function declineCall() {
    declines += 1;
    $("call-status").textContent = "Call declined";
    $("call-sub").textContent = declines > 1 ? "He's not going to stop." : "Sean doesn't take no for an answer.";
    $("call-accept").disabled = true; $("call-decline").disabled = true;
    await wait(1600);
    $("call-accept").disabled = false; $("call-decline").disabled = false;
    $("call-status").textContent = "Incoming call";
    $("call-sub").textContent = "calling back";
  }
  function endCall() {
    store.set("steal-call-seen", true);
    location.hash = "#home";
    if (calm) { $("call").hidden = true; return; }
    $("call").classList.add("leaving");
    setTimeout(() => { $("call").hidden = true; }, 420);
  }
  $("call-accept").addEventListener("click", acceptCall);
  $("call-decline").addEventListener("click", declineCall);
  $("call-go").addEventListener("click", endCall);
  $("replay-call").addEventListener("click", showCall);
  if (!store.get("steal-call-seen")) showCall();

  // ---------- Location extras ----------
  if (S.preview) { $("map-frame").remove(); $("map-fallback").hidden = false; }
  $("copy-address").addEventListener("click", async () => {
    const text = "1117 E Vandergriff Dr, Apt 1423, Carrollton, TX 75006";
    try { await navigator.clipboard.writeText(text); setStatus($("copy-status"), "Copied.", "ok"); }
    catch (e) { setStatus($("copy-status"), "Couldn't copy. Press and hold the address to copy it.", "err"); }
  });

  // ---------- Party mode: countdown on New Year's Eve, payoff after midnight ----------
  const LEAD_DEFAULT = $("hero-lead").innerHTML;
  function partyTick() {
    const now = new Date();
    const lead = $("hero-lead");
    const isEve = now.getMonth() === 11 && now.getDate() === 31;
    const isNewYearsDay = now.getMonth() === 0 && now.getDate() === 1;
    if (isEve) {
      const midnight = new Date(now.getFullYear() + 1, 0, 1);
      const s = Math.max(0, Math.floor((midnight - now) / 1000));
      const hh = String(Math.floor(s / 3600)).padStart(2, "0");
      const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      lead.innerHTML = "The job starts now.<br>Midnight in " + hh + ":" + mm + ":" + ss;
    } else if (isNewYearsDay) {
      lead.innerHTML = "Job done.<br>Welcome to 2027.";
    } else if (lead.innerHTML !== LEAD_DEFAULT) {
      lead.innerHTML = LEAD_DEFAULT;
    }
  }
  partyTick();
  setInterval(partyTick, 1000);

  // ---------- Names typed once are remembered ----------
  function rememberName(name) { try { localStorage.setItem("steal-name", name); } catch (e) {} }
  function savedName() { try { return localStorage.getItem("steal-name") || ""; } catch (e) { return ""; } }
  if (!$("wi-name").value) $("wi-name").value = savedName();

  // ---------- Drink board: cocktails built from claimable supplies ----------
  // Recipes live here; the database only knows the 11 supplies and who claimed each one.
  // A drink is "ready" once every supply it needs is claimed. Every ingredient is claimable; only ice is covered.
  const DRINKS = S.DRINKS;
  const ICONS = {
    batch: '<path d="M5 3h14v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"></path><path d="M5 8h14"></path><path d="M12 17v2.5h3"></path><path d="M7 21.5h10"></path>',
    rocks: '<path d="M5 7h14l-1.3 11.6a2 2 0 0 1-2 1.8H8.3a2 2 0 0 1-2-1.8z"></path><path d="M9.5 11.5l3-1.5 2.5 3-3 1.5z"></path>',
    highball: '<path d="M7 5h10l-1.2 15.2a1 1 0 0 1-1 .8H9.2a1 1 0 0 1-1-.8z"></path><path d="M7.6 11h8.8"></path><path d="M13 8l3-6"></path>',
    blender: '<path d="M7 3h10l-1.4 10H8.4z"></path><path d="M6.5 21h11v-3.5a3.5 3.5 0 0 0-3.5-3.5h-4a3.5 3.5 0 0 0-3.5 3.5z"></path><path d="M12 17.6v.01"></path>'
  };
  // Liquor gets its own gold pill style so guests can tell the bottles apart from mixers.
  const LIQUOR = ["ragga", "pilok", "richards", "bleuterd", "gin", "tequila", "triplesec", "midori", "curacao"];
  const BOTTLE = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" class="chip-bottle"><path d="M10 2h4v4l2 3v12a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3z"></path><path d="M8 13h8"></path></svg>';
  // Drinks with their own day/night art (assets/img/drinks/<slug>-day.jpg / -night.jpg).
  const DRINK_ART = { liberty: "liberty-city-iced-tea", libre: "ecola-libre", hotwire: "hotwire", spike: "sprunk-spike", keys: "leonida-keys", kingpin: "the-kingpin" };
  const sortBooze = (rows) => rows.slice().sort((a, b) => (b.booze - a.booze) || a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  const STAR = '<path d="M12 2.8l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17l-5.6 3 1.1-6.2L2.9 9.4l6.3-.9z"></path>';
  const CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" class="chip-check"><path d="M4 12.5l5 5L20 6.5"></path></svg>';
  const PLUS = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" class="chip-plus"><path d="M12 5v14M5 12h14"></path></svg>';

  let board = null;
  let boardKey = "";
  // What the guest is doing on the drinks tab, kept across re-renders so a refresh never loses it.
  const ui = { justReady: [], picked: [], openPerson: null };

  const supplyMap = () => { const m = {}; ((board && board.supplies) || []).forEach((x) => { m[x.id] = x; }); return m; };
  const isReady = (d, claimed) => d.needs.every((id) => !!claimed[id]);
  // Several guests can bring the same supply. claimedNow() maps a supply to a short "Sam, Dani" label;
  // a supply counts as covered once anyone has it.
  const whoLabel = (list) => list.length <= 2 ? list.join(", ") : list[0] + " +" + (list.length - 1);
  function claimedNow() { const c = {}; ((board && board.supplies) || []).forEach((x) => { if (x.claimers && x.claimers.length) c[x.id] = whoLabel(x.claimers); }); return c; }
  const short = stealShortName;
  const nameKey = (n) => short(n).toLowerCase();
  const meName = () => nameKey(savedName());
  // "Dani" and "Dani R" count as the same person; "Dani R" and "Dani M" don't.
  const sameName = (a, b) => {
    const ka = nameKey(a), kb = nameKey(b);
    if (!ka || !kb) return false;
    if (ka === kb) return true;
    const [fa, ia] = ka.split(" "), [fb, ib] = kb.split(" ");
    return fa === fb && (!ia || !ib);
  };
  const isMe = (n) => sameName(n, savedName());
  function iHave(id) {
    const x = ((board && board.supplies) || []).find((y) => y.id === id);
    if (!x || !x.claimers || !x.claimers.length) return false;
    const me = meName();
    return (!!me && x.claimers.some(isMe)) || (typeof mine !== "undefined" && mine.supplies.indexOf(id) >= 0);
  }

  function tagEl(tone, text, extra) { return S.el("span", { class: "tag tag-" + tone + (extra ? " " + extra : "") }, text); }

  function drinkCard(d, featured, mission) {
    const sup = supplyMap();
    const claimed = claimedNow();
    const left = d.needs.filter((id) => !claimed[id]).length;
    const ready = left === 0;
    const pop = ui.justReady.indexOf(d.id) >= 0 ? "pop" : "";
    // Only a "Ready" tag shows; drinks still waiting on ingredients get no tag.
    const status = () => ready ? tagEl("grow", "Ready", pop) : document.createTextNode("");
    const art = S.el(mission ? "section" : "article", { class: "card drink-card" + (featured ? " is-featured" : "") + (mission ? " is-mission" : ""), "aria-labelledby": "job-" + d.id });

    if (featured) {
      // House special: the photo fills the top; label, heat, the big sign name and the real drink sit over its lower left.
      const strip = S.el("div", { class: "drink-art feature-art" });
      strip.insertAdjacentHTML("beforeend", '<img class="art-night" src="assets/img/drinks/vice-city-night.jpg" alt="" decoding="async"><img class="art-day" src="assets/img/drinks/vice-city-day.jpg" alt="" decoding="async">');
      const words = S.el("div", { class: "feature-words look-body on-art" });
      words.appendChild(S.el("span", { class: "label" }, "House special"));
      words.appendChild(S.el("h3", { id: "job-" + d.id, class: "drink-name sign-name feature-name" }, d.name));
      const meta = S.el("div", { class: "drink-meta" });
      meta.appendChild(S.el("span", { class: "small muted" }, d.real));
      words.appendChild(meta);
      strip.appendChild(words);
      art.appendChild(strip);
      art.classList.add("has-art");
    }
    let missionWords = null;
    if (mission) {
      // Photo fills the top; heat and the big chrome "Mission Passed" lettering sit over its lower left.
      const strip = S.el("div", { class: "drink-art mission-photo" });
      strip.insertAdjacentHTML("beforeend", '<img class="art-night" src="assets/img/drinks/mission-passed-night.jpg" alt="" decoding="async" loading="lazy"><img class="art-day" src="assets/img/drinks/mission-passed-day.jpg" alt="" decoding="async" loading="lazy">');
      missionWords = S.el("div", { class: "look-body on-art mission-words" });
      strip.appendChild(missionWords);
      art.appendChild(strip);
      art.classList.add("has-art");
    }
    const body = S.el("div", { class: "drink-body" });
    if (featured) {
      // name and real drink are already on the photo
    } else {
      if (mission) {
        // Mission Passed uses Sean's chrome lettering (night/day PNGs) instead of the script name.
        const h = S.el("h2", { id: "job-" + d.id, class: "mission-art", role: "img", "aria-label": d.name });
        h.insertAdjacentHTML("beforeend", '<img class="art-night" src="assets/img/missions/mission-passed-night.png" alt=""><img class="art-day" src="assets/img/missions/mission-passed-day.png" alt="">');
        missionWords.appendChild(h);
      } else {
      const artSlug = DRINK_ART[d.id];
      const head = S.el("div", { class: "drink-head" + (artSlug ? " look-body on-art" : "") });
      if (!mission && !artSlug) head.insertAdjacentHTML("beforeend", '<div class="drink-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24">' + (ICONS[d.kind] || "") + "</svg></div>");
      const txt = S.el("div", { class: "drink-title" });
      const line = S.el("div", { class: "drink-title-row" });
      line.appendChild(S.el(mission ? "h2" : "h3", { id: "job-" + d.id, class: "drink-name" + (mission ? " mission-name" : "") }, d.name));
      txt.appendChild(line);
      txt.appendChild(S.el("span", { class: "small muted" }, d.real));
      head.appendChild(txt);
      if (artSlug) {
        // Photo fills the top of the card; the name and description sit over its lower left on a dark fade.
        const strip = S.el("div", { class: "drink-art" });
        strip.insertAdjacentHTML("beforeend", '<img class="art-night" src="assets/img/drinks/' + artSlug + '-night.jpg" alt="" loading="lazy" decoding="async"><img class="art-day" src="assets/img/drinks/' + artSlug + '-day.jpg" alt="" loading="lazy" decoding="async">');
        strip.appendChild(head);
        art.appendChild(strip);
        art.classList.add("has-art");
      } else body.appendChild(head);
      }
    }
    // Heat
    const heat = S.el("div", { class: "heat-row" });
    heat.appendChild(S.el("span", { class: "small muted" }, "Heat"));
    const stars = S.el("span", { class: "heat-stars", role: "img", "aria-label": "Heat " + d.heat + " of 5" });
    for (let k = 1; k <= 5; k++) stars.insertAdjacentHTML("beforeend", '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" class="' + (k <= d.heat ? "on" : "") + '">' + STAR + "</svg>");
    heat.appendChild(stars);
    // Heat sits just above the drink's name.
    const find = (sel) => art.querySelector(sel) || body.querySelector(sel);
    const titleBox = find(".drink-title");
    const featureName = find(".feature-words h3");
    const missionArt = find(".mission-art");
    if (art.querySelector(".drink-art")) heat.classList.add("heat-on-art");
    if (titleBox) titleBox.insertBefore(heat, titleBox.firstChild);
    else if (featureName) { heat.classList.add("heat-on-art"); featureName.parentNode.insertBefore(heat, featureName); }
    else if (missionArt) missionArt.parentNode.insertBefore(heat, missionArt);
    else body.insertBefore(heat, body.firstChild);
    // A ready drink gets its "Ready" tag on its own line at the top: above "House special" on Vice City, above Heat everywhere else.
    if (ready) {
      const top = S.el("div", { class: "ready-above" }); top.appendChild(status());
      const fw = art.querySelector(".feature-words");
      if (fw) fw.insertBefore(top, fw.firstChild);
      else heat.parentNode.insertBefore(top, heat);
    }
    // Supplies
    const ul = S.el("ul", { class: "supply-chips", "aria-label": "What " + d.name + " needs" });
    d.needs.forEach((id) => {
      const s = sup[id]; if (!s) return;
      const li = document.createElement("li");
      const liquor = LIQUOR.indexOf(id) >= 0;
      const lq = liquor ? " is-liquor" : "";
      if (claimed[id] && iHave(id)) {
        // Already on this guest's list: plain, not tappable.
        const c = S.el("span", { class: "chip chip-done is-mine" + lq });
        c.insertAdjacentHTML("beforeend", CHECK);
        c.appendChild(document.createTextNode(s.name));
        li.appendChild(c);
      } else {
        // Open, or covered by someone else: either way it can be picked (bringing a second bottle is fine).
        const on = ui.picked.indexOf(id) >= 0;
        const taken = !!claimed[id];
        const cls = "chip " + (taken && !on ? "chip-done chip-also" : "chip-add") + lq + (on ? " is-picked" : "");
        const label = (on ? "Picked: " + s.name : taken ? s.name + ", " + claimed[id] + " is bringing it. Tap to bring some too" : "Bring " + s.name) + (liquor ? " (liquor)" : "");
        const b = S.el("button", { type: "button", class: cls, "aria-pressed": on ? "true" : "false", "data-supply": id, "aria-label": label });
        b.insertAdjacentHTML("beforeend", on || taken ? CHECK : (liquor ? BOTTLE : PLUS));
        b.appendChild(document.createTextNode(s.name));
        if (taken && !on) b.insertAdjacentHTML("beforeend", '<span class="chip-also-plus" aria-hidden="true">+</span>');
        b.addEventListener("click", () => togglePick(id));
        li.appendChild(b);
      }
      ul.appendChild(li);
    });
    body.appendChild(ul);
    art.appendChild(body);
    return art;
  }

  function renderJobs() {
    const jobs = $("jobs");
    jobs.textContent = "";
    DRINKS.slice(0, 7).forEach((d, i) => jobs.appendChild(drinkCard(d, i === 0, false)));
    const slot = $("mission-slot");
    slot.textContent = "";
    // "At midnight" sits above the card as a section label, like "Snack run".
    slot.appendChild(S.el("h2", { class: "label", style: "margin: 0" }, "At midnight"));
    slot.appendChild(drinkCard(DRINKS[7], false, true));
    if (ui.justReady.length) setTimeout(() => { ui.justReady = []; }, 400);
  }

  // ---------- Pop-ups for bringing things: a supply, beer, or a write-in ----------
  // Each has a form step and a "you're on it" step. Typed names are kept if the pop-up is closed.
  function bringDialog(id, formId, doneId) {
    const d = $(id);
    closeOnBackdrop(d);
    d.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => d.close()));
    return {
      el: d,
      open(focusId) { $(formId).hidden = false; $(doneId).hidden = true; d.showModal(); const f = $(focusId); if (f) f.focus(); },
      done() { $(formId).hidden = true; $(doneId).hidden = false; const btn = $(doneId).querySelector("[data-close]"); if (btn) btn.focus(); }
    };
  }
  const supplyDlg = bringDialog("supply-dialog", "supply-form", "supply-done");

  // ---------- My list: everything this guest said they'd bring ----------
  // Remembered on this phone (what they claimed here) plus anything on the board under their saved name.
  const mine = (() => { try { return JSON.parse(localStorage.getItem("steal-mine")) || {}; } catch (e) { return {}; } })();
  ["supplies", "beer", "items"].forEach((k) => { if (!Array.isArray(mine[k])) mine[k] = []; });
  ["beer", "items"].forEach((k) => { mine[k] = mine[k].map((e) => { const i = String(e).indexOf("|"); return i < 0 ? e : stealShortName(e.slice(0, i)) + e.slice(i); }); });
  function saveMine() { try { localStorage.setItem("steal-mine", JSON.stringify(mine)); } catch (e) {} }
  function myStuff() {
    if (!board) return { supplies: [], beer: [], items: [] };
    const me = meName();
    const same = (n) => !!me && isMe(n);
    const supplies = (board.supplies || []).filter((x) => (x.claimers || []).length && ((x.claimers || []).some(same) || mine.supplies.indexOf(x.id) >= 0));
    const beer = (board.beer || []).filter((b) => same(b.guest_name) || mine.beer.indexOf(b.guest_name + "|" + (b.note || "")) >= 0);
    const items = (board.write_ins || []).filter((w) => same(w.guest_name) || mine.items.indexOf(w.guest_name + "|" + w.item) >= 0);
    return { supplies, beer, items };
  }
  function updateMyList() {
    const m = myStuff();
    const n = m.supplies.length + m.beer.length + m.items.length;
    $("mylist-open").hidden = n === 0;
    $("mylist-count").textContent = n;
    $("mylist-open").setAttribute("aria-label", "My list, " + n + (n === 1 ? " thing" : " things") + " to bring");
  }
  const myDlg = $("mylist-dialog");
  closeOnBackdrop(myDlg);
  myDlg.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => myDlg.close()));
  // Rows for one person's list: alcohol first (liquor and beer), then everything else; each group A to Z.
  function rowsFor(m) {
    const rows = [];
    m.supplies.forEach((x) => {
      const uses = DRINKS.filter((d) => d.needs.indexOf(x.id) >= 0).map((d) => d.name);
      rows.push({ title: x.name, sub: x.bring + " · for " + uses.join(", "), short: "for " + uses.join(", "), booze: LIQUOR.indexOf(x.id) >= 0 });
    });
    m.beer.forEach((b) => rows.push({ title: "Beer", sub: b.note || "", short: b.note || "", booze: true }));
    m.items.forEach((w) => rows.push({ title: w.item, sub: "Not on the list", short: "", booze: false }));
    return sortBooze(rows);
  }
  function stuffOf(name) {
    const k = name.trim().toLowerCase();
    const same = (n) => (n || "").trim().toLowerCase() === k;
    return {
      supplies: ((board && board.supplies) || []).filter((x) => (x.claimers || []).some(same)),
      beer: ((board && board.beer) || []).filter((b) => same(b.guest_name)),
      items: ((board && board.write_ins) || []).filter((w) => same(w.guest_name))
    };
  }
  function showList(title, who, rows, mineToo) {
    const ul = $("mylist-items"); ul.textContent = "";
    rows.forEach((r) => { const li = S.el("li", { class: r.booze ? "is-liquor" : "" }); li.appendChild(S.el("span", { class: "ui" }, r.title)); if (r.sub) li.appendChild(S.el("span", { class: "small muted" }, r.sub)); ul.appendChild(li); });
    $("mylist-title").textContent = title;
    $("mylist-who").textContent = who;
    $("mylist-swap").hidden = !mineToo;
    myDlg.showModal();
    myDlg.querySelector("[data-close]").focus();
  }
  $("mylist-open").addEventListener("click", () => {
    const m = myStuff();
    const count = m.supplies.length + m.beer.length + m.items.length;
    const mineName = short(savedName()) || (m.beer[0] && m.beer[0].guest_name) || (m.items[0] && m.items[0].guest_name) || "";
    showList("My list", (mineName ? mineName + ", you're" : "You're") + " bringing " + count + (count === 1 ? " thing." : " things."), rowsFor(m), true);
  });
  function showPerson(name) {
    const rows = rowsFor(stuffOf(name));
    const me = isMe(name);
    showList(name + (/s$/i.test(name) ? "' list" : "'s list"), name + " is bringing " + rows.length + (rows.length === 1 ? " thing." : " things."), rows, me);
  }
  // Crew names: tap to open their list; on a computer, hovering shows a quick preview.
  function renderCrew(names) {
    const ul = $("crew-names"); ul.textContent = "";
    names.forEach((n) => {
      const rows = rowsFor(stuffOf(n));
      const open = ui.openPerson === n;
      const li = S.el("li", { class: "crew-person" + (open ? " is-open" : "") });
      const b = S.el("button", { type: "button", class: "crew-name" + (isMe(n) ? " is-me" : ""), "aria-expanded": open ? "true" : "false", "aria-label": n + ", bringing " + rows.length + (rows.length === 1 ? " thing" : " things") });
      b.append(S.el("span", { class: "roster-badge crew-badge", "aria-hidden": "true" }, (n.trim()[0] || "?").toUpperCase()), document.createTextNode(n));
      // Tap (phones) or click toggles the same floating card that hover shows; no dialog.
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const was = li.classList.contains("is-open");
        closePeople();
        if (!was) { li.classList.add("is-open"); b.setAttribute("aria-expanded", "true"); ui.openPerson = n; placePop(li); }
      });
      li.appendChild(b);
      const pop = S.el("div", { class: "person-pop", "aria-hidden": "true" });
      pop.appendChild(S.el("p", { class: "person-pop-title" }, n + " is bringing"));
      const pl = S.el("ul");
      rows.forEach((r) => { const it = S.el("li", { class: r.booze ? "is-liquor" : "" }, r.title); pl.appendChild(it); });
      pop.appendChild(pl);
      li.appendChild(pop);
      li.addEventListener("mouseenter", () => { if (ui.openPerson && ui.openPerson !== n) closePeople(); placePop(li); });
      ul.appendChild(li);
      if (open) placePop(li);
    });
  }
  function closePeople() {
    ui.openPerson = null;
    document.querySelectorAll(".crew-person.is-open").forEach((x) => { x.classList.remove("is-open"); const b = x.querySelector("button[aria-expanded]"); if (b) b.setAttribute("aria-expanded", "false"); });
  }
  // Keep the floating card fully on screen and inside its card: measure it, then slide it left or right as needed.
  function placePop(li) {
    const pop = li.querySelector(".person-pop");
    pop.classList.remove("to-left");
    pop.style.left = "0px"; pop.style.right = "auto";
    const prev = pop.style.display; pop.style.display = "block"; pop.style.visibility = "hidden";
    const w = pop.offsetWidth;
    pop.style.display = prev; pop.style.visibility = "";
    const r = li.getBoundingClientRect();
    const box = (li.closest(".card") || document.documentElement).getBoundingClientRect();
    const minX = Math.max(box.left, 0) + 8, maxX = Math.min(box.right, document.documentElement.clientWidth) - 8;
    let x = r.left;
    if (x + w > maxX) x = maxX - w;
    if (x < minX) x = minX;
    pop.style.left = Math.round(x - r.left) + "px";
  }
  document.addEventListener("click", (e) => { if (!e.target.closest(".crew-person")) closePeople(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePeople(); });
  const beerDlg = bringDialog("beer-dialog", "beer-form", "beer-done");
  const wiDlg = bringDialog("wi-dialog", "writein-form", "wi-done");
  // Picking: tap pills to add them to a tray above the tab bar, then commit them all in one pop-up.
  // A supply used by several drinks is one pick, so it lights up on every card at once.
  function togglePick(id) {
    const i = ui.picked.indexOf(id);
    if (i >= 0) ui.picked.splice(i, 1); else ui.picked.push(id);
    const y = window.scrollY;
    renderJobs(); updateTray();
    window.scrollTo(0, y);
    const again = document.querySelector('#view-drinks .chip-add[data-supply="' + id + '"]');
    if (again && document.activeElement === document.body) again.focus({ preventScroll: true });
  }
  function updateTray() {
    ui.picked = ui.picked.filter((id) => !iHave(id));
    const n = ui.picked.length;
    const onDrinks = !$("view-drinks").hidden;
    $("pick-tray").hidden = !(n && onDrinks);
    document.documentElement.classList.toggle("has-tray", !!(n && onDrinks));
    $("pick-count").textContent = n + " picked";
    $("pick-commit").textContent = n === 1 ? "Bring it" : "Bring these " + n;
  }
  window.addEventListener("hashchange", updateTray);
  $("pick-discard").addEventListener("click", () => { ui.picked = []; renderJobs(); updateTray(); });
  $("pick-commit").addEventListener("click", () => {
    const sup = supplyMap();
    const list = $("supply-list"); list.textContent = "";
    sortBooze(ui.picked.filter((id) => sup[id]).map((id) => ({ title: sup[id].name, sub: sup[id].bring, booze: LIQUOR.indexOf(id) >= 0 }))).forEach((r) => {
      const li = S.el("li", { class: r.booze ? "is-liquor" : "" });
      li.appendChild(S.el("span", { class: "ui" }, r.title));
      li.appendChild(S.el("span", { class: "small muted" }, r.sub));
      list.appendChild(li);
    });
    $("supply-title").textContent = ui.picked.length === 1 ? "Your supply run" : "Your supply run (" + ui.picked.length + ")";
    $("supply-submit").textContent = ui.picked.length === 1 ? "I'll bring it" : "I'll bring these";
    if (!$("supply-name").value) $("supply-name").value = savedName();
    setStatus($("supply-status"), "");
    $("supply-submit").disabled = false;
    supplyDlg.open("supply-name");
  });
  $("supply-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const name = $("supply-name").value.trim();
    if (!name) { setStatus($("supply-status"), "Add your name so we know who's bringing it.", "err"); $("supply-name").focus(); return; }
    if (!ui.picked.length) { supplyDlg.el.close(); return; }
    $("supply-submit").disabled = true;
    const sup = supplyMap();
    const before = claimedNow();
    const after = Object.assign({}, before);
    const got = [], taken = [];
    try {
      for (const id of ui.picked.slice()) {
        const r = await S.rpc("claim_supply", { p_supply_id: id, p_name: name });
        if (r === "ok" || r === "already") { got.push(id); after[id] = name; if (mine.supplies.indexOf(id) < 0) mine.supplies.push(id); saveMine(); }
        else if (r === "full") taken.push(id);
        else throw new Error(r);
      }
    } catch (e) {
      if (!got.length) { setStatus($("supply-status"), LOST, "err"); $("supply-submit").disabled = false; return; }
    }
    rememberName(name);
    ui.picked = ui.picked.filter((id) => got.indexOf(id) < 0 && taken.indexOf(id) < 0);
    ui.justReady = DRINKS.filter((x) => !isReady(x, before) && isReady(x, after)).map((x) => x.id);
    const names = (ids) => ids.map((id) => sup[id].name).join(", ");
    let msg = got.length ? "Thanks, " + short(name) + ". You're bringing " + names(got) + "." : "";
    if (ui.justReady.length) msg += " That made " + ui.justReady.map((id) => DRINKS.find((x) => x.id === id).name).join(" and ") + " ready to pour.";
    if (taken.length) msg += " " + names(taken) + (taken.length === 1 ? " is" : " are") + " already maxed out, so we left " + (taken.length === 1 ? "it" : "them") + " off.";
    $("supply-done-text").textContent = msg.trim();
    supplyDlg.done();
    await load(true);
    updateTray();
  });

  // Public guest list: "First L" names from the RSVPs, each with what they've claimed (matched on "First L").
  const guestsDlg = $("guests-dialog");
  guestsDlg.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => guestsDlg.close()));
  guestsDlg.addEventListener("click", (e) => { if (e.target === guestsDlg) guestsDlg.close(); });
  const first = (n) => nameKey(n);
  function bringingByFirst() {
    const m = {};
    const add = (n, item) => { const k = first(n); if (!k) return; (m[k] = m[k] || []).indexOf(item) < 0 && m[k].push(item); };
    ((board && board.supplies) || []).forEach((x) => (x.claimers || []).forEach((n) => add(n, x.name)));
    ((board && board.beer) || []).forEach((b) => add(b.guest_name, b.note ? "Beer: " + b.note : "Beer"));
    ((board && board.write_ins) || []).forEach((w) => add(w.guest_name, w.item));
    return m;
  }
  async function openGuests() {
    const ul = $("guest-list"); ul.textContent = "";
    $("guests-count").textContent = "Loading the crew...";
    $("guest-pager").hidden = true;
    if (!guestsDlg.open) guestsDlg.showModal();
    let list;
    try { list = await S.rpc("get_guest_list", {}); } catch (e) { $("guests-count").textContent = "Couldn't load the guest list. Try again in a minute."; return; }
    if (!Array.isArray(list)) { $("guests-count").textContent = "Couldn't load the guest list. Try again in a minute."; return; }
    const total = list.reduce((n, r) => n + (r.party || 1), 0);
    $("guests-count").textContent = list.length ? total + (total === 1 ? " person is" : " people are") + " in so far." : "Nobody's RSVP'd yet. Be the first.";
    guestRows = list; guestPage = 0;
    renderGuestPage();
  }
  // Five guests per page, with arrows instead of a scrolling list.
  const PER_PAGE = 5;
  let guestRows = [], guestPage = 0;
  function renderGuestPage() {
    const ul = $("guest-list"); ul.textContent = "";
    const pages = Math.max(1, Math.ceil(guestRows.length / PER_PAGE));
    guestPage = Math.min(Math.max(guestPage, 0), pages - 1);
    const bring = bringingByFirst();
    guestRows.slice(guestPage * PER_PAGE, guestPage * PER_PAGE + PER_PAGE).forEach((r) => {
      const li = S.el("li", { class: "roster-row" + (isMe(r.name) ? " is-me" : "") });
      li.appendChild(S.el("span", { class: "roster-badge", "aria-hidden": "true" }, (r.name[0] || "?").toUpperCase()));
      const t = S.el("span", { class: "roster-text" });
      const extra = (r.guests || []).length ? " with " + r.guests.map(short).join(", ") : (r.party > 1 ? " +" + (r.party - 1) : "");
      t.appendChild(S.el("span", { class: "ui" }, short(r.name) + extra));
      const items = []; Object.keys(bring).forEach((k) => { if (sameName(k, r.name)) bring[k].forEach((it) => items.indexOf(it) < 0 && items.push(it)); });
      t.appendChild(S.el("span", { class: "small " + (items.length ? "guest-brings" : "muted") }, items.length ? items.join(", ") : "Nothing claimed yet"));
      li.appendChild(t);
      ul.appendChild(li);
    });
    $("guest-pager").hidden = pages < 2;
    $("guest-page").textContent = "Page " + (guestPage + 1) + " of " + pages;
    $("guest-prev").disabled = guestPage === 0;
    $("guest-next").disabled = guestPage >= pages - 1;
  }
  $("guest-prev").addEventListener("click", () => { guestPage--; renderGuestPage(); });
  $("guest-next").addEventListener("click", () => { guestPage++; renderGuestPage(); });
  document.querySelectorAll("[data-open-guests]").forEach((b) => b.addEventListener("click", openGuests));

  // Heist meter: one slot per drink that fills as its ingredients get claimed and glows when it's ready,
  // plus a nudge toward the drink that's closest, naming what it still needs.
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  function renderMeter(claimed) {
    const sup = supplyMap();
    const stats = DRINKS.map((d) => { const have = d.needs.filter((id) => claimed[id]).length; return { d, have, need: d.needs.length, ready: have === d.needs.length }; });
    const readyCount = stats.filter((x) => x.ready).length;
    $("ready-num").textContent = readyCount;
    $("ready-total").textContent = DRINKS.length;
    const slots = $("ready-slots"); slots.textContent = "";
    slots.setAttribute("aria-label", readyCount + " of " + DRINKS.length + " drinks ready to pour");
    // Each slot works like a crew name: hover (or tap on phones) shows a floating card with what that drink still needs.
    stats.forEach((x) => {
      const key = "drink:" + x.d.id, open = ui.openPerson === key;
      const li = S.el("li", { class: "crew-person heist-cell" + (open ? " is-open" : "") });
      const label = x.d.name + (x.ready ? ", ready to pour" : ", " + x.have + " of " + x.need + " ingredients covered");
      const b = S.el("button", { type: "button", class: "heist-slot" + (x.ready ? " is-ready" : ""), "aria-expanded": open ? "true" : "false", "aria-label": label });
      const fill = S.el("span", { class: "heist-fill" });
      fill.style.height = Math.round(x.have / x.need * 100) + "%";
      b.appendChild(fill);
      // Hover (or tap) shows the card; the drink's name in the card is the link that jumps to it.
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const was = li.classList.contains("is-open");
        closePeople();
        if (!was) { li.classList.add("is-open"); b.setAttribute("aria-expanded", "true"); ui.openPerson = key; placePop(li); }
      });
      li.addEventListener("mouseenter", () => { if (ui.openPerson && ui.openPerson !== key) closePeople(); placePop(li); });
      li.appendChild(b);
      const pop = S.el("div", { class: "person-pop", "aria-hidden": "true" });
      const nameBtn = S.el("button", { type: "button", class: "pop-name" });
      nameBtn.append(S.el("span", { class: "pop-name-t" }, x.d.name), S.el("span", { class: "pop-name-arrow", "aria-hidden": "true" }, "\u2192"));
      nameBtn.setAttribute("aria-label", "Go to " + x.d.name);
      nameBtn.addEventListener("click", (e) => { e.stopPropagation(); closePeople(); goToDrink(x.d.id); });
      pop.appendChild(nameBtn);
      pop.appendChild(S.el("p", { class: "pop-status" + (x.ready ? " is-ready" : "") }, x.ready ? "Ready to pour" : x.have + " of " + x.need + " covered"));
      // Still needed first (what someone can grab), then what's already covered and by whom.
      const nm = (id) => (sup[id] && sup[id].name) || id;
      const needs = x.d.needs.filter((id) => !claimed[id]), got = x.d.needs.filter((id) => claimed[id]);
      if (needs.length) {
        pop.appendChild(S.el("p", { class: "pop-group is-need" }, "Still needs"));
        const ul = S.el("ul", { class: "pop-list" });
        needs.forEach((id) => { const it = S.el("li", { class: "pop-need" + (LIQUOR.indexOf(id) >= 0 ? " is-liquor" : "") }); it.append(S.el("span", { class: "pop-mark", "aria-hidden": "true" }), document.createTextNode(nm(id))); ul.appendChild(it); });
        pop.appendChild(ul);
      }
      if (got.length) {
        pop.appendChild(S.el("p", { class: "pop-group is-got" }, "Covered"));
        const ul = S.el("ul", { class: "pop-list" });
        got.forEach((id) => { const it = S.el("li", { class: "pop-got" }); it.append(S.el("span", { class: "pop-mark", "aria-hidden": "true" }), document.createTextNode(nm(id)), S.el("span", { class: "pop-who" }, claimed[id])); ul.appendChild(it); });
        pop.appendChild(ul);
      }
      li.appendChild(pop);
      slots.appendChild(li);
      if (open) placePop(li);
    });
    const next = $("ready-next");
    const open = stats.filter((x) => !x.ready).sort((a, b) => (b.have / b.need) - (a.have / a.need) || (a.need - a.have) - (b.need - b.have));
    next.hidden = false;
    if (!open.length) { next.disabled = true; next.textContent = "Every drink is covered. The job is on."; next.dataset.target = ""; return; }
    const t = open[0];
    const missing = t.d.needs.filter((id) => !claimed[id]).map((id) => (sup[id] && sup[id].name) || id);
    const list = missing.length > 2 ? missing.slice(0, 2).join(", ") + " and " + (missing.length - 2) + " more" : missing.join(" and ");
    next.disabled = false;
    next.dataset.target = "job-" + t.d.id;
    next.textContent = "";
    next.append(S.el("span", { class: "heist-next-k" }, t.have ? "Closest" : "Start with"), S.el("span", { class: "heist-next-t" }, t.d.name + " needs " + list.toLowerCase()));
  }
  // Bring a drink card to the middle of the visible area (between the top of the screen and the tab bar).
  // Photos above it can finish loading mid-scroll and push it down, so it re-checks and nudges until it sits centered.
  function goToDrink(drinkId) {
    const h = document.getElementById("job-" + drinkId);
    if (!h) return;
    const card = h.closest(".drink-card") || h;
    card.querySelectorAll("img[loading=lazy]").forEach((im) => { im.loading = "eager"; });
    const targetY = () => {
      const bar = document.querySelector(".tabbar");
      const bottom = bar ? bar.getBoundingClientRect().top : window.innerHeight;
      const r = card.getBoundingClientRect();
      const room = bottom;
      const offset = r.height < room - 24 ? (room - r.height) / 2 : 12;
      return Math.max(0, Math.round(window.scrollY + r.top - offset));
    };
    // The last drink sits near the bottom of the page; add just enough room under it so it can still reach the middle.
    let room = document.getElementById("scroll-room");
    if (!room) { room = S.el("div", { id: "scroll-room", "aria-hidden": "true" }); $("view-drinks").appendChild(room); }
    room.style.height = "0px";
    const maxY = document.documentElement.scrollHeight - window.innerHeight;
    const want0 = targetY();
    if (want0 > maxY) room.style.height = (want0 - maxY) + "px";
    window.scrollTo({ top: targetY(), behavior: calm ? "auto" : "smooth" });
    // Nudge a couple of times while photos settle, but stop the moment the guest scrolls or touches the page.
    let tries = 0, stopped = false;
    const stop = () => { stopped = true; ["wheel", "touchstart", "pointerdown", "keydown"].forEach((t) => window.removeEventListener(t, stop, true)); };
    ["wheel", "touchstart", "pointerdown", "keydown"].forEach((t) => window.addEventListener(t, stop, { capture: true, passive: true }));
    const settle = () => {
      if (stopped) return;
      const want = targetY();
      if (Math.abs(window.scrollY - want) > 6) window.scrollTo({ top: want, behavior: "auto" });
      if (++tries < 3) setTimeout(settle, 400); else stop();
    };
    setTimeout(settle, calm ? 300 : 700);
    card.classList.remove("flash"); void card.offsetWidth; card.classList.add("flash");
  }
  window.addEventListener("hashchange", () => { const r = document.getElementById("scroll-room"); if (r) r.remove(); });
  $("ready-next").addEventListener("click", () => {
    const id = $("ready-next").dataset.target;
    if (id) goToDrink(id.replace(/^job-/, ""));
  });


  function render() {
    const claimed = claimedNow();
    const beer = board.beer || [];
    const w = board.write_ins || [];
    // Crew card: everyone bringing anything (supplies, beer or write-ins), first-come order.
    const names = [];
    const add = (n) => { if (n && names.indexOf(n) < 0) names.push(n); };
    (board.supplies || []).forEach((x) => (x.claimers || []).forEach(add));
    beer.forEach((b) => add(b.guest_name));
    w.forEach((x) => add(x.guest_name));
    $("crew-line").textContent = names.length === 0 ? "Nobody's on the crew yet" : names.length === 1 ? "1 on the crew" : names.length + " on the crew";
    renderCrew(names);
    renderMeter(claimed);

    renderJobs();

    // Rosters inside the beer and snacks cards: an initial badge, the name, and what they're bringing.
    const me = meName();
    const rosterRow = (name, title, sub) => {
      const li = S.el("li", { class: "roster-row" + (isMe(name) ? " is-me" : "") });
      li.appendChild(S.el("span", { class: "roster-badge", "aria-hidden": "true" }, (name.trim()[0] || "?").toUpperCase()));
      const t = S.el("span", { class: "roster-text" });
      t.appendChild(S.el("span", { class: "ui" }, title));
      if (sub) t.appendChild(S.el("span", { class: "small muted" }, sub));
      li.appendChild(t);
      return li;
    };
    // The line above each roster only shows when nobody's on it yet.
    $("beer-count").hidden = beer.length > 0;
    const bl = $("beer-list"); bl.textContent = "";
    beer.forEach((b) => bl.appendChild(rosterRow(b.guest_name, b.guest_name, b.note || "")));
    $("wi-count").hidden = w.length > 0;
    const wl = $("writein-list"); wl.textContent = "";
    w.forEach((x) => wl.appendChild(rosterRow(x.guest_name, x.guest_name, x.item)));

    renderTicker(board.crew, DRINKS.filter((d) => isReady(d, claimed)).length, DRINKS.length);
    updateTray();
    updateMyList();
  }

  // Crew ticker: a stock-ticker band on Home with the live counts. The visible band scrolls;
  // screen readers get one plain sentence instead.
  let tickerKey = "";
  function renderTicker(c, readyCount, drinkCount) {
    const t = $("ticker");
    if (!t) return;
    if (!c) { t.hidden = true; return; }
    // Calendar days until Dec 31 (Nov 23 to Dec 31 is 38), counted from local midnight.
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((new Date(2026, 11, 31) - today) / 86400000);
    const countdown = days > 1 ? [String(days), "Days to the job"] : days === 1 ? ["1", "Day to the job"] : ["Tonight", "The job"];
    const items = [
      ["Crew", String(c.guests), c.guests > 0 ? "up" : ""],
      ["Drinks ready", readyCount + "/" + drinkCount, readyCount > 0 ? "up" : ""],
      [countdown[1], countdown[0], ""]
    ];
    const key = JSON.stringify(items);
    t.hidden = false;
    $("ticker-sr").textContent = c.guests + " on the crew, " + readyCount + " of " + drinkCount + " drinks ready, " + (days > 0 ? countdown[0] + " " + countdown[1].toLowerCase() : "the job is tonight") + ".";
    if (key === tickerKey) return;
    tickerKey = key;
    const track = $("ticker-track");
    track.textContent = "";
    for (let copy = 0; copy < 2; copy++) {
      const run = S.el("div", { class: "ticker-run" });
      // Three items are narrower than a wide screen, so each pass shows them twice to keep the loop seamless.
      items.concat(items).forEach(([label, value, dir]) => {
        const item = S.el("span", { class: "ticker-item" });
        item.appendChild(S.el("span", { class: "ticker-sym" }, label));
        item.appendChild(S.el("span", { class: "ticker-val" }, value));
        if (dir) item.appendChild(S.el("span", { class: "ticker-dir ticker-" + dir }, dir === "up" ? "\u25B2" : "\u25BC"));
        run.appendChild(item);
      });
      track.appendChild(run);
    }
  }

  async function load(force) {
    if (!S.configured) {
      setStatus($("board-status"), "The drink list isn't connected yet. Check back soon.", "err");
      return;
    }
    if (!board) setStatus($("board-status"), "Loading the supply run...");
    try {
      const next = await S.rpc("get_board");
      const key = JSON.stringify(next);
      setStatus($("board-status"), "");
      if (!force && key === boardKey && board) return;
      // Trim every name to "First L" before anything shows it.
      (next.supplies || []).forEach((x) => { x.claimers = (x.claimers || []).map(short); });
      (next.beer || []).forEach((b) => { b.guest_name = short(b.guest_name); });
      (next.write_ins || []).forEach((w) => { w.guest_name = short(w.guest_name); });
      board = next; boardKey = key;
      render();
    } catch (e) {
      if (window.console) console.error(e);
      if (!board) setStatus($("board-status"), "Lost the signal. Refresh to try again.", "err");
    }
  }

  // ---------- Pop-ups close on an outside tap and keep what was typed ----------
  function closeOnBackdrop(d) {
    let downOutside = false;
    const outside = (e) => {
      if (e.target !== d) return false;
      const r = d.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    d.addEventListener("pointerdown", (e) => { downOutside = outside(e); });
    d.addEventListener("click", (e) => { if (downOutside && outside(e)) d.close(); downOutside = false; });
  }

  // ---------- RSVP: create, edit, cancel ----------
  const rsvpDlg = $("rsvp-dialog");
  closeOnBackdrop(rsvpDlg);
  let rsvpMode = "new"; // "new" or "edit"

  function renderGuestFields(values) {
    const wrap = $("rsvp-guest-fields");
    const extra = Number($("rsvp-size").value) - 1;
    const kept = values || Array.from(wrap.querySelectorAll("input")).map((i) => i.value);
    wrap.textContent = "";
    $("rsvp-guests").hidden = extra < 1;
    for (let i = 0; i < extra; i++) {
      const id = "rsvp-guest-" + (i + 2);
      wrap.appendChild(S.el("label", { class: "sr-only", for: id }, "Guest " + (i + 2) + " name"));
      const inp = S.el("input", { id: id, maxlength: "40", placeholder: "Guest " + (i + 2) + " name", autocomplete: "off" });
      inp.value = kept[i] || "";
      wrap.appendChild(inp);
    }
  }
  $("rsvp-size").addEventListener("change", () => renderGuestFields());
  // Crew size stepper drives the (hidden) select so the rest of the form logic stays the same.
  function syncSize() {
    const v = Number($("rsvp-size").value);
    $("rsvp-size-out").textContent = v;
    $("rsvp-minus").disabled = v <= 1; $("rsvp-plus").disabled = v >= 6;
  }
  function stepSize(d) {
    const v = Math.min(6, Math.max(1, Number($("rsvp-size").value) + d));
    $("rsvp-size").value = String(v);
    $("rsvp-size").dispatchEvent(new Event("change"));
    syncSize();
  }
  $("rsvp-minus").addEventListener("click", () => stepSize(-1));
  $("rsvp-plus").addEventListener("click", () => stepSize(1));
  $("rsvp-size").addEventListener("change", syncSize);
  const guestValues = () => Array.from($("rsvp-guest-fields").querySelectorAll("input")).map((i) => i.value.trim()).filter(Boolean);

  function showRsvpState() {
    const r = store.get("steal-rsvp");
    const done = Boolean(r && r.id);
    $("tab-rsvp-label").textContent = done ? "You're in" : "RSVP";
    document.querySelector(".tab-rsvp").classList.toggle("is-done", done);
    $("rsvp-card-text").textContent = done
      ? "You're on the crew, " + short(r.name) + (r.size > 1 ? " (party of " + r.size + ")" : "") + ". Need to change it? Tap below."
      : "Plus-ones welcome. Tell us who's rolling with you.";
    document.querySelector("[data-open-rsvp].btn").textContent = done ? "Change my RSVP" : "Accept the job";
  }

  function setMode(mode) {
    rsvpMode = mode;
    const r = store.get("steal-rsvp");
    const editing = mode === "edit";
    // New: "New mission" lettering and the briefing. Already in: "Mission accepted", who they're on the list as, and the edit options.
    $("rsvp-step-form").classList.toggle("is-edit", editing);
    $("rsvp-dialog-title").setAttribute("aria-label", editing ? "Mission accepted" : "New mission");
    $("rsvp-submit").textContent = editing ? "Save changes" : "Accept the job";
    $("rsvp-edit-foot").hidden = !editing;
    $("rsvp-brief").hidden = editing;
    $("rsvp-you").hidden = !editing;
    if (editing && r) $("rsvp-you").textContent = "You're on the crew, " + short(r.name) + (r.size > 1 ? ". Party of " + r.size + "." : ".") + " Change anything below.";
    if (editing) {
      $("rsvp-name").value = r.name; $("rsvp-size").value = String(r.size || 1); $("rsvp-note").value = r.note || "";
      renderGuestFields(r.guests || []);
    } else if (rsvpMode === "new" && $("rsvp-form").dataset.wasEdit === "1") {
      $("rsvp-form").reset(); $("rsvp-name").value = ""; renderGuestFields([]);
    }
    $("rsvp-form").dataset.wasEdit = editing ? "1" : "0";
    if (typeof syncSize === "function") syncSize();
  }

  function openRsvp() {
    const r = store.get("steal-rsvp");
    $("rsvp-step-form").hidden = false; $("rsvp-step-confirm").hidden = true; $("rsvp-step-done").hidden = true;
    if ($("rsvp-status").classList.contains("err")) setStatus($("rsvp-status"), "");
    if (r && r.id) setMode("edit");
    else { setMode("new"); if (!$("rsvp-name").value) $("rsvp-name").value = savedName(); }
    rsvpDlg.showModal();
  }
  document.querySelectorAll("[data-open-rsvp]").forEach((b) => b.addEventListener("click", openRsvp));
  document.querySelectorAll("[data-close-rsvp]").forEach((b) => b.addEventListener("click", () => rsvpDlg.close()));
  $("rsvp-new").addEventListener("click", () => { setMode("new"); $("rsvp-name").focus(); });

  // outcome: "passed" (new RSVP, celebration), "failed" (canceled after accepting), or empty (an edit).
  function finish(message, outcome) {
    const failed = outcome === "failed";
    $("rsvp-done-text").textContent = message;
    $("rsvp-done-title").setAttribute("aria-label", failed ? "Mission failed" : "Mission accepted");
    $("rsvp-step-done").classList.toggle("is-failed", failed);
    $("rsvp-done-drinks").hidden = failed;
    $("rsvp-step-form").hidden = true; $("rsvp-step-confirm").hidden = true; $("rsvp-step-done").hidden = false;
    setStatus($("rsvp-status"), "");
    showRsvpState();
    if (outcome === "passed") missionPassed();
  }

  // New RSVP: the pop-up itself slams down onto the page and the title stamps in.
  // Skipped for people who turn off animations.
  function missionPassed() {
    rsvpDlg.classList.remove("dlg-slam");
    void rsvpDlg.offsetWidth;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try { if (navigator.vibrate) navigator.vibrate([0, 260, 40]); } catch (e) {}
    rsvpDlg.classList.add("dlg-slam");
  }
  rsvpDlg.addEventListener("close", () => rsvpDlg.classList.remove("dlg-slam"));


  $("rsvp-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const name = $("rsvp-name").value.trim();
    if (!name) { setStatus($("rsvp-status"), "Add your name first.", "err"); return; }
    const size = Number($("rsvp-size").value), note = $("rsvp-note").value, guests = guestValues();
    const btn = $("rsvp-submit");
    btn.disabled = true;
    try {
      const saved = store.get("steal-rsvp");
      if (rsvpMode === "edit" && saved && saved.id) {
        const r = await S.rpc("update_rsvp", { p_id: saved.id, p_token: saved.token, p_name: name, p_party_size: size, p_note: note, p_guests: guests });
        if (r === "ok") {
          store.set("steal-rsvp", Object.assign(saved, { name: name, size: size, note: note, guests: guests }));
          rememberName(name);
          finish("Got it, " + name + ". Your RSVP is updated" + (guests.length ? ": you, " + guests.join(" and ") : "") + ".");
          load();
        } else if (r === "not_found") {
          store.set("steal-rsvp", null); showRsvpState(); setMode("new");
          $("rsvp-name").value = name;
          setStatus($("rsvp-status"), "We couldn't find your earlier RSVP. Send it again and you're set.", "err");
        } else { setStatus($("rsvp-status"), "That didn't go through. Check the form and try again.", "err"); }
      } else {
        const r = await S.rpc("submit_rsvp_v2", { p_name: name, p_party_size: size, p_note: note, p_guests: guests });
        if (r && r.status === "ok") {
          rememberName(name);
          // Keep this phone's own RSVP so it can be changed later. RSVPs for other people aren't kept.
          if (!(saved && saved.id)) store.set("steal-rsvp", { id: r.id, token: r.token, name: name, size: size, note: note, guests: guests });
          finish("You're on the crew, " + short(name) + (guests.length ? ", with " + guests.map(short).join(" and ") : "") + ". Doors open at 9 PM on the 31st.", "passed");
          $("rsvp-form").reset(); renderGuestFields([]);
          load();
        } else { setStatus($("rsvp-status"), "That didn't go through. Check the form and try again.", "err"); }
      }
    } catch (e) {
      setStatus($("rsvp-status"), S.configured ? LOST : "RSVPs aren't connected yet. Text Sean at (214) 585-3256.", "err");
    }
    btn.disabled = false;
  });

  // "Can't make it": two taps, so it can't happen by accident.
  // "Can't make it" swaps the form for a plain confirmation step. Nothing is canceled until they confirm.
  function showStep(step) {
    ["rsvp-step-form", "rsvp-step-confirm", "rsvp-step-done"].forEach((id) => { $(id).hidden = id !== step; });
  }
  $("rsvp-cancel").addEventListener("click", () => {
    const saved = store.get("steal-rsvp");
    if (!saved || !saved.id) return;
    const party = saved.guests && saved.guests.length ? " and your plus-ones" : "";
    $("rsvp-confirm-text").textContent = "This takes you" + party + " off the crew list, " + saved.name + ".";
    setStatus($("rsvp-confirm-status"), "");
    showStep("rsvp-step-confirm");
    $("rsvp-confirm-keep").focus();
  });
  $("rsvp-confirm-keep").addEventListener("click", () => showStep("rsvp-step-form"));
  $("rsvp-confirm-yes").addEventListener("click", async () => {
    const saved = store.get("steal-rsvp");
    if (!saved || !saved.id) { showStep("rsvp-step-form"); return; }
    $("rsvp-confirm-yes").disabled = true;
    try {
      const r = await S.rpc("cancel_rsvp", { p_id: saved.id, p_token: saved.token });
      store.set("steal-rsvp", null);
      $("rsvp-form").reset(); renderGuestFields([]);
      finish(r === "ok" ? "You're off the job. We'll miss you, " + saved.name + ". Change your mind? The crew's still taking RSVPs." : "Your RSVP was already removed.", "failed");
      load();
    } catch (e) { setStatus($("rsvp-confirm-status"), LOST, "err"); }
    finally { $("rsvp-confirm-yes").disabled = false; }
  });

  // ---------- Beer and write-ins ----------
  $("beer-open").addEventListener("click", () => {
    if (!$("beer-name").value) $("beer-name").value = savedName();
    setStatus($("beer-status"), ""); $("beer-submit").disabled = false;
    beerDlg.open($("beer-name").value ? "beer-note" : "beer-name");
  });
  $("beer-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const name = $("beer-name").value.trim(), note = $("beer-note").value.trim();
    if (!name) { setStatus($("beer-status"), "Add your name so we know who's bringing it.", "err"); $("beer-name").focus(); return; }
    $("beer-submit").disabled = true;
    try {
      const r = await S.rpc("add_beer", { p_name: name, p_note: note });
      if (r === "ok") { rememberName(name); mine.beer.push(short(name) + "|" + note); saveMine(); $("beer-note").value = ""; $("beer-done-text").textContent = "You're on the beer list, " + short(name) + "."; beerDlg.done(); await load(true); }
      else { setStatus($("beer-status"), r === "full" ? "The beer list is full. Text Sean." : "That didn't go through. Try again.", "err"); $("beer-submit").disabled = false; }
    } catch (e) { setStatus($("beer-status"), LOST, "err"); $("beer-submit").disabled = false; }
  });

  // Snacks: the photo opens a blank form; a quick pick opens it with the food filled in.
  function openSnacks(item) {
    if (!$("wi-name").value) $("wi-name").value = savedName();
    setStatus($("writein-status"), ""); $("wi-submit").disabled = false;
    if (item != null) $("wi-item").value = item;
    wiDlg.open(item ? ($("wi-name").value ? "wi-item" : "wi-name") : "wi-item");
  }
  $("wi-open").addEventListener("click", () => openSnacks(null));
  document.querySelectorAll(".snack-pick").forEach((b) => b.addEventListener("click", () => openSnacks(b.dataset.item)));
  $("writein-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const name = $("wi-name").value.trim(), item = $("wi-item").value.trim();
    if (!name || !item) { setStatus($("writein-status"), "Add what you're bringing and your name.", "err"); return; }
    $("wi-submit").disabled = true;
    try {
      const r = await S.rpc("add_write_in", { p_name: name, p_item: item });
      if (r === "ok") { rememberName(name); mine.items.push(short(name) + "|" + item); saveMine(); $("wi-item").value = ""; $("wi-done-text").textContent = item + " is on the list. Thanks, " + short(name) + "."; wiDlg.done(); await load(true); }
      else { setStatus($("writein-status"), "That didn't go through. Try again.", "err"); $("wi-submit").disabled = false; }
    } catch (e) { setStatus($("writein-status"), LOST, "err"); $("wi-submit").disabled = false; }
  });

  // Staggered masonry on two-column screens (Home cards, the drink cards, the "Also on the list" cards).
  // Each card spans as many 2px rows as its height plus the 14px gap, so cards in a column stack with no holes.
  const masonryLists = [".home-cards", "#jobs"].map((q) => document.querySelector(q)).filter(Boolean);
  const twoCol = window.matchMedia("(min-width: 601px)");
  function layoutList(list) {
    const items = [...list.children];
    if (!twoCol.matches || list.offsetParent === null) {
      list.classList.remove("masonry");
      items.forEach((c) => { c.style.gridRowEnd = ""; });
      return;
    }
    list.classList.add("masonry");
    items.forEach((c) => {
      const h = c.getBoundingClientRect().height;
      c.style.gridRowEnd = "span " + Math.ceil((h + 14) / 2);
    });
  }
  function layoutHome() { masonryLists.forEach(layoutList); }
  layoutHome();
  window.addEventListener("resize", layoutHome);
  window.addEventListener("hashchange", () => setTimeout(layoutHome, 0));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutHome);
  document.getElementById("theme-toggle")?.addEventListener("click", () => setTimeout(layoutHome, 0));
  // Re-measure when a card changes height (text updates, images load, the drink list re-renders).
  if ("ResizeObserver" in window) {
    let queued = false;
    const ro = new ResizeObserver(() => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; layoutHome(); }); } });
    masonryLists.forEach((list) => {
      [...list.children].forEach((c) => ro.observe(c));
      new MutationObserver(() => { [...list.children].forEach((c) => ro.observe(c)); layoutHome(); }).observe(list, { childList: true });
    });
  }

  showRsvpState();
  renderGuestFields([]);
  load();
  setInterval(() => { if (!document.querySelector("dialog[open]") && document.visibilityState === "visible") load(); }, 20000);
})();
