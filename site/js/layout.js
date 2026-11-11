// Site chrome shared by every page: header, navigation, right-hand table of contents, pager, footer, theme,
// callouts, quizzes and code highlighting. Each page only contains its article and loads this module.
import { h, $, $$, CALLOUT_ICONS, highlightC, dedent } from "./lib/ui.js";
import { t as tl, tx, EN } from "./lib/i18n.js";
import { attachRunner } from "./lib/runner.js";

export const REPO = "https://github.com/ysoktar/parallel-computing";
/** Midterm 2: Wednesday 11 November 2026, 15:30–17:30 (Türkiye, UTC+3), room 306. */
export const EXAM = { start: new Date("2026-11-11T15:30:00+03:00"), end: new Date("2026-11-11T17:30:00+03:00") };

/**
 * Site map, in the order of the course. `lec` = lecture slide deck. An item may carry a `scope` key from SCOPES.
 */
export const NAV = [
  { part: "Başlangıç", part_en: "Start", items: [
    { id: "index", title: "Genel bakış", title_en: "Overview", desc: "Dersin konuları ve sitenin kullanımı.", desc_en: "The course topics and how to use the site." },
  ] },
  { part: "Dersler", part_en: "Lectures", short: "Lecture 1–6", items: [
    { id: "l1-intro", title: "Paralel hesaplamaya giriş", title_en: "Introduction", lec: "L1", desc: "Moore, power wall, Flynn, SM/DM, Amdahl, Gustafson.", desc_en: "Moore, power wall, Flynn, SM/DM, Amdahl, Gustafson." },
    { id: "l2-design", title: "Paralel program tasarımı", title_en: "Parallel program design", lec: "L2", desc: "PCAM, ayrıştırma desenleri, program yapısı desenleri.", desc_en: "PCAM, decomposition patterns, program structure patterns." },
    { id: "l3-threads", title: "Thread'ler ve senkronizasyon", title_en: "Threads and synchronization", lec: "L3", desc: "C++11 thread, mutex, semafor, atomik, monitör, future.", desc_en: "C++11 threads, mutexes, semaphores, atomics, monitors, futures." },
    { id: "l4-cuda-intro", title: "GPU ve CUDA'ya giriş", title_en: "GPUs and CUDA", lec: "L4", desc: "SIMT, host/device, thread hiyerarşisi, warp, bellek hiyerarşisi.", desc_en: "SIMT, host/device, thread hierarchy, warps, memory hierarchy." },
    { id: "l5-cuda-kernels", title: "Kernel, indeks, shared memory", title_en: "Kernels, indexing, shared memory", lec: "L5", desc: "cudaMalloc/Memcpy, blockIdx/threadIdx, __syncthreads, CGMA, tiled matmul.", desc_en: "cudaMalloc/Memcpy, blockIdx/threadIdx, __syncthreads, CGMA, tiled matmul." },
    { id: "l6-cuda-memory", title: "Derleme ve bellek türleri", title_en: "Compilation and memory types", lec: "L6", desc: "nvcc/PTX, register/shared limitleri, pitch, local, constant, texture.", desc_en: "nvcc/PTX, register/shared limits, pitch, local, constant, texture." },
    { id: "coalescing", title: "Coalescing, transpose, unrolling", title_en: "Coalescing, transpose, unrolling", lec: "L6", desc: "Global bellek transaction'ları, naive/shared transpose, loop unrolling.", desc_en: "Global memory transactions, naive/shared transpose, loop unrolling." },
  ] },
  { part: "Uygulama", part_en: "Practice", items: [
    { id: "lab", title: "İndeks ve coalescing lab", title_en: "Index & coalescing lab", desc: "Hangi thread hangi elemana dokunur? Kaç transaction?", desc_en: "Which thread touches which element? How many transactions?" },
  ] },
  { part: "Sınav", part_en: "Exams", short: "2. vize", short_en: "Midterm 2", items: [
    { id: "exam-midterm2", title: "2. vize çalışma rehberi", title_en: "Midterm 2 study guide", desc: "Ne bilinmeli, çözümlü sınav tipi sorular, deneme seti.", desc_en: "What to know, worked exam-style problems, a practice set." },
    { id: "cheatsheet", title: "Hazır A4 kopya kâğıdı", title_en: "Ready A4 cheat sheet", desc: "Elle geçirilecek, iki yüzü doldurulmuş A4.", desc_en: "A ready-made two-sided A4 to copy by hand." },
  ] },
];

