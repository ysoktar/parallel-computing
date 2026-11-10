// "Run" for code blocks. A block written as <pre class="code" data-run="transpose.cu"> gets a bar with
// ▶ Run (the full program code/transpose.cu with default flags), ✎ Edit (the full program in an editor, compiler
// flags and program arguments), and ⤓ Download. Programs are compiled and run on the VIEWER'S computer by the local
// runner (site/tools/runner.py, http://127.0.0.1:7457): C/C++ with g++/clang++ on the CPU, CUDA with nvcc on the GPU.
import { h } from "./ui.js";
import { t as tl } from "./i18n.js";

const RUNNER = "http://127.0.0.1:7457";
const CODE_BASE = new URL("../../code/", import.meta.url);
const RUNNER_URL = new URL("../../tools/runner.py", import.meta.url).href;
const FALLBACK_FLAGS = { cuda: "-O2 -std=c++17 -arch=native", cpp: "-O2 -std=c++17 -pthread" };
const sources = new Map();
let infoPromise = null;

async function getInfo(force) {
  if (!infoPromise || force) {
    infoPromise = (async () => {
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 2500);
        const r = await fetch(`${RUNNER}/info`, { signal: ctl.signal });
        clearTimeout(timer);
        return r.ok ? await r.json() : null;
      } catch { return null; }
    })();
  }
  return infoPromise;
}
async function getSource(file) {
  if (!sources.has(file)) sources.set(file, fetch(new URL(file, CODE_BASE)).then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.status)))));
  return sources.get(file);
}
const langOf = (file) => (file.endsWith(".cu") ? "cuda" : "cpp");

function helpPanel() {
  return h("div", { class: "run-help", html: tl(
    `<p><strong>Yerel çalıştırıcı bulunamadı.</strong> Kodlar sizin bilgisayarınızda çalışır; bunun için küçük bir yardımcı program gerekir:</p>
     <ol><li><a href="${RUNNER_URL}" download>runner.py</a> dosyasını indirin (Python 3 yeterli, kurulum yok).</li>
     <li>Terminalde çalıştırın: <code>python3 runner.py</code> (Windows: <code>py runner.py</code>). Açık kaldığı sürece bu sayfadaki ▶ düğmeleri çalışır.</li>
     <li>C/C++ için <code>g++</code> veya <code>clang++</code>, CUDA için <code>nvcc</code> (CUDA Toolkit) ve bir NVIDIA GPU gerekir.</li></ol>
     <p class="small muted">Tarayıcı "yerel ağa erişim" izni sorarsa izin verin. Çalıştırıcı sadece 127.0.0.1'i dinler ve sadece bu sitenin isteklerini kabul eder. Safari localhost'a erişime izin vermeyebilir; Chrome, Edge veya Firefox kullanın.</p>`,
    `<p><strong>Local runner not found.</strong> The code runs on your own computer; that needs a small helper program:</p>
     <ol><li>Download <a href="${RUNNER_URL}" download>runner.py</a> (Python 3 is enough, nothing to install).</li>
     <li>Run it in a terminal: <code>python3 runner.py</code> (Windows: <code>py runner.py</code>). While it is open, the ▶ buttons on this page work.</li>
     <li>C/C++ needs <code>g++</code> or <code>clang++</code>; CUDA needs <code>nvcc</code> (the CUDA Toolkit) and an NVIDIA GPU.</li></ol>
     <p class="small muted">If the browser asks for "local network access", allow it. The runner listens only on 127.0.0.1 and accepts requests only from this site. Safari may block access to localhost; use Chrome, Edge or Firefox.</p>`) });
}

function showResult(out, res, info) {
  out.hidden = false;
  out.replaceChildren();
  const where = res.lang === "cuda" ? (info?.gpu ? `GPU: ${info.gpu}` : "GPU") : tl("CPU", "CPU");
  const head = h("div", { class: "run-head" },
    h("span", { class: `run-status ${res.ok ? "ok" : "no"}` }, res.ok ? tl("✓ çalıştı", "✓ ran") : res.stage === "compile" ? tl("✗ derleme hatası", "✗ compile error") : res.stage === "setup" ? tl("✗ kurulum", "✗ setup") : tl("✗ hata", "✗ error")),
    res.cmd ? h("code", { class: "run-cmd" }, res.cmd) : null,
    h("span", { class: "run-time" }, [res.compile_s != null ? tl(`derleme ${res.compile_s.toFixed(1)} s`, `compile ${res.compile_s.toFixed(1)} s`) : "", res.run_s != null ? tl(`çalışma ${(res.run_s * 1000).toFixed(0)} ms`, `run ${(res.run_s * 1000).toFixed(0)} ms`) : "", res.stage === "run" ? where : ""].filter(Boolean).join(" · ")));
  out.append(head);
  if (res.stdout) out.append(h("pre", { class: "run-stdout" }, res.stdout));
  if (res.stderr) out.append(h("pre", { class: "run-stderr" }, res.stderr));
  if (res.exit != null && res.exit !== 0) out.append(h("div", { class: "small muted" }, tl(`çıkış kodu ${res.exit}`, `exit code ${res.exit}`)));
  if (!res.stdout && !res.stderr && res.ok) out.append(h("div", { class: "small muted" }, tl("(çıktı yok)", "(no output)")));
}

