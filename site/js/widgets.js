// Interactive figures. A page places <div class="wgt-mount" data-widget="mapping|coalesce|tiling" data-…></div>
// and loads this module after layout.js.
//   mapping   grid/block configuration → which thread computes which (row, col); warps; linear indices
//   coalesce  a warp's 32 addresses → 32-byte segments / 128-byte lines touched, efficiency
//   tiling    tiled matrix multiplication: which tiles of M and N a block loads in phase m, who loads what
import { h, $$ } from "./lib/ui.js";
import { t as tl } from "./lib/i18n.js";

const SVGNS = "http://www.w3.org/2000/svg";
const s = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const c of kids) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
};
const num = (label, value, min, max, onchange) => {
  const inp = h("input", { type: "number", value, min, max, step: 1 });
  inp.addEventListener("input", () => { const v = Math.max(min, Math.min(max, Math.round(Number(inp.value) || min))); onchange(v); });
  return { el: h("label", {}, label, inp), inp };
};
const sel = (label, options, value, onchange) => {
  const se = h("select", {}, ...options.map(([v, txt]) => h("option", { value: v, selected: String(v) === String(value) ? true : null }, txt)));
  se.addEventListener("change", () => onchange(se.value));
  return { el: h("label", {}, label, se), se };
};
const kv = (pairs) => h("dl", { class: "kv" }, ...pairs.flatMap(([k, v]) => [h("dt", {}, k), h("dd", { html: v })]));

const BLOCK_COLORS = ["var(--blue-2)", "var(--s3)", "var(--s4)", "var(--s5)", "var(--s7)", "var(--s2)"];
const WARP_COLORS = ["#2a78d6", "#1baf7a", "#eda100", "#e87ba4", "#6250d6", "#eb6834", "#008300", "#e34948"];