const ALL = NAV.flatMap((p) => p.items.map((it) => ({ ...it, title: tx(it, "title"), desc: tx(it, "desc"), part: tx(p, "part") })));
export const SCOPES = {
  m2: { label: tl("2. vizenin odağı", "Focus of midterm 2"), tip: tl("CUDA dersleri (Lecture 4–6): 2. vizenin ana konusu.", "The CUDA lectures (4–6): the main subject of midterm 2.") },
  m1: { label: tl("2. vize kapsamında (1. vize konusu)", "On midterm 2 (midterm 1 material)"), tip: tl("Duyuru: dönem başından 10 Kasım dersinin sonuna kadar her şey dahil.", "Announcement: everything from the start of term to the end of the 10 November lecture.") },
};
export const pageInfo = (id) => ALL.find((p) => p.id === id);
export const PAGES = ALL;
const href = (id) => `${id}.html`;
const otherLangHref = (id) => (EN ? `../${href(id)}` : `en/${href(id)}`);

const LOGO = `<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
  <rect x="3" y="3" width="22" height="22" rx="4" fill="none" stroke="var(--accent)" stroke-width="2"/>
  <g fill="var(--accent)"><rect x="7" y="7" width="4" height="4" rx="1"/><rect x="12" y="7" width="4" height="4" rx="1"/><rect x="17" y="7" width="4" height="4" rx="1"/>
  <rect x="7" y="12" width="4" height="4" rx="1"/><rect x="12" y="12" width="4" height="4" rx="1"/><rect x="17" y="12" width="4" height="4" rx="1"/></g>
  <g fill="var(--text-2)"><rect x="7" y="17" width="4" height="4" rx="1"/><rect x="12" y="17" width="4" height="4" rx="1"/><rect x="17" y="17" width="4" height="4" rx="1"/></g></svg>`;