export function attachRunner(pre) {
  const file = pre.dataset.run;
  const lang = langOf(file);
  const anchor = pre.closest("figure.codefig") || pre;
  const out = h("div", { class: "run-out", hidden: true, "aria-live": "polite" });
  const runBtn = h("button", { type: "button", class: "btn small primary run-btn" }, tl("▶ Çalıştır", "▶ Run"));
  const editBtn = h("button", { type: "button", class: "btn small", "aria-expanded": "false" }, tl("✎ Düzenle · parametreler", "✎ Edit · parameters"));
  const dl = h("a", { class: "btn small", href: new URL(file, CODE_BASE).href, download: file }, `⤓ ${file}`);
  const tag = h("span", { class: `run-tag ${lang}` }, lang === "cuda" ? tl("CUDA · GPU'da", "CUDA · on the GPU") : tl("C++ · CPU'da", "C++ · on the CPU"));
  const note = pre.dataset.runNote ? h("span", { class: "run-note small muted" }, pre.dataset.runNote) : null;
  const copyBtn = h("button", { type: "button", class: "btn small", title: tl("Gösterilen kodu kopyala", "Copy the code shown") }, tl("⧉ Kopyala", "⧉ Copy"));
  copyBtn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(pre.textContent); copyBtn.textContent = tl("✓ Kopyalandı", "✓ Copied"); }
    catch { copyBtn.textContent = tl("Kopyalanamadı", "Copy failed"); }
    setTimeout(() => { copyBtn.textContent = tl("⧉ Kopyala", "⧉ Copy"); }, 1500);
  });
  const bar = h("div", { class: "run-bar" }, runBtn, editBtn, copyBtn, dl, tag, note);

  // editor (built on first open)
  let editor = null, ta, flagsIn, argsIn;
  async function buildEditor() {
    const src = await getSource(file);
    const info = await getInfo();
    const usage = (src.match(/usage:\s*prog\s*(.*)/) || [])[1] || "";
    ta = h("textarea", { class: "run-src", spellcheck: "false", rows: Math.min(28, src.split("\n").length + 1), "aria-label": tl("Program kaynağı", "Program source") });
    ta.value = src;
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Tab") { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText("    ", s, ta.selectionEnd, "end"); }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
    });
    flagsIn = h("input", { type: "text", class: "run-flags", value: (info?.defaults || FALLBACK_FLAGS)[lang], spellcheck: "false" });
    argsIn = h("input", { type: "text", class: "run-args", placeholder: usage.replace(/\s*\(.*$/, "") || tl("(yok)", "(none)"), spellcheck: "false" });
    const reset = h("button", { type: "button", class: "btn small" }, tl("Sıfırla", "Reset"));
    reset.addEventListener("click", () => { ta.value = src; flagsIn.value = (info?.defaults || FALLBACK_FLAGS)[lang]; argsIn.value = ""; });
    const runHere = h("button", { type: "button", class: "btn small primary" }, tl("▶ Çalıştır (Ctrl+Enter)", "▶ Run (Ctrl+Enter)"));
    runHere.addEventListener("click", run);
    editor = h("div", { class: "run-edit" },
      h("div", { class: "run-fields" },
        h("label", {}, h("span", {}, `${lang === "cuda" ? "nvcc" : "g++"} ${tl("bayrakları", "flags")}`), flagsIn),
        h("label", {}, h("span", {}, tl("program argümanları", "program arguments") + (usage ? ` · ${usage}` : "")), argsIn)),
      ta, h("div", { class: "btn-row" }, runHere, reset));
    bar.after(editor);
  }
  editBtn.addEventListener("click", async () => {
    if (!editor) await buildEditor();
    else editor.hidden = !editor.hidden;
    editBtn.setAttribute("aria-expanded", String(!editor.hidden));
  });

  async function run() {
    runBtn.disabled = true;
    const label = runBtn.textContent;
    runBtn.textContent = tl("… çalışıyor", "… running");
    out.hidden = false;
    out.replaceChildren(h("div", { class: "small muted" }, tl("Derleniyor ve çalıştırılıyor…", "Compiling and running…")));
    try {
      const info = await getInfo(true);
      if (!info) { out.replaceChildren(helpPanel()); return; }
      const open = editor && !editor.hidden;
      const code = open ? ta.value : await getSource(file);
      const body = { name: file, lang, code, flags: open ? flagsIn.value : undefined, args: open ? argsIn.value : undefined };
      const r = await fetch(`${RUNNER}/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const res = await r.json();
      res.lang = lang;
      showResult(out, res, info);
    } catch (e) {
      out.replaceChildren(helpPanel());
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = label;
    }
  }
  runBtn.addEventListener("click", run);
  anchor.after(bar);
  bar.after(out);
}