// ------------------------------------------------------------------------------------------------ mapping
function mapping(root) {
  const d = root.dataset;
  const st = { gx: +d.gx || 3, gy: +d.gy || 3, bx: +d.bx || 8, by: +d.by || 32, sel: { bx: 2, by: 1, tx: 5, ty: 10 }, warps: true };
  const box = h("div", { class: "wgt" },
    h("div", { class: "wgt-title" }, tl("Thread → veri eşlemesi", "Thread → data mapping")),
    h("div", { class: "wgt-sub", html: tl(
      "<code>kernel&lt;&lt;&lt;dim3(gx, gy), dim3(bx, by)&gt;&gt;&gt;</code>, her thread <code>row = blockIdx.y*blockDim.y + threadIdx.y</code>, <code>col = blockIdx.x*blockDim.x + threadIdx.x</code> elemanını hesaplar. Bir hücreye tıklayın.",
      "<code>kernel&lt;&lt;&lt;dim3(gx, gy), dim3(bx, by)&gt;&gt;&gt;</code>; each thread computes element <code>row = blockIdx.y*blockDim.y + threadIdx.y</code>, <code>col = blockIdx.x*blockDim.x + threadIdx.x</code>. Click a cell.") }));
  const ctl = h("div", { class: "wgt-controls" });
  const mk = (lab, key, max) => num(lab, st[key], 1, max, (v) => { st[key] = v; clampSel(); draw(); });
  ctl.append(h("div", { class: "pair" }, mk("gridDim.x", "gx", 16).el, mk("gridDim.y", "gy", 16).el),
    h("div", { class: "pair" }, mk("blockDim.x", "bx", 64).el, mk("blockDim.y", "by", 64).el));
  const wch = h("input", { type: "checkbox", checked: true });
  wch.addEventListener("change", () => { st.warps = wch.checked; draw(); });
  ctl.append(h("label", { style: { flexDirection: "row", alignItems: "center", gap: "6px" } }, wch, tl("Seçili bloğun warp'larını renklendir", "Colour the warps of the selected block")));
  const gridWrap = h("div", { class: "wgt-grid-wrap" });
  const out = h("div", { class: "wgt-out" });
  box.append(ctl, gridWrap, out);
  root.replaceWith(box);

  function clampSel() {
    const q = st.sel;
    q.bx = Math.min(q.bx, st.gx - 1); q.by = Math.min(q.by, st.gy - 1); q.tx = Math.min(q.tx, st.bx - 1); q.ty = Math.min(q.ty, st.by - 1);
  }
  function draw() {
    const R = st.gy * st.by, C = st.gx * st.bx, T = st.bx * st.by;
    const tooBig = T > 1024;
    const cs = Math.max(3, Math.min(18, Math.floor(760 / C), Math.floor(900 / R)));
    const W = C * cs + 30, H = R * cs + 22;
    const svg = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": tl("Çıktı matrisi", "Output matrix") });
    const g = s("g", { transform: "translate(26,18)" });
    svg.append(g);
    const q = st.sel;
    const selTid = q.ty * st.bx + q.tx, selWarp = Math.floor(selTid / 32);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const bX = Math.floor(c / st.bx), bY = Math.floor(r / st.by), tx = c % st.bx, ty = r % st.by;
      const inSel = bX === q.bx && bY === q.by;
      const tid = ty * st.bx + tx, warp = Math.floor(tid / 32);
      let fill = BLOCK_COLORS[(bX + bY) % 2 ? 1 : 0], op = 0.28;
      if (inSel && st.warps) { fill = WARP_COLORS[warp % WARP_COLORS.length]; op = warp === selWarp ? 0.95 : 0.45; }
      else if (inSel) op = 0.6;
      const rect = s("rect", { x: c * cs, y: r * cs, width: cs, height: cs, fill, "fill-opacity": op, class: "cell" });
      if (bX === q.bx && bY === q.by && tx === q.tx && ty === q.ty) { rect.setAttribute("fill", "var(--critical)"); rect.setAttribute("fill-opacity", 1); }
      rect.addEventListener("click", () => { st.sel = { bx: bX, by: bY, tx, ty }; draw(); });
      g.append(rect);
    }
    // block borders + labels
    for (let bY = 0; bY < st.gy; bY++) for (let bX = 0; bX < st.gx; bX++) {
      g.append(s("rect", { x: bX * st.bx * cs, y: bY * st.by * cs, width: st.bx * cs, height: st.by * cs, fill: "none", stroke: bX === q.bx && bY === q.by ? "var(--text)" : "var(--text-2)", "stroke-width": bX === q.bx && bY === q.by ? 2 : 0.8 }));
    }
    for (let bX = 0; bX < st.gx; bX++) g.append(s("text", { x: (bX + 0.5) * st.bx * cs, y: -5, "text-anchor": "middle", "font-size": 10, fill: "var(--text-2)" }, `bx=${bX}`));
    for (let bY = 0; bY < st.gy; bY++) g.append(s("text", { x: -4, y: (bY + 0.5) * st.by * cs, "text-anchor": "end", "font-size": 10, fill: "var(--text-2)", "dominant-baseline": "middle" }, `by=${bY}`));
    gridWrap.replaceChildren(svg);

    const row = q.by * st.by + q.ty, col = q.bx * st.bx + q.tx;
    const blockLin = q.by * st.gx + q.bx, gid = blockLin * T + selTid;
    const warpsPerBlock = Math.ceil(T / 32);
    const rowsPerWarp = 32 / st.bx;
    const warpDesc = st.bx >= 32
      ? tl(`warp ${selWarp}: threadIdx.y = ${q.ty}, threadIdx.x ∈ [${Math.floor(q.tx / 32) * 32}, ${Math.floor(q.tx / 32) * 32 + 31}]`, `warp ${selWarp}: threadIdx.y = ${q.ty}, threadIdx.x ∈ [${Math.floor(q.tx / 32) * 32}, ${Math.floor(q.tx / 32) * 32 + 31}]`)
      : Number.isInteger(rowsPerWarp)
        ? tl(`warp ${selWarp}: threadIdx.y ∈ [${selWarp * rowsPerWarp}, ${selWarp * rowsPerWarp + rowsPerWarp - 1}], tüm threadIdx.x (her warp ${rowsPerWarp} satır × ${st.bx} sütun)`, `warp ${selWarp}: threadIdx.y ∈ [${selWarp * rowsPerWarp}, ${selWarp * rowsPerWarp + rowsPerWarp - 1}], all threadIdx.x (each warp ${rowsPerWarp} rows × ${st.bx} cols)`)
        : tl(`warp ${selWarp}: lineer id ${selWarp * 32}…${selWarp * 32 + 31} (blockDim.x 32'yi bölmüyor, warp satır ortasında başlar)`, `warp ${selWarp}: linear ids ${selWarp * 32}…${selWarp * 32 + 31} (blockDim.x does not divide 32: warps start mid-row)`);
    out.replaceChildren(
      tooBig ? h("p", { class: "bad" }, tl(`Blok başına ${T} thread > 1024: bu konfigürasyon başlatılamaz (launch hatası).`, `${T} threads per block > 1024: this launch fails.`)) : "",
      h("div", { class: "fig-body cols-2" },
        kv([
          [tl("Seçili thread", "Selected thread"), `blockIdx=(${q.bx},${q.by}) threadIdx=(${q.tx},${q.ty})`],
          ["row, col", `row = ${q.by}*${st.by} + ${q.ty} = <b>${row}</b>, col = ${q.bx}*${st.bx} + ${q.tx} = <b>${col}</b>`],
          [tl("Bloktaki lineer id", "Linear id in block"), `ty*blockDim.x + tx = ${q.ty}*${st.bx} + ${q.tx} = ${selTid}`],
          ["warp", warpDesc],
          [tl("Global lineer id", "Global linear id"), `(by*gridDim.x + bx)*T + tid = (${q.by}*${st.gx}+${q.bx})*${T} + ${selTid} = ${gid}`],
          [tl("P'de adres", "Address in P"), `P[row*${C} + col] = P[${row * C + col}]`],
          ["matmul", tl(`M'nin ${row}. satırını, N'nin ${col}. sütununu okur`, `reads row ${row} of M and column ${col} of N`)],
        ]),
        kv([
          [tl("Thread/blok", "Threads/block"), `${st.bx}×${st.by} = ${T}`],
          [tl("Blok sayısı", "Blocks"), `${st.gx}×${st.gy} = ${st.gx * st.gy}`],
          [tl("Toplam thread", "Total threads"), `${st.gx * st.gy * T}`],
          [tl("Warp/blok", "Warps/block"), `⌈${T}/32⌉ = ${warpsPerBlock}`],
          [tl("Toplam warp", "Total warps"), `${warpsPerBlock * st.gx * st.gy}`],
          [tl("Kapsanan matris", "Matrix covered"), tl(`${R} satır × ${C} sütun`, `${R} rows × ${C} cols`)],
        ])));
  }
  draw();
}