const THEME_ICONS = {
  auto: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 2a6 6 0 0 0 0 12z" fill="currentColor"/></svg>',
  light: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3"/></svg>',
  dark: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z"/></svg>',
};
const THEME_NAMES = EN ? { auto: "Auto", light: "Light", dark: "Dark" } : { auto: "Otomatik", light: "Açık", dark: "Koyu" };
function getTheme() { try { return localStorage.getItem("theme") || "auto"; } catch { return "auto"; } }
function setTheme(t) {
  try { if (t === "auto") localStorage.removeItem("theme"); else localStorage.setItem("theme", t); } catch { /* storage unavailable */ }
  if (t === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
}

let currentSection = -1; // index of the section being read, for the language switch

function buildHeader() {
  const themeBtn = h("button", { class: "icon-btn", type: "button", "aria-label": tl("Renk teması", "Colour theme") });
  const paintTheme = () => {
    const t = getTheme();
    themeBtn.innerHTML = THEME_ICONS[t] + `<span class="label">${THEME_NAMES[t]}</span>`;
    themeBtn.title = tl(`Tema: ${THEME_NAMES[t]} (değiştirmek için tıklayın)`, `Theme: ${THEME_NAMES[t]} (click to change)`);
  };
  themeBtn.addEventListener("click", () => {
    const order = ["auto", "light", "dark"];
    setTheme(order[(order.indexOf(getTheme()) + 1) % 3]);
    paintTheme();
  });
  paintTheme();
  const menu = h("button", { class: "icon-btn menu-btn", type: "button", "aria-label": tl("Menüyü aç", "Open the menu"), "aria-expanded": "false" });
  menu.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" stroke="currentColor" stroke-width="1.8"><path d="M2 4.5h14M2 9h14M2 13.5h14"/></svg>';
  menu.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    menu.setAttribute("aria-expanded", String(open));
  });
  const brand = h("a", { class: "brand", href: "index.html" });
  brand.innerHTML = LOGO;
  brand.append(h("span", { class: "brand-title" }, tl("Paralel Hesaplama", "Parallel Computing")), h("span", { class: "brand-sub" }, tl("BİL 455/533 · 2026 Güz", "BİL 455/533 · Fall 2026")));
  const gh = h("a", { class: "icon-btn", href: REPO, target: "_blank", rel: "noopener", title: tl("GitHub'daki kaynak kod", "Source code on GitHub"), "aria-label": tl("GitHub'daki kaynak kod", "Source code on GitHub") });
  gh.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .2a8 8 0 0 0-2.5 15.6c.4 0 .5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.3 1.9.9 2.4.7 0-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.5 7.5 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.7-3.6 3.9.3.3.5.8.5 1.5v2.2c0 .2.1.5.6.4A8 8 0 0 0 8 .2z"/></svg>';
  const id = document.body.dataset.page || "index";
  const langBtn = h("a", { class: "icon-btn lang-btn", href: otherLangHref(id), hreflang: EN ? "tr" : "en", lang: EN ? "tr" : "en",
    title: EN ? "Bu sayfanın Türkçesi" : "This page in English", "aria-label": EN ? "Türkçe" : "English" });
  langBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6.3"/><path d="M1.7 8h12.6M8 1.7c1.8 1.9 2.6 4 2.6 6.3S9.8 12.4 8 14.3C6.2 12.4 5.4 10.3 5.4 8S6.2 3.6 8 1.7z"/></svg>'
    + `<span class="lang-code">${EN ? "TR" : "EN"}</span>`;
  langBtn.addEventListener("click", () => {
    try {
      localStorage.setItem("lang", EN ? "tr" : "en");
      sessionStorage.setItem("langJump", JSON.stringify({ id, section: currentSection }));
    } catch { /* storage unavailable: the switch still works, from the top of the page */ }
  });
  return h("header", { class: "site-header" }, menu, brand, h("div", { class: "header-spacer" }), h("div", { class: "header-actions" }, langBtn, gh, themeBtn));
}

function buildSidebar(current) {
  const nav = h("nav", { class: "sidebar", "aria-label": tl("Site", "Site") });
  for (const part of NAV) {
    const sec = h("div", { class: "nav-part" }, h("div", { class: "nav-part-title" }, h("span", {}, tx(part, "part")), part.short ? h("span", {}, tx(part, "short")) : null));
    const ol = h("ol");
    for (const it of part.items) {
      const a = h("a", { href: href(it.id) }, h("span", {}, tx(it, "title")), it.lec ? h("span", { class: "nav-book" }, it.lec) : null);
      if (it.id === current) a.setAttribute("aria-current", "page");
      ol.append(h("li", {}, a));
    }
    sec.append(ol);
    nav.append(sec);
  }
  return nav;
}

function buildPager(current) {
  const i = ALL.findIndex((p) => p.id === current);
  if (i < 0) return null;
  const prev = ALL[i - 1], next = ALL[i + 1];
  return h("nav", { class: "pager", "aria-label": tl("Önceki ve sonraki sayfa", "Previous and next page") },
    prev ? h("a", { class: "prev", href: href(prev.id) }, h("span", { class: "dir" }, tl("← Önceki", "← Previous")), h("span", {}, prev.title)) : h("span"),
    next ? h("a", { class: "next", href: href(next.id) }, h("span", { class: "dir" }, tl("Sonraki →", "Next →")), h("span", {}, next.title)) : null);
}

