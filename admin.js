// Admin dashboard. The PIN is checked by the database, never here.
(function () {
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

  function row(cells, action) {
    const tr = document.createElement("tr");
    cells.forEach((c) => tr.appendChild(S.el("td", null, c == null ? "" : String(c))));
    const td = document.createElement("td");
    if (action) {
      const b = S.el("button", { type: "button", class: "btn btn-quiet" }, action.label);
      b.addEventListener("click", action.run);
      td.appendChild(b);
    }
    tr.appendChild(td);
    return tr;
  }

  function empty(tbody, cols, text) {
    const tr = document.createElement("tr");
    const td = S.el("td", { colspan: String(cols), class: "muted" }, text);
    tr.appendChild(td); tbody.appendChild(tr);
  }

  async function act(fn, id, confirmText) {
    if (!window.confirm(confirmText)) return;
    try {
      const r = await S.rpc(fn, { p_pin: pin, p_id: id });
      if (r !== "ok") { setStatus($("dash-status"), MESSAGES[r] || "That didn't work.", "err"); return; }
      await load();
    } catch (e) { setStatus($("dash-status"), "Couldn't reach the server.", "err"); }
  }

  function render(d) {
    const rs = d.rsvps || [], cl = d.claims || [], wi = d.write_ins || [];
    $("stat-guests").textContent = rs.reduce((n, r) => n + (r.party_size || 0), 0);
    $("stat-rsvps").textContent = rs.length;
    $("stat-claims").textContent = cl.length;
    $("stat-writeins").textContent = wi.length;

    const tr = $("t-rsvps"); tr.textContent = "";
    if (!rs.length) empty(tr, 5, "No RSVPs yet.");
    rs.forEach((r) => tr.appendChild(row([r.guest_name, r.party_size, r.note || "", when(r.created_at)],
      { label: "Remove", run: () => act("admin_delete_rsvp", r.id, "Remove " + r.guest_name + "'s RSVP?") })));

    const tc = $("t-claims"); tc.textContent = "";
    if (!cl.length) empty(tc, 5, "No drinks claimed yet.");
    cl.forEach((c) => tc.appendChild(row([c.drink, c.bring, c.guest_name, when(c.created_at)],
      { label: "Release", run: () => act("admin_release_claim", c.id, "Release " + c.drink + " so someone else can claim it?") })));
    const open = d.open_drinks || [];
    $("open-drinks").textContent = open.length ? "Still open: " + open.join(", ") : "Every drink is claimed.";

    const tw = $("t-writeins"); tw.textContent = "";
    if (!wi.length) empty(tw, 4, "No write-ins yet.");
    wi.forEach((w) => tw.appendChild(row([w.item, w.guest_name, when(w.created_at)],
      { label: "Remove", run: () => act("admin_delete_write_in", w.id, "Remove " + w.item + "?") })));
  }

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