// ------------------------------------------------------------------------------------------------ coalescing
const PRESETS = {
  seq: { pat: "stride", stride: 1, offset: 0, size: 4 },
  offset: { pat: "stride", stride: 1, offset: 1, size: 4 },
  stride2: { pat: "stride", stride: 2, offset: 0, size: 4 },
  col: { pat: "stride", stride: 1024, offset: 0, size: 4 },
  same: { pat: "same", stride: 1, offset: 0, size: 4 },
  random: { pat: "random", stride: 1, offset: 0, size: 4 },
  double: { pat: "stride", stride: 1, offset: 0, size: 8 },
};
function coalesce(root) {
  const st = { ...PRESETS[root.dataset.preset || "seq"] };
  const box = h("div", { class: "wgt" },
    h("div", { class: "wgt-title" }, tl("Bir warp'ın global bellek erişimi", "One warp's global memory access")),
    h("div", { class: "wgt-sub", html: tl(
      "32 thread aynı load komutunu çalıştırır; thread <code>i</code> adres <code>base + (offset + i·stride)·size</code>'ı okur (base 256 bayta hizalı). Donanım bunları 32 baytlık hizalı segmentlere (ve 128 baytlık satırlara) toplar.",
      "32 threads execute the same load; thread <code>i</code> reads address <code>base + (offset + i·stride)·size</code> (base aligned to 256 bytes). The hardware combines them into aligned 32-byte segments (and 128-byte lines).") }));
  const ctl = h("div", { class: "wgt-controls" });
  const presetSel = sel(tl("Hazır örnek", "Preset"), [
    ["seq", tl("a[i] (ardışık)", "a[i] (consecutive)")], ["offset", tl("a[i+1] (kaydırılmış)", "a[i+1] (misaligned)")], ["stride2", "a[2*i]"],
    ["col", tl("a[i*1024] (sütun / naive transpose yazma)", "a[i*1024] (column / naive transpose write)")], ["same", tl("a[0] (hepsi aynı adres)", "a[0] (all the same address)")],
    ["random", tl("rastgele", "random")], ["double", "double a[i]"]], root.dataset.preset || "seq", (v) => { Object.assign(st, PRESETS[v]); sync(); draw(); });
  const patSel = sel(tl("Desen", "Pattern"), [["stride", "a[offset + i*stride]"], ["same", "a[offset]"], ["random", tl("rastgele", "random")]], st.pat, (v) => { st.pat = v; draw(); });
  const sizeSel = sel(tl("Kelime boyu (bayt)", "Word size (bytes)"), [[1, "1 (char)"], [2, "2 (short)"], [4, "4 (float/int)"], [8, "8 (double/float2)"], [16, "16 (float4)"]], st.size, (v) => { st.size = +v; draw(); });
  const strideIn = num("stride", st.stride, 0, 4096, (v) => { st.stride = v; draw(); });
  const offIn = num("offset", st.offset, 0, 4096, (v) => { st.offset = v; draw(); });
  ctl.append(presetSel.el, patSel.el, sizeSel.el, strideIn.el, offIn.el);
  const out = h("div", { class: "wgt-out" });
  box.append(ctl, out);
  root.replaceWith(box);
  function sync() { patSel.se.value = st.pat; sizeSel.se.value = st.size; strideIn.inp.value = st.stride; offIn.inp.value = st.offset; }
  let rnd = Array.from({ length: 32 }, () => Math.floor(Math.random() * 100000));
  function draw() {
    const addrs = [];
    for (let i = 0; i < 32; i++) {
      const idx = st.pat === "same" ? st.offset : st.pat === "random" ? rnd[i] : st.offset + i * st.stride;
      addrs.push(idx * st.size);
    }
    const seg32 = new Set(), seg128 = new Set(), uniq = new Set();
    for (const a of addrs) {
      for (let b = a; b < a + st.size; b++) { seg32.add(Math.floor(b / 32)); seg128.add(Math.floor(b / 128)); }
      uniq.add(a);
    }
    const useful = uniq.size * st.size;
    const moved = seg32.size * 32;
    const eff = useful / moved;
    const ideal = Math.ceil((32 * st.size) / 128);
    const segList = [...seg32].sort((a, b) => a - b);
    const shown = segList.slice(0, 48);
    const bar = h("div", { class: "seg-bar" }, ...shown.map((sg) => h("span", { class: "hit", title: `bytes ${sg * 32}…${sg * 32 + 31}` }, `#${sg}`)), segList.length > 48 ? h("span", {}, `… +${segList.length - 48}`) : "");
    const table = h("table", { class: "tbl-mini" }, h("tr", {}, h("th", {}, "thread"), ...[0, 1, 2, 3, 30, 31].map((i) => h("th", {}, i))),
      h("tr", {}, h("th", {}, tl("bayt adresi", "byte address")), ...[0, 1, 2, 3, 30, 31].map((i) => h("td", {}, addrs[i]))),
      h("tr", {}, h("th", {}, tl("32B segment", "32B segment")), ...[0, 1, 2, 3, 30, 31].map((i) => h("td", {}, Math.floor(addrs[i] / 32)))));
    const verdict = eff >= 0.99 ? h("span", { class: "good" }, tl("tam coalesced", "fully coalesced"))
      : eff >= 0.5 ? h("span", {}, tl("kısmen coalesced", "partly coalesced")) : h("span", { class: "bad" }, tl("coalesced değil", "not coalesced"));
    out.replaceChildren(h("div", { class: "table-scroll" }, table),
      h("p", {}, tl("Dokunulan 32 baytlık segmentler: ", "32-byte segments touched: "), h("b", {}, seg32.size), tl(` · 128 baytlık satırlar: `, ` · 128-byte lines: `), h("b", {}, seg128.size)),
      bar,
      kv([
        [tl("Thread'lerin istediği", "Requested by the threads"), `${uniq.size} ${tl("farklı adres", "distinct addresses")} × ${st.size} B = ${useful} B`],
        [tl("Taşınan (32B segment)", "Moved (32B segments)"), `${seg32.size} × 32 B = ${moved} B`],
        [tl("Verim", "Efficiency"), `${useful}/${moved} = ${(eff * 100).toFixed(1)}% — ${verdict.outerHTML}`],
        [tl("En iyi durum", "Best case"), tl(`32 × ${st.size} B = ${32 * st.size} B → ${ideal} adet 128B satır`, `32 × ${st.size} B = ${32 * st.size} B → ${ideal} × 128B line(s)`)],
      ]));
  }
  const reroll = h("button", { type: "button", class: "btn small" }, tl("Rastgele adresleri yenile", "New random addresses"));
  reroll.addEventListener("click", () => { rnd = rnd.map(() => Math.floor(Math.random() * 100000)); draw(); });
  ctl.append(reroll);
  draw();
}