function buildFooter() {
  const f = h("footer", { class: "site-footer" });
  f.innerHTML = EN
    ? `<p>An unofficial study site for BİL 455/533 Parallel Computing (TOBB ETÜ, Fall 2026), following the course slides (Lectures 1–6),
      the exercises and class notes. Where the site goes beyond the slides it says so.</p><p><a href="${REPO}">Source code on GitHub</a>.</p>`
    : `<p>BİL 455/533 Paralel Hesaplama (TOBB ETÜ, 2026 Güz) için hazırlanmış gayriresmî bir çalışma sitesi: ders slaytları (Lecture 1–6),
      alıştırmalar ve ders notları. Slaytların dışına çıkılan yerler ayrıca belirtilir.</p><p><a href="${REPO}">GitHub'daki kaynak kod</a>.</p>`;
  return f;
}

/** "Key idea", "Pitfall", … boxes get their label and icon; hints and answers get a reveal button. */
export function enhanceCallouts(root) {
  const LABELS = EN
    ? { look: "Look closely", discuss: "Think about it", key: "Key idea", gotcha: "Pitfall", try: "Try it", note: "Note", why: "Why it matters", connect: "Connections", example: "Worked example", goals: "By the end of this page you should be able to", beyond: "Not on midterm 2", class: "From class (not in the slides)" }
    : { look: "Dikkat edin", discuss: "Düşünün", key: "Ana fikir", gotcha: "Tuzak", try: "Deneyin", note: "Not", why: "Neden önemli", connect: "Bağlantılar", example: "Çözümlü örnek", goals: "Bu sayfanın sonunda yapabilmeniz gerekenler", beyond: "2. vizede yok", class: "Derste anlatıldı (slaytlarda yok)" };
  for (const c of $$(".callout", root)) {
    const kind = Object.keys(LABELS).find((k) => c.classList.contains(k)) || "note";
    if (!c.querySelector(".callout-label")) {
      const lab = h("div", { class: "callout-label" });
      lab.innerHTML = (CALLOUT_ICONS[kind] || "") + `<span>${c.dataset.label || LABELS[kind]}</span>`;
      c.prepend(lab);
    }
  }
  for (const hint of $$(".hint", root)) {
    if (hint.previousElementSibling?.classList.contains("hint-toggle")) continue;
    hint.hidden = true;
    const label = hint.dataset.label || tl("Çözümü göster", "Show the solution");
    const b = h("button", { type: "button", class: "btn small hint-toggle", "aria-expanded": "false" }, label);
    b.addEventListener("click", () => {
      hint.hidden = !hint.hidden;
      b.setAttribute("aria-expanded", String(!hint.hidden));
      b.textContent = hint.hidden ? label : tl("Gizle", "Hide");
    });
    hint.before(b);
  }
}

/** <pre class="code" data-title="…">…</pre>: dedent, highlight, optional title bar. */
export function enhanceCode(root) {
  for (const pre of $$("pre.code:not([data-ready])", root)) {
    pre.dataset.ready = "1";
    pre.innerHTML = highlightC(dedent(pre.textContent));
    if (pre.dataset.title) {
      const wrap = h("figure", { class: "codefig" }, h("figcaption", {}, pre.dataset.title));
      pre.replaceWith(wrap);
      wrap.append(pre);
    }
    if (pre.dataset.run) attachRunner(pre);
  }
}

/**
 * Quizzes written as
 *   <div class="quiz" data-answer="2"><p>Question</p> <pre class="code">…</pre>
 *     <ol><li data-why="why this option is wrong (or right)">…</li>…</ol><div class="explain">…</div></div>
 * become multiple-choice questions. A wrong choice says why; once answered the explanation and every reason appear.
 */
