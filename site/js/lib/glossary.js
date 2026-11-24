// Glossary terms in page text: the first occurrence of each term in every section (between two <h2>s) gets a dashed
// underline; hovering, focusing or tapping it shows the definition with a link to the glossary page.
// Code, headings, links, buttons and interactive figures are never annotated.
import { TERMS, CATS } from "../glossary-data.js";
import { EN } from "./i18n.js";

const SKIP = "pre, code, a, h1, h2, h3, h4, button, textarea, input, select, label, svg, script, style, .wgt, .learning-widget, "
  + ".run-bar, .run-out, .run-edit, .gloss-term, .gloss-pop, .kicker, .page-toc, .section-toc, .formula-box, .pager, .site-footer, "
  + ".quiz-label, .countdown-big, .a4, .memmap, .cheat-sheet, .mock-exam";
const BY_ID = new Map(TERMS.map((t) => [t.id, t]));

// one regex for all patterns, longest first so "bank conflict" wins over "bank"; group k ↔ GROUP_TERM[k]
// inner groups become non-capturing so that capture group k is exactly pattern k
const nonCapturing = (src) => src.replace(/\\.|\((?!\?)/g, (m) => (m === "(" ? "(?:" : m));
const PATTERNS = TERMS.flatMap((t) => t.m.map((src) => ({ src: nonCapturing(src), id: t.id }))).sort((a, b) => b.src.length - a.src.length);
const GROUP_TERM = PATTERNS.map((p) => p.id);
const RE = new RegExp(
  "(?<![\\p{L}\\p{N}_])(?:" + PATTERNS.map((p) => `(${p.src})`).join("|") + ")(?:['’]\\p{L}+|e?s)?(?![\\p{L}\\p{N}_])", "giu");

/** The term ids found in a piece of text, in order (used by the tests). */
export function matchTerms(text) {
  RE.lastIndex = 0;
  const out = [];
  for (let m; (m = RE.exec(text));) out.push(GROUP_TERM[m.findIndex((v, i) => i > 0 && v !== undefined) - 1]);
  return out;
}

function wrapMatches(textNode, seen) {
  const text = textNode.nodeValue;
  RE.lastIndex = 0;
  const parts = [];
  let last = 0, m;
  while ((m = RE.exec(text))) {
    const g = m.findIndex((v, i) => i > 0 && v !== undefined);
    const id = GROUP_TERM[g - 1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    parts.push([m.index, m.index + m[0].length, id]);
  }
  if (!parts.length) return;
  const frag = document.createDocumentFragment();
  for (const [a, b, id] of parts) {
    if (a > last) frag.append(text.slice(last, a));
    const span = document.createElement("span");
    span.className = "gloss-term";
    span.tabIndex = 0;
    span.dataset.gloss = id;
    span.textContent = text.slice(a, b);
    frag.append(span);
    last = b;
  }
  if (last < text.length) frag.append(text.slice(last));
  textNode.replaceWith(frag);
}

/** Annotate the page content. A new <h2> starts a new section: terms are underlined again once per section. */
export function annotateGlossary(content) {
  let section = 0;
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.nodeType === 1) {
        if (node.tagName === "H2") { section++; return NodeFilter.FILTER_REJECT; }
        return node.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
      }
      return node.nodeValue.trim().length > 1 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  // collect first (the walker must not see the spans we insert); the walk is in document order, so the section
  // counter tells which <h2> each text node comes after
  const texts = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push([n, section]);
  const seen = new Set();
  let current = -1;
  for (const [n, sec] of texts) {
    if (sec !== current) { seen.clear(); current = sec; }
    wrapMatches(n, seen);
  }
  setupPopup();
}

// ---------------------------------------------------------------- the popup
let pop, owner = null, hideTimer = null, pinned = false;
function setupPopup() {
  if (pop) return;
  pop = document.createElement("div");
  pop.className = "gloss-pop";
  pop.setAttribute("role", "tooltip");
  pop.hidden = true;
  document.body.append(pop);
  pop.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  pop.addEventListener("mouseleave", () => { if (!pinned) scheduleHide(); });
  const target = (e) => e.target.closest?.(".gloss-term");
  document.addEventListener("mouseover", (e) => { const t = target(e); if (t && !pinned) show(t); });
  document.addEventListener("mouseout", (e) => { const t = target(e); if (t && t === owner && !pinned) scheduleHide(); });
  document.addEventListener("focusin", (e) => { const t = target(e); if (t) show(t); });
  document.addEventListener("focusout", (e) => { const t = target(e); if (t && !pinned) scheduleHide(); });
  document.addEventListener("click", (e) => {
    const t = target(e);
    if (t) { e.preventDefault(); if (owner === t && pinned) { hide(); } else { show(t); pinned = true; } return; }
    if (!e.target.closest(".gloss-pop")) hide();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
  window.addEventListener("scroll", () => { if (owner && !pop.hidden) place(owner); }, { passive: true });
}
function show(span) {
  clearTimeout(hideTimer);
  const t = BY_ID.get(span.dataset.gloss);
  if (!t) return;
  owner = span;
  const cat = CATS[t.cat];
  pop.innerHTML = "";
  const head = document.createElement("div");
  head.className = "gloss-pop-head";
  head.innerHTML = `<strong></strong><span class="gloss-pop-meta"></span>`;
  head.firstChild.textContent = EN ? t.en : t.tr;
  head.lastChild.textContent = `${EN ? cat.en : cat.tr} · ${t.lec}`;
  const body = document.createElement("p");
  body.textContent = EN ? t.e : t.d;
  const link = document.createElement("a");
  link.href = `glossary.html#${t.id}`;
  link.textContent = EN ? "Open in the glossary →" : "Sözlükte aç →";
  pop.append(head, body, link);
  pop.hidden = false;
  span.setAttribute("aria-describedby", "gloss-pop");
  pop.id = "gloss-pop";
  place(span);
}
function place(span) {
  const r = span.getBoundingClientRect();
  const w = Math.min(360, window.innerWidth - 24);
  pop.style.width = w + "px";
  let left = window.scrollX + r.left + r.width / 2 - w / 2;
  left = Math.max(window.scrollX + 12, Math.min(left, window.scrollX + window.innerWidth - w - 12));
  const below = r.bottom + 8 + pop.offsetHeight < window.innerHeight;
  pop.style.left = left + "px";
  pop.style.top = (below ? window.scrollY + r.bottom + 8 : window.scrollY + r.top - pop.offsetHeight - 8) + "px";
}
function scheduleHide() { clearTimeout(hideTimer); hideTimer = setTimeout(hide, 220); }
function hide() { clearTimeout(hideTimer); pinned = false; if (pop) pop.hidden = true; if (owner) owner.removeAttribute("aria-describedby"); owner = null; }