// ------------------------------------------------------------------------------------------------ tiling
function tiling(root) {
  const st = { W: 8, T: 4, bx: 1, by: 0, m: 0, tx: 1, ty: 2 };
  const box = h("div", { class: "wgt" },
    h("div", { class: "wgt-title" }, tl("Tiled matris çarpımı: faz faz", "Tiled matrix multiplication, phase by phase")),
    h("div", { class: "wgt-sub", html: tl(
      "Blok <code>(bx, by)</code>, <code>P</code>'nin bir T×T karosunu hesaplar. Faz <code>m</code>'de her thread <code>Mds[ty][tx] = M[Row][m*T+tx]</code> ve <code>Nds[ty][tx] = N[m*T+ty][Col]</code> yükler. P karosunda bir thread'e tıklayın.",
      "Block <code>(bx, by)</code> computes one T×T tile of <code>P</code>. In phase <code>m</code> each thread loads <code>Mds[ty][tx] = M[Row][m*T+tx]</code> and <code>Nds[ty][tx] = N[m*T+ty][Col]</code>. Click a thread in the P tile.") }));
  const ctl = h("div", { class: "wgt-controls" });
  const wSel = sel("Width", [[4, "4"], [8, "8"], [12, "12"], [16, "16"]], st.W, (v) => { st.W = +v; fix(); draw(); });
  const tSel = sel("TILE_WIDTH", [[2, "2"], [4, "4"]], st.T, (v) => { st.T = +v; fix(); draw(); });
  const bxIn = num("blockIdx.x", st.bx, 0, 7, (v) => { st.bx = v; fix(); draw(); });
  const byIn = num("blockIdx.y", st.by, 0, 7, (v) => { st.by = v; fix(); draw(); });
  const mIn = num(tl("faz m", "phase m"), st.m, 0, 7, (v) => { st.m = v; fix(); draw(); });
  ctl.append(wSel.el, tSel.el, bxIn.el, byIn.el, mIn.el);
  const fig = h("div", { class: "wgt-grid-wrap" });
  const out = h("div", { class: "wgt-out" });
  box.append(ctl, fig, out);
  root.replaceWith(box);
  function fix() {
    const n = st.W / st.T;
    st.bx = Math.min(st.bx, n - 1); st.by = Math.min(st.by, n - 1); st.m = Math.min(st.m, n - 1); st.tx = Math.min(st.tx, st.T - 1); st.ty = Math.min(st.ty, st.T - 1);
    bxIn.inp.value = st.bx; byIn.inp.value = st.by; mIn.inp.value = st.m;
  }
  function draw() {
    const { W, T, bx, by, m, tx, ty } = st;
    const cs = Math.max(12, Math.min(24, Math.floor(220 / W)));
    const gap = 46, Wd = W * cs;
    const svg = s("svg", { width: 3 * Wd + 2 * gap + 10, height: Wd + 34, role: "img", "aria-label": "M × N = P" });
    const Row = by * T + ty, Col = bx * T + tx;
    const mats = [["M", 0], ["N", Wd + gap], ["P", 2 * (Wd + gap)]];
    for (const [name, ox] of mats) {
      const g = s("g", { transform: `translate(${ox + 5},22)` });
      g.append(s("text", { x: Wd / 2, y: -8, "text-anchor": "middle", "font-size": 12, "font-weight": 700, fill: "var(--text)" }, name));
      for (let r = 0; r < W; r++) for (let c = 0; c < W; c++) {
        let fill = "var(--surface-3)", op = 1;
        if (name === "M") {
          if (r >= by * T && r < by * T + T) { fill = "var(--s1)"; op = 0.18; }
          if (r >= by * T && r < by * T + T && c >= m * T && c < m * T + T) { fill = "var(--s1)"; op = 0.55; }
          if (r === Row && c === m * T + tx) { fill = "var(--critical)"; op = 1; }
        } else if (name === "N") {
          if (c >= bx * T && c < bx * T + T) { fill = "var(--s3)"; op = 0.18; }
          if (c >= bx * T && c < bx * T + T && r >= m * T && r < m * T + T) { fill = "var(--s3)"; op = 0.6; }
          if (r === m * T + ty && c === Col) { fill = "var(--critical)"; op = 1; }
        } else {
          const inTile = r >= by * T && r < by * T + T && c >= bx * T && c < bx * T + T;
          if (inTile) { fill = "var(--s4)"; op = 0.55; }
          if (r === Row && c === Col) { fill = "var(--critical)"; op = 1; }
        }
        const rect = s("rect", { x: c * cs, y: r * cs, width: cs, height: cs, fill, "fill-opacity": op, class: "cell" });
        if (name === "P" && r >= by * T && r < by * T + T && c >= bx * T && c < bx * T + T) rect.addEventListener("click", () => { st.tx = c - bx * T; st.ty = r - by * T; draw(); });
        g.append(rect);
      }
      for (let k = 0; k <= W; k += T) {
        g.append(s("line", { x1: k * cs, y1: 0, x2: k * cs, y2: Wd, stroke: "var(--text-2)", "stroke-width": 1 }));
        g.append(s("line", { x1: 0, y1: k * cs, x2: Wd, y2: k * cs, stroke: "var(--text-2)", "stroke-width": 1 }));
      }
      svg.append(g);
    }
    svg.append(s("text", { x: Wd + gap / 2 + 5, y: Wd / 2 + 26, "text-anchor": "middle", "font-size": 18, fill: "var(--text-2)" }, "×"));
    svg.append(s("text", { x: 2 * Wd + gap * 1.5 + 5, y: Wd / 2 + 26, "text-anchor": "middle", "font-size": 18, fill: "var(--text-2)" }, "="));
    fig.replaceChildren(svg);
    const phases = W / T;
    out.replaceChildren(
      h("div", { class: "legend" }, h("span", {}, h("i", { style: { background: "var(--s1)", opacity: 0.55 } }), tl("faz m'de yüklenen M karosu → Mds", "M tile loaded in phase m → Mds")),
        h("span", {}, h("i", { style: { background: "var(--s3)", opacity: 0.6 } }), tl("faz m'de yüklenen N karosu → Nds", "N tile loaded in phase m → Nds")),
        h("span", {}, h("i", { style: { background: "var(--s4)", opacity: 0.55 } }), tl("bloğun P karosu", "the block's P tile")),
        h("span", {}, h("i", { style: { background: "var(--critical)" } }), tl("seçili thread'in yükledikleri / hesapladığı", "what the selected thread loads / computes"))),
      kv([
        [tl("Seçili thread", "Selected thread"), `threadIdx=(${tx},${ty}) → Row = ${by}*${T}+${ty} = ${Row}, Col = ${bx}*${T}+${tx} = ${Col}`],
        [tl("Faz m'de yükler", "Loads in phase m"), `Mds[${ty}][${tx}] = M[${Row}*${W} + (${m}*${T}+${tx})] = M[${Row}][${m * T + tx}]<br>Nds[${ty}][${tx}] = N[(${m}*${T}+${ty})*${W} + ${Col}] = N[${m * T + ty}][${Col}]`],
        [tl("Sonra hesaplar", "Then computes"), `Pvalue += Σ<sub>k=0..${T - 1}</sub> Mds[${ty}][k]·Nds[k][${tx}]`],
        [tl("Faz sayısı", "Phases"), `Width/T = ${W}/${T} = ${phases}`],
        [tl("Thread başına global okuma", "Global reads per thread"), tl(`naive: 2·Width = ${2 * W} · tiled: 2·Width/T = ${2 * W / T} → ${T}× azalma`, `naive: 2·Width = ${2 * W} · tiled: 2·Width/T = ${2 * W / T} → ${T}× fewer`)],
        [tl("Shared bellek/blok", "Shared memory/block"), `2·T²·4 B = ${2 * T * T * 4} B`],
      ]));
  }
  draw();
}