export function enhanceQuizzes(root = document) {
  let number = $$(".quiz[data-ready]", root).length;
  for (const q of $$(".quiz:not([data-ready])", root)) {
    number++;
    q.dataset.ready = "1";
    const answer = Number(q.dataset.answer);
    const items = $$(":scope > ol > li", q);
    const explain = $(":scope > .explain", q);
    const question = q.querySelector(":scope > p, :scope > .q");
    const extra = $$(":scope > pre, :scope > figure, :scope > table, :scope > .q-context", q);
    const opts = h("div", { class: "quiz-options" });
    const fb = h("div", { class: "quiz-feedback", "aria-live": "polite" });
    const buttons = [];
    const L = (i) => "ABCDEFG"[i];
    const finish = (revealed) => {
      for (const x of buttons) { x.disabled = true; x.classList.remove("wrong"); }
      buttons[answer - 1].classList.add("correct");
      const list = items.map((li, i) => li.dataset.why
        ? `<li class="${i + 1 === answer ? "ok" : "no"}"><strong>${L(i)}</strong> ${i + 1 === answer ? "✓" : "✗"} ${li.dataset.why}</li>` : "").join("");
      fb.innerHTML = `<span class="verdict ${revealed ? "no" : "ok"}">${revealed ? tl(`Doğru cevap: ${L(answer - 1)}.`, `Correct answer: ${L(answer - 1)}.`) : tl("✓ Doğru.", "✓ Correct.")}</span> ${explain ? explain.innerHTML : ""}`
        + (list ? `<ul class="quiz-whys">${list}</ul>` : "");
    };
    items.forEach((li, i) => {
      const b = h("button", { type: "button" }, h("span", { class: "opt-letter" }, L(i)), h("span", { html: li.innerHTML }));
      buttons.push(b);
      b.addEventListener("click", () => {
        const ok = i + 1 === answer;
        if (ok) { finish(false); return; }
        for (const x of buttons) x.classList.remove("wrong");
        b.classList.add("wrong");
        fb.replaceChildren(h("span", { class: "verdict no" }, tl("✗ Değil.", "✗ Not quite.")), " ", h("span", { html: li.dataset.why || tl("Bu seçenek doğru değil.", "This option is not correct.") }), " ",
          h("button", { type: "button", class: "link-btn", onclick: () => finish(true) }, tl("Cevabı göster", "Show the answer")));
      });
      opts.append(b);
    });
    const label = h("div", { class: "quiz-label" }, tl("Soru ", "Question ") + number);
    q.replaceChildren(label, question ? h("div", { class: "quiz-q", html: question.innerHTML }) : "", ...extra, opts, fb);
  }
}

/** Kicker above the H1: part, lecture, scope. */
function buildKicker(info) {
  if (!info || info.id === "index") return null;
  const k = h("div", { class: "kicker" }, h("span", {}, info.part));
  if (info.lec) k.append(h("span", { class: "chip", title: tl("Ders slaytı", "Lecture slides") }, "Lecture " + info.lec.slice(1)));
  const sc = SCOPES[info.scope];
  if (sc) k.append(h("span", { class: "chip scope slides", title: sc.tip }, h("span", { class: "dot" }), sc.label));
  return k;
}

/** On phones, tables become stacked cards: every cell carries its column name (CSS shows it). */
export function labelTables(root) {
  for (const t of $$("table.simple", root)) {
    const heads = $$("thead th", t).map((th) => th.textContent.trim());
    if (!heads.length) continue;
    t.classList.add("stack");
    for (const tr of $$("tbody tr", t)) $$("td", tr).forEach((td, i) => { if (heads[i]) td.dataset.label = heads[i]; });
  }
}

