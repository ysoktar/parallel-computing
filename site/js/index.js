// Home page: part cards built from the site map, and the exam countdown.
import { NAV, EXAM } from "./layout.js";
import { h, $ } from "./lib/ui.js";
import { t as tl, tx } from "./lib/i18n.js";

const parts = $("#parts");
for (const p of NAV.slice(1)) {
  parts.append(h("div", { class: "card" },
    h("div", { class: "card-kicker" }, tx(p, "part") + (p.short ? ` · ${tx(p, "short")}` : "")),
    h("ol", {}, ...p.items.map((it) => h("li", {}, h("a", { href: `${it.id}.html` }, tx(it, "title")), h("div", { class: "small muted" }, tx(it, "desc")))))));
}

const el = $("#countdown");
function tick() {
  const now = Date.now(), d = EXAM.start - now;
  if (now > EXAM.end) { el.textContent = tl("Sınav bitti.", "The exam is over."); return; }
  if (d <= 0) { el.textContent = tl("Sınav şu an devam ediyor.", "The exam is in progress."); return; }
  const hh = Math.floor(d / 3600000), mm = Math.floor((d % 3600000) / 60000);
  el.textContent = tl(`Sınava ${hh} sa ${mm} dk kaldı`, `${hh} h ${mm} min to the exam`);
}
if (el) { tick(); setInterval(tick, 30000); }