// ------------------------------------------------------------------------------------------------ drill
// Random launch configuration + random thread: compute row, col, warp, P index; checked on the spot.
function drill(root) {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const rnd = (n) => Math.floor(Math.random() * n);
  let q;
  const box = h("div", { class: "wgt" },
    h("div", { class: "wgt-title" }, tl("İndeks antrenmanı", "Index drill")),
    h("div", { class: "wgt-sub", html: tl(
      "Rastgele bir konfigürasyon. <code>col = blockIdx.x*blockDim.x + threadIdx.x</code>, <code>row = blockIdx.y*blockDim.y + threadIdx.y</code>, P'nin genişliği = <code>gridDim.x*blockDim.x</code> (row-major). Kâğıt-kalemle hesaplayın, sonra kontrol edin.",
      "A random configuration. <code>col = blockIdx.x*blockDim.x + threadIdx.x</code>, <code>row = blockIdx.y*blockDim.y + threadIdx.y</code>, the width of P = <code>gridDim.x*blockDim.x</code> (row-major). Work it out on paper, then check.") }));
  const prompt = h("div", { class: "formula-box" });
  const fields = ["row", "col", "warp", "P"].map((k) => {
    const inp = h("input", { type: "number" });
    const lab = { row: "row", col: "col", warp: tl("bloktaki warp no", "warp in block"), P: tl("P dizisindeki indeks", "index into P") }[k];
    return { k, inp, el: h("label", {}, lab, inp), mark: h("span") };
  });
  const res = h("div", { class: "wgt-out" });
  const checkBtn = h("button", { type: "button", class: "btn small primary" }, tl("Kontrol et", "Check"));
  const newBtn = h("button", { type: "button", class: "btn small" }, tl("Yeni soru", "New question"));
  const showBtn = h("button", { type: "button", class: "btn small" }, tl("Çözümü göster", "Show the solution"));
  const ctl = h("div", { class: "wgt-controls" }, ...fields.map((f) => h("div", {}, f.el, f.mark)), h("div", { class: "btn-row" }, checkBtn, showBtn, newBtn));
  box.append(prompt, ctl, res);
  root.replaceWith(box);
  function make() {
    const bx = pick([4, 8, 16, 32]), by = pick([2, 4, 8, 16, 32].filter((v) => v * bx <= 1024 && v * bx >= 32));
    const gx = 1 + rnd(4), gy = 1 + rnd(4);
    const t = { bx: rnd(gx), by: rnd(gy), tx: rnd(bx), ty: rnd(by) };
    const row = t.by * by + t.ty, col = t.bx * bx + t.tx, W = gx * bx;
    q = { gx, gy, bx, by, t, ans: { row, col, warp: Math.floor((t.ty * bx + t.tx) / 32), P: row * W + col }, W };
    prompt.textContent = `kernel<<<dim3(${gx}, ${gy}), dim3(${bx}, ${by})>>>(P, ...);\n` + tl("thread", "thread") + `: blockIdx = (${t.bx}, ${t.by}), threadIdx = (${t.tx}, ${t.ty})`;
    for (const f of fields) { f.inp.value = ""; f.mark.textContent = ""; }
    res.replaceChildren();
  }
  checkBtn.addEventListener("click", () => {
    let ok = 0;
    for (const f of fields) {
      const good = f.inp.value !== "" && Number(f.inp.value) === q.ans[f.k];
      f.mark.textContent = f.inp.value === "" ? "" : good ? " ✓" : " ✗";
      f.mark.className = good ? "good" : "bad";
      ok += good;
    }
    res.replaceChildren(h("p", {}, tl(`${ok}/4 doğru.`, `${ok}/4 correct.`)));
  });
  showBtn.addEventListener("click", () => {
    const { t, bx, by, W, ans } = q;
    res.replaceChildren(h("div", { class: "formula-box" },
      `row  = ${t.by}*${by} + ${t.ty} = ${ans.row}\ncol  = ${t.bx}*${bx} + ${t.tx} = ${ans.col}\n` +
      `id   = ty*blockDim.x + tx = ${t.ty}*${bx} + ${t.tx} = ${t.ty * bx + t.tx}  →  warp = ${t.ty * bx + t.tx}/32 = ${ans.warp}\n` +
      `W    = gridDim.x*blockDim.x = ${q.gx}*${bx} = ${W}\nP[row*W + col] = P[${ans.row}*${W} + ${ans.col}] = P[${ans.P}]`));
  });
  newBtn.addEventListener("click", make);
  make();
}

const WIDGETS = { mapping, coalesce, tiling, drill };
for (const el of $$(".wgt-mount[data-widget]")) WIDGETS[el.dataset.widget]?.(el);