function init() {
  const id = document.body.dataset.page || "index";
  const info = pageInfo(id);
  const main = $("main") || document.body.appendChild(h("main"));
  main.classList.add("main");
  main.id = "content";
  const content = $(".content", main);
  const h1 = $("h1", content);
  const kicker = buildKicker(info);
  if (h1 && kicker) h1.before(kicker);
  const pager = buildPager(id);
  if (pager) content.append(pager);
  content.append(buildFooter());

  const layout = h("div", { class: "layout" }, buildSidebar(id));
  main.replaceWith(layout);
  layout.append(main);
  const scrim = h("div", { class: "scrim", onclick: () => document.body.classList.remove("nav-open") });
  document.body.prepend(h("a", { class: "skip-link", href: "#content" }, tl("İçeriğe geç", "Skip to content")), buildHeader(), scrim);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.body.classList.remove("nav-open"); });

  enhanceCode(content);
  enhanceCallouts(content);
  enhanceQuizzes(content);
  labelTables(content);
  const nav = () => buildPageNav(content, id);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(nav, 0));
  else setTimeout(nav, 0);
  const cur = $(".sidebar [aria-current]"), side = $(".sidebar");
  if (cur && side) side.scrollTop = Math.max(0, cur.offsetTop - side.clientHeight / 2);
}

const slug = (s) => s.toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
const tocText = (hd) => (hd.dataset.toc || hd.textContent).replace(/\s+/g, " ").trim();

/**
 * In-page navigation: "On this page" under the introduction, and a table of contents that stays in view
 * (a right-hand column on wide screens, a bar under the header otherwise) with the section being read highlighted.
 */
