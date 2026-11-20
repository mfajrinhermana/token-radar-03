"use strict";
var R = window.RADAR;
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s).replace(/[&<>"']/g, function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function money(v){
  if (v == null) return "—";
  var a = Math.abs(v);
  if (a >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return "$" + Math.round(v / 1e3) + "K";
  return "$" + Math.round(v);
}
function pct(v, d){ return v == null ? "—" : (v > 0 ? "+" : "") + v.toFixed(d == null ? 1 : d) + "%"; }
function age(v){ return v == null ? "—" : (v >= 365 ? (v / 365).toFixed(1) + "y" : v + "d"); }
function delta(r){
  var d = r.tvl_rank - r.rank;
  if (d > 0) return '<span class="up">▲' + d + "</span>";
  if (d < 0) return '<span class="down">▼' + (-d) + "</span>";
  return "—";
}
function med(vals){
  var s = vals.slice().sort(function(a, b){ return a - b; });
  return s[Math.floor(s.length / 2)];
}

/* ---------- header ---------- */
$("subtitle").textContent = "Snapshot " + R.as_of + " · " + R.board_size + " rows — " +
  R.watchlist_size + " watchlist + " + R.early_size + " early · model " + R.model_version +
  " · TVL floor " + money(R.floor_usd);
var byCat = {};
R.rows.forEach(function(r){ byCat[r.category] = (byCat[r.category] || 0) + r.implied_value_usd; });
var topCat = Object.keys(byCat).sort(function(a, b){ return byCat[b] - byCat[a]; })[0];
$("tiles").innerHTML =
  tile(R.board_size, "Board rows") +
  tile(R.watchlist_size + " / " + R.watchlist_size, "Watchlist covered") +
  tile(money(med(R.rows.map(function(r){ return r.implied_value_usd; }))), "Median implied value") +
  tile(topCat + " · " + money(byCat[topCat]), "Top category by implied");
function tile(v, label){ return '<div class="tile"><b>' + esc(v) + "</b><span>" + esc(label) + "</span></div>"; }
$("foot").textContent = "Implied values are model estimates from the snapshot's own figures, not market prices. " +
  "Snapshot: DefiLlama protocols, " + R.as_of + ". Nothing here is investment advice.";

/* ---------- filters + sort ---------- */
var state = { q: "", cat: "", wl: false, sort: "rank", dir: 1 };
var cats = Array.from(new Set(R.rows.map(function(r){ return r.category; }))).sort();
$("cat").innerHTML = '<option value="">All categories</option>' +
  cats.map(function(c){ return '<option value="' + esc(c) + '">' + esc(c) + "</option>"; }).join("");
function filtered(){
  var q = state.q.toLowerCase();
  var list = R.rows.filter(function(r){
    if (state.wl && !r.watchlist) return false;
    if (state.cat && r.category !== state.cat) return false;
    if (q && (r.name + " " + r.slug + " " + r.category).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
  var k = state.sort, d = state.dir;
  list.sort(function(a, b){
    var va = k === "delta" ? a.tvl_rank - a.rank : a[k];
    var vb = k === "delta" ? b.tvl_rank - b.rank : b[k];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "string") return va.localeCompare(vb) * d;
    return (va - vb) * d;
  });
  return list;
}
function renderRows(){
  var list = filtered();
  $("rows").innerHTML = list.map(function(r){
    return '<tr data-slug="' + esc(r.slug) + '" tabindex="0"><td class="num">' + r.rank + "</td>" +
      '<td class="name"><b>' + esc(r.name) + "</b><small>" + esc(r.slug) + " · " + esc(r.category) + "</small>" +
      (r.watchlist ? '<span class="badge wl">WL</span>' : '<span class="badge early">EARLY</span>') + "</td>" +
      '<td class="num">' + money(r.tvl_usd) + "</td>" +
      '<td class="num ' + (r.change_7d == null ? "" : r.change_7d < 0 ? "neg" : "pos") + '">' + pct(r.change_7d) + "</td>" +
      '<td class="num">' + age(r.age_days) + "</td>" +
      '<td class="num"><b>' + money(r.implied_value_usd) + "</b></td>" +
      '<td class="num">' + delta(r) + "</td></tr>";
  }).join("");
  $("count").textContent = "Showing " + list.length + " of " + R.rows.length;
  document.querySelectorAll("#board thead th").forEach(function(th){
    th.classList.remove("asc", "desc");
    if (th.dataset.sort === state.sort) th.classList.add(state.dir > 0 ? "asc" : "desc");
  });
}
$("q").addEventListener("input", function(e){ state.q = e.target.value; renderRows(); });
$("cat").addEventListener("change", function(e){ state.cat = e.target.value; renderRows(); });
$("wl").addEventListener("change", function(e){ state.wl = e.target.checked; renderRows(); });
document.querySelectorAll("#board thead th").forEach(function(th){
  th.addEventListener("click", function(){
    var k = th.dataset.sort;
    if (state.sort === k) state.dir = -state.dir;
    else { state.sort = k; state.dir = k === "name" ? 1 : -1; }
    if (k === "rank") state.dir = 1;
    renderRows();
  });
});
$("rows").addEventListener("click", function(e){
  var tr = e.target.closest("tr");
  if (tr) openDetail(tr.dataset.slug);
});
$("rows").addEventListener("keydown", function(e){
  if (e.key === "Enter") {
    var tr = e.target.closest("tr");
    if (tr) openDetail(tr.dataset.slug);
  }
});

/* ---------- tabs ---------- */
function setTab(board){
  $("tab-board").classList.toggle("on", board);
  $("tab-live").classList.toggle("on", !board);
  $("board-view").hidden = !board;
  $("live-view").hidden = board;
}
$("tab-board").addEventListener("click", function(){ setTab(true); });
$("tab-live").addEventListener("click", function(){ setTab(false); });

/* ---------- live tab ---------- */
var live = R.live.slice().sort(function(a, b){ return b.mcap_usd - a.mcap_usd; });
$("live-rows").innerHTML = live.map(function(r, i){
  return "<tr><td class=\"num\">" + (i + 1) + "</td>" +
    '<td class="name"><b>' + esc(r.name) + "</b><small>" + esc(r.slug) + "</small></td>" +
    "<td>" + esc(r.category) + "</td>" +
    '<td class="num">' + money(r.tvl_usd) + "</td>" +
    '<td class="num"><b>' + money(r.mcap_usd) + "</b></td>" +
    '<td class="num ' + (r.change_7d == null ? "" : r.change_7d < 0 ? "neg" : "pos") + '">' + pct(r.change_7d) + "</td>" +
    '<td class="num">' + (r.mcap_per_tvl == null ? "—" : r.mcap_per_tvl.toFixed(2) + "×") + "</td></tr>";
}).join("");

/* ---------- scatter: log TVL vs log implied ---------- */
(function scatter(){
  var W = 760, H = 320, PL = 52, PR = 14, PT = 12, PB = 34;
  var xs = R.rows.map(function(r){ return r.tvl_usd; });
  var ys = R.rows.map(function(r){ return r.implied_value_usd; });
  var x0 = Math.floor(Math.log10(Math.min.apply(null, xs)));
  var x1 = Math.ceil(Math.log10(Math.max.apply(null, xs)));
  var y0 = Math.floor(Math.log10(Math.min.apply(null, ys)));
  var y1 = Math.ceil(Math.log10(Math.max.apply(null, ys)));
  function X(v){ return PL + (Math.log10(v) - x0) / (x1 - x0) * (W - PL - PR); }
  function Y(v){ return PT + (1 - (Math.log10(v) - y0) / (y1 - y0)) * (H - PT - PB); }
  var g = "";
  for (var p = x0; p <= x1; p++){
    var gx = X(Math.pow(10, p));
    var anchor = gx > W - PR - 30 ? "end" : "middle";
    g += '<line x1="' + gx + '" y1="' + PT + '" x2="' + gx + '" y2="' + (H - PB) + '" stroke="#1e443c"/>' +
      '<text x="' + gx + '" y="' + (H - 12) + '" fill="#6d8a7e" font-size="10" text-anchor="' + anchor + '">' + money(Math.pow(10, p)) + "</text>";
  }
  for (var q2 = y0; q2 <= y1; q2++){
    var gy = Y(Math.pow(10, q2));
    g += '<line x1="' + PL + '" y1="' + gy + '" x2="' + (W - PR) + '" y2="' + gy + '" stroke="#1e443c"/>' +
      '<text x="' + (PL - 6) + '" y="' + (gy + 3) + '" fill="#6d8a7e" font-size="10" text-anchor="end">' + money(Math.pow(10, q2)) + "</text>";
  }
  var out = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Scatter plot: TVL against implied value, one dot per board row">' + g +
    '<text x="' + (PL + 4) + '" y="' + (PT + 12) + '" fill="#9db8ad" font-size="11">implied value (log)</text>' +
    '<text x="' + (W - PR) + '" y="' + (PT + 8) + '" fill="#9db8ad" font-size="11" text-anchor="end">TVL (log)</text>';
  R.rows.forEach(function(r){
    var fill = r.watchlist ? 'fill="#7ef0c1"' : 'fill="#0b1f1c" stroke="#7ef0c1" stroke-width="1.4"';
    out += '<circle cx="' + X(r.tvl_usd).toFixed(1) + '" cy="' + Y(r.implied_value_usd).toFixed(1) +
      '" r="' + (r.watchlist ? 4.5 : 3.5) + '" ' + fill + "><title>" +
      esc(r.name) + " — implied " + money(r.implied_value_usd) + ", TVL " + money(r.tvl_usd) + "</title></circle>";
  });
  out += "</svg>";
  $("scatter").innerHTML = out;
  var cap = document.createElement("p");
  cap.className = "fine";
  cap.textContent = "Each dot is one board row: TVL on the x-axis, implied value on the y-axis, both log scale. Hover a dot for its name and implied value.";
  $("scatter").appendChild(cap);
})();

/* ---------- detail panel ---------- */
function wfRow(label, factor, value, note){
  return '<div class="wf"><div class="lbl"><b>' + esc(label) + "</b> " + esc(factor) +
    (note ? '<span class="note">' + esc(note) + "</span>" : "") +
    '</div><div class="val">' + esc(value) + "</div></div>";
}
function openDetail(slug){
  var r = R.rows.find(function(x){ return x.slug === slug; });
  if (!r) return;
  var v1 = r.tvl_usd * r.base_multiple;
  var v2 = v1 * r.growth_multiplier;
  var v3 = v2 * r.maturity_multiplier;
  var v4 = v3 * r.breadth_multiplier;
  var sampleNote = r.calibration_protocols === 0
    ? "No live protocol in this tier — multiple fully shrunk to the category median"
    : "From " + r.calibration_protocols + " live protocol" + (r.calibration_protocols > 1 ? "s" : "") + " in this tier";
  var wlLine = r.watchlist
    ? "On the watchlist — one of the 40 protocols the snapshot's watchlist names."
    : "Off-watchlist — ranked anyway because it passes the launch-candidate rule: pre-token, TVL above the " +
      money(R.floor_usd) + " floor, and not a wrapped, staked or bridged product.";
  $("detail").innerHTML =
    "<h2>#" + r.rank + " " + esc(r.name) + "</h2>" +
    '<p class="meta">' + esc(r.slug) + " · " + esc(r.category) + " · " + esc(r.tier) + " tier · chains: " +
    esc(r.chains.join(", ")) + "</p>" +
    '<div class="facts">' +
    "<div><b>" + money(r.tvl_usd) + "</b><span>TVL (TVL rank #" + r.tvl_rank + ")</span></div>" +
    "<div><b>" + pct(r.change_7d) + "</b><span>7-day change · " + Math.round(r.growth_relative_pct * 100) + "th percentile in category</span></div>" +
    "<div><b>" + (r.age_days == null ? "—" : r.age_days + " days") + "</b><span>Age, no token</span></div>" +
    "<div><b>" + money(r.implied_value_usd) + "</b><span>Implied value</span></div></div>" +
    '<div class="wf"><div class="lbl"><b>TVL</b></div><div class="val">' + money(r.tvl_usd) + "</div></div>" +
    wfRow("× tier multiple", "× " + r.base_multiple.toFixed(3), money(v1), sampleNote) +
    wfRow("× growth", "× " + r.growth_multiplier.toFixed(4), money(v2),
      "7-day " + pct(r.change_7d) + ", " + Math.round(r.growth_relative_pct * 100) + "th percentile in " + r.category) +
    wfRow("× maturity", "× " + r.maturity_multiplier.toFixed(4), money(v3),
      "Log patience on " + (r.age_days == null ? "median age" : r.age_days + " days")) +
    wfRow("× breadth", "× " + r.breadth_multiplier.toFixed(2), money(v4),
      r.chains.length + " chain" + (r.chains.length > 1 ? "s" : "")) +
    '<div class="wf total"><div class="lbl"><b>= implied value</b><span class="note">Factors shown rounded; the stored value is the rounded product.</span></div><div class="val">' +
    money(r.implied_value_usd) + "</div></div>" +
    "<h3>Farm plan</h3><div class=\"phases\">" +
    r.farm_steps.map(function(s, i){
      return '<div class="phase"><b>Step ' + (i + 1) + ".</b> " + esc(s) + "</div>";
    }).join("") + "</div>" +
    '<p class="wl-line' + (r.watchlist ? "" : " off") + '">' + esc(wlLine) + "</p>";
  $("detail").hidden = false;
  $("detail").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ---------- methodology numbers + calibration table ---------- */
var M = R.model, C = R.calibration;
$("m-shrink-tier").textContent = M.shrink_tier;
$("m-shrink-cat").textContent = M.shrink_category;
$("m-clamp").textContent = M.multiple_floor + ", " + M.multiple_cap;
$("m-overall").textContent = C.overall_multiple.toFixed(3);
$("m-samples").textContent = C.overall_samples;
$("m-median-change").textContent = C.median_change_pct.toFixed(1) + "%";
$("m-median-age").textContent = C.median_age_days;
(function calib(){
  var used = {};
  R.rows.forEach(function(r){ used[r.category + "|" + r.tier] = true; });
  var keep = C.by_category_tier.filter(function(c){ return c.live_protocols > 0 || used[c.category + "|" + c.tier]; });
  var cats2 = Array.from(new Set(keep.map(function(c){ return c.category; }))).sort();
  $("calib-rows").innerHTML = cats2.map(function(cat){
    var cells = ["small", "mid", "large"].map(function(t){
      var cell = keep.find(function(c){ return c.category === cat && c.tier === t; });
      return '<td class="num">' + (cell ? cell.multiple.toFixed(3) + " · n=" + cell.live_protocols : "—") + "</td>";
    }).join("");
    return "<tr><td>" + esc(cat) + "</td>" + cells + "</tr>";
  }).join("");
})();

renderRows();
