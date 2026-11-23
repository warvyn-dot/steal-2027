// Guest page: RSVP, drink claims, write-ins.
(function () {
  const S = window.Steal;
  S.initTheme(document.getElementById("theme-toggle"));

  const $ = (id) => document.getElementById(id);
  const lists = {};
  document.querySelectorAll(".drink-list").forEach((ul) => { lists[ul.dataset.category] = ul; });
  let board = null;
  let current = null; // drink being claimed

  // Names typed here are remembered so guests don't retype them.
  function rememberName(name) { try { localStorage.setItem("steal-name", name); } catch (e) {} }
  function savedName() { try { return localStorage.getItem("steal-name") || ""; } catch (e) { return ""; } }
  ["rsvp-name", "wi-name"].forEach((id) => { if (!$(id).value) $(id).value = savedName(); });

  function setStatus(node, text, kind) {
    node.textContent = text || "";
    node.className = "status" + (kind ? " " + kind : "");
  }

  function render() {
    Object.values(lists).forEach((ul) => { ul.textContent = ""; });
    (board.drinks || []).forEach((d) => {
      const ul = lists[d.category];
      if (!ul) return;
      const li = document.createElement("li");
      const btn = S.el("button", { type: "button", class: "drink" });
      const who = S.el("span", { class: "who" });
      who.appendChild(S.headerArt(d.id, d.name));
      who.appendChild(S.el("span", { class: "bring" }, "Bring: " + d.bring));
      btn.appendChild(who);
      if (d.claimed_by) {
        btn.disabled = true;
        btn.appendChild(S.el("span", { class: "tag tag-compare" }, "Claimed by " + d.claimed_by));
        btn.setAttribute("aria-label", d.name + ", claimed by " + d.claimed_by);
      } else {
        btn.appendChild(S.el("span", { class: "tag tag-grow" }, "Open"));
        btn.setAttribute("aria-label", "Claim " + d.name + ". Bring " + d.bring + ".");
        btn.addEventListener("click", () => openClaim(d));
      }
      li.appendChild(btn);
      ul.appendChild(li);
    });
    const w = board.write_ins || [];
    $("writein-wrap").hidden = w.length === 0;
    const wl = $("writein-list");
    wl.textContent = "";
    w.forEach((x) => wl.appendChild(S.el("li", null, x.item + ", from " + x.guest_name)));
  }

  async function load() {
    if (!S.configured) {
      setStatus($("board-status"), "The drink list isn't connected yet. Check back soon.", "err");
      return;
    }
    try {
      board = await S.rpc("get_board");
      setStatus($("board-status"), "");
      render();
    } catch (e) {
      setStatus($("board-status"), "Couldn't load the drink list. Refresh to try again.", "err");
    }
  }

  // Claim dialog
  const dlg = $("claim-dialog");
  function openClaim(d) {
    current = d;
    const art = $("claim-art");
    art.textContent = "";
    art.appendChild(S.headerArt(d.id, d.name, 32 / 480));
    $("claim-bring").textContent = "Bring: " + d.bring;
    $("claim-name").value = savedName();
    setStatus($("claim-status"), "");
    $("claim-submit").disabled = false;
    dlg.showModal();
    $("claim-name").focus();
  }
  $("claim-cancel").addEventListener("click", () => dlg.close());
  $("claim-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const name = $("claim-name").value.trim();
    if (!name) { setStatus($("claim-status"), "Add your name so we know who's bringing it.", "err"); return; }
    $("claim-submit").disabled = true;
    try {
      const r = await S.rpc("claim_drink", { p_drink_id: current.id, p_name: name });
      if (r === "ok") { rememberName(name); dlg.close(); await load(); }
      else if (r === "taken") { setStatus($("claim-status"), "Someone just claimed this one. Pick another?", "err"); await load(); }
      else { setStatus($("claim-status"), "That didn't go through. Check your name and try again.", "err"); $("claim-submit").disabled = false; }
    } catch (e) {
      setStatus($("claim-status"), "Couldn't reach the server. Try again in a moment.", "err");
      $("claim-submit").disabled = false;
    }
  });

  // RSVP
  $("rsvp-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const name = $("rsvp-name").value.trim();
    if (!name) { setStatus($("rsvp-status"), "Add your name first.", "err"); return; }
    const btn = ev.target.querySelector("button");
    btn.disabled = true;
    try {
      const r = await S.rpc("submit_rsvp", { p_name: name, p_party_size: Number($("rsvp-size").value), p_note: $("rsvp-note").value });
      if (r === "ok") { rememberName(name); setStatus($("rsvp-status"), "You're on the crew, " + name + ". See you on the 31st.", "ok"); ev.target.reset(); $("rsvp-name").value = name; }
      else { setStatus($("rsvp-status"), "That didn't go through. Check the form and try again.", "err"); }
    } catch (e) {
      setStatus($("rsvp-status"), S.configured ? "Couldn't reach the server. Try again in a moment." : "RSVPs aren't connected yet. Text Sean at (214) 585-3256.", "err");
    }
    btn.disabled = false;
  });

  // Write-in
  $("writein-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const name = $("wi-name").value.trim(), item = $("wi-item").value.trim();
    if (!name || !item) { setStatus($("writein-status"), "Add your name and what you're bringing.", "err"); return; }
    const btn = ev.target.querySelector("button");
    btn.disabled = true;
    try {
      const r = await S.rpc("add_write_in", { p_name: name, p_item: item });
      if (r === "ok") { rememberName(name); setStatus($("writein-status"), "Added. Thanks, " + name + ".", "ok"); $("wi-item").value = ""; await load(); }
      else { setStatus($("writein-status"), "That didn't go through. Try again.", "err"); }
    } catch (e) {
      setStatus($("writein-status"), "Couldn't reach the server. Try again in a moment.", "err");
    }
    btn.disabled = false;
  });

  load();
  setInterval(() => { if (!dlg.open && document.visibilityState === "visible") load(); }, 20000);
})();