function buildPageNav(content, id) {
  const all = $$(":scope > h2, :scope > h3, :scope > section > h2, :scope > section > h3", content).filter((x) => !x.closest(".quiz, .callout"));
  const tree = [];
  for (const hd of all) {
    if (hd.tagName === "H2") tree.push({ hd, subs: [] });
    else if (tree.length) tree[tree.length - 1].subs.push(hd);
  }
  if (tree.length < 3) return;
  const used = new Set($$("[id]").map((e) => e.id));
  for (const hd of all) {
    if (hd.id) continue;
    const base = slug(tocText(hd));
    let s = base, k = 2;
    while (used.has(s)) s = `${base}-${k++}`;
    hd.id = s;
    used.add(s);
  }
  const link = (hd, cls) => h("a", { href: `#${hd.id}`, class: cls || null, "data-target": hd.id }, tocText(hd));

  if (id !== "index" && !$(".page-toc", content)) {
    const toc = h("nav", { class: "page-toc", "aria-label": tl("Bu sayfada", "On this page") }, h("div", { class: "page-toc-title" }, tl("Bu sayfada", "On this page")),
      h("ol", {}, ...tree.map((t) => h("li", {}, link(t.hd)))));
    ($(":scope > .lead", content) || $(":scope > h1", content)).after(toc);
  }

  const info = ALL.find((p) => p.id === id);
  const i = ALL.findIndex((p) => p.id === id);
  const prev = ALL[i - 1], next = ALL[i + 1];
  const railHead = () => info ? h("div", { class: "toc-rail-head" },
    info.lec ? h("span", { class: "toc-rail-ch" }, "Lecture " + info.lec.slice(1)) : null, h("span", { class: "toc-rail-title" }, info.title)) : null;
  const railPager = () => h("nav", { class: "toc-pager", "aria-label": tl("Önceki ve sonraki sayfa", "Previous and next page") },
    prev ? h("a", { href: href(prev.id), class: "prev" }, h("span", { class: "dir" }, tl("← Önceki", "← Previous")), h("span", {}, prev.title)) : null,
    next ? h("a", { href: href(next.id), class: "next" }, h("span", { class: "dir" }, tl("Sonraki →", "Next →")), h("span", {}, next.title)) : null);
  const makeList = () => h("ol", { class: "toc-list" }, ...tree.map((t) => {
    const li = h("li", { "data-section": t.hd.id });
    const row = h("div", { class: "toc-row" }, link(t.hd, "toc-h2"));
    if (t.subs.length) {
      const chev = h("button", { type: "button", class: "toc-chev", "aria-label": `${tocText(t.hd)}: ${tl("alt başlıkları aç/kapat", "open or close the sub-sections")}`, "aria-expanded": "false" },
        h("span", { "aria-hidden": "true" }, "▸"));
      chev.addEventListener("click", (e) => {
        e.stopPropagation();
        li.dataset.user = li.classList.contains("open") ? "closed" : "open";
        spy();
      });
      row.append(chev);
    }
    li.append(row);
    if (t.subs.length) li.append(h("ol", { class: "toc-subs" }, ...t.subs.map((s) => h("li", {}, link(s, "toc-h3")))));
    return li;
  }));
  const toTop = () => h("a", { href: "#", class: "toc-top", onclick: (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); } }, tl("↑ Sayfanın başı", "↑ Top of the page"));
  const rail = h("aside", { class: "toc-rail", "aria-label": tl("İçindekiler", "Contents") }, railHead(), h("div", { class: "page-toc-title" }, tl("İçindekiler", "Contents")), makeList(), toTop(), railPager());
  const main = content.closest(".main");
  main.classList.add("has-rail");
  main.append(rail);

  const label = h("span", { class: "toc-current" });
  const toggle = h("button", { type: "button", class: "toc-toggle", "aria-expanded": "false" }, h("span", { class: "toc-bar-title" }, tl("Bu sayfada", "On this page")), label, h("span", { class: "toc-caret", "aria-hidden": "true" }, "▾"));
  const panel = h("div", { class: "toc-panel", hidden: true }, makeList(), toTop(), railPager());
  const bar = h("div", { class: "toc-bar" }, toggle, panel);
  const setOpen = (open) => { panel.hidden = !open; toggle.setAttribute("aria-expanded", String(open)); };
  toggle.addEventListener("click", () => { setOpen(panel.hidden); if (!panel.hidden) spy(); });
  panel.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".toc-bar")) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  document.body.append(bar);

  const offset = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) + 64;
  let ticking = false;
  const spy = () => {
    ticking = false;
    const top = offset();
    let cur = null, curSub = null;
    for (const t of tree) {
      if (t.hd.getBoundingClientRect().top <= top) { cur = t; curSub = null; for (const s of t.subs) if (s.getBoundingClientRect().top <= top) curSub = s; }
    }
    for (const list of [rail, panel]) {
      for (const li of $$(":scope .toc-list > li", list)) {
        const reading = !!cur && li.dataset.section === cur.hd.id;
        const open = li.dataset.user === "open" || (reading && li.dataset.user !== "closed");
        li.classList.toggle("open", open);
        li.querySelector(".toc-chev")?.setAttribute("aria-expanded", String(open));
        if (!reading && li.dataset.user === "closed") delete li.dataset.user;
      }
      for (const a of $$("a[data-target]", list)) a.classList.toggle("current", a.dataset.target === (curSub || cur?.hd)?.id || a.dataset.target === cur?.hd.id && a.classList.contains("toc-h2"));
    }
    label.textContent = cur ? tocText(curSub || cur.hd) : "";
    currentSection = cur ? tree.indexOf(cur) : -1;
    bar.classList.toggle("show", window.scrollY > 280);
    follow(rail);
    if (!panel.hidden) follow(panel);
  };
  function follow(box) {
    const active = $$("a.current", box).pop();
    if (!active || box.scrollHeight <= box.clientHeight) return;
    const r = active.getBoundingClientRect(), rr = box.getBoundingClientRect();
    if (r.top < rr.top + 30 || r.bottom > rr.bottom - 30) box.scrollTop += r.top - rr.top - rr.height / 2;
  }
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
  try {
    const jump = JSON.parse(sessionStorage.getItem("langJump") || "null");
    sessionStorage.removeItem("langJump");
    if (jump && jump.id === id && jump.section >= 0 && tree[jump.section] && !location.hash) tree[jump.section].hd.scrollIntoView();
  } catch { /* nothing to restore */ }
  spy();
}

init();
