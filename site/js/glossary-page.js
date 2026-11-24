// Glossary page: built from glossary-data.js (the same source as the term popups on the lecture pages).
// One section per category, an A–Z index of all terms, and a search box that filters as you type.
import { TERMS, CATS } from "./glossary-data.js";
import { h, $ } from "./lib/ui.js";
import { EN, t as tl } from "./lib/i18n.js";

const name = (x) => (EN ? x.en : x.tr);
const other = (x) => (EN ? x.tr : x.en);
const root = $("#glossary");
const fold = (s) => s.toLocaleLowerCase(EN ? "en" : "tr").normalize("NFD").replace(/[̀-ͯ]/g, "");

// A–Z index
const sorted = [...TERMS].sort((a, b) => name(a).localeCompare(name(b), EN ? "en" : "tr"));
const az = h("nav", { class: "gloss-az", "aria-label": tl("Alfabetik dizin", "Alphabetical index") },
  ...sorted.map((x) => h("a", { href: `#${x.id}` }, name(x))));

// search
const input = h("input", { type: "search", placeholder: tl("Terim ya da tanımda ara…", "Search terms or definitions…"), "aria-label": tl("Sözlükte ara", "Search the glossary") });
const count = h("span", { class: "small muted" });
const tools = h("div", { class: "gloss-tools" }, input, count);

const sections = [];
for (const [key, cat] of Object.entries(CATS)) {
  const items = TERMS.filter((x) => x.cat === key).sort((a, b) => name(a).localeCompare(name(b), EN ? "en" : "tr"));
  if (!items.length) continue;
  const dl = h("dl", { class: "gloss" });
  const rows = items.map((x) => {
    const dt = h("dt", { id: x.id }, name(x), other(x) !== name(x) ? h("span", { class: "gloss-alt" }, other(x)) : null, h("span", { class: "chip" }, x.lec));
    const dd = h("dd", {}, EN ? x.e : x.d);
    dl.append(dt, dd);
    return { dt, dd, text: fold([x.tr, x.en, x.d, x.e].join(" ")) };
  });
  const h2 = h("h2", {}, name(cat));
  sections.push({ h2, dl, rows });
  root.append(h2, dl);
}
root.before(tools, az);

function filter() {
  const q = fold(input.value.trim());
  let shown = 0;
  for (const s of sections) {
    let any = false;
    for (const r of s.rows) {
      const ok = !q || r.text.includes(q);
      r.dt.hidden = r.dd.hidden = !ok;
      any ||= ok; shown += ok;
    }
    s.h2.hidden = s.dl.hidden = !any;
  }
  count.textContent = tl(`${shown} / ${TERMS.length} terim`, `${shown} / ${TERMS.length} terms`);
}
input.addEventListener("input", filter);
filter();
