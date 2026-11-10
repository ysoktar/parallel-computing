// Site structure: every navigation entry has a Turkish and an English page, every internal link and #anchor resolves,
// every widget exists, quizzes are well formed, and both language versions have the same sections.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

const site = join(import.meta.dirname, "..", "site");
const load = (dir) => Object.fromEntries(readdirSync(join(site, dir)).filter((f) => f.endsWith(".html")).map((f) => [f, readFileSync(join(site, dir, f), "utf8")]));
const tr = load("."), en = load("en");
const layout = readFileSync(join(site, "js", "layout.js"), "utf8");
const widgets = readFileSync(join(site, "js", "widgets.js"), "utf8");
const navIds = [...layout.matchAll(/\{ id: "([^"]+)"/g)].map((m) => m[1]);

// the same slug rule as layout.js (headings get ids at run time)
const slug = (s) => s.toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const headings = (src) => [...src.matchAll(/<h([23])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/g)].filter((m) => !/\sid=/.test(m[0]));
function anchors(src) {
  const ids = new Set([...src.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const used = new Set(ids);
  for (const m of headings(src)) {
    const base = slug(strip(m[2]));
    let s = base, k = 2;
    while (used.has(s)) s = `${base}-${k++}`;
    used.add(s); ids.add(s);
  }
  return ids;
}

test("every navigation entry has a Turkish and an English page with the right data-page", () => {
  assert.ok(navIds.length >= 10);
  for (const id of navIds) for (const [lang, pages] of [["tr", tr], ["en", en]]) {
    const f = `${id}.html`;
    assert.ok(pages[f], `missing ${lang} page ${f}`);
    assert.match(pages[f], new RegExp(`data-page="${id}"`), `${lang}/${f}`);
  }
});

test("pages declare their language and load the shared layout", () => {
  for (const [f, src] of Object.entries(tr)) { assert.match(src, /<html lang="tr">/, f); assert.match(src, /src="js\/layout\.js"/, f); }
  for (const [f, src] of Object.entries(en)) { assert.match(src, /<html lang="en">/, f); assert.match(src, /src="\.\.\/js\/layout\.js"/, f); }
});

test("internal links and anchors resolve", () => {
  for (const [dir, pages] of [[".", tr], ["en", en]]) for (const [p, src] of Object.entries(pages)) {
    for (const m of src.matchAll(/(?:href|src)="([^"#:]*)(#[^"]*)?"/g)) {
      const [, file, hash] = m;
      if (!file && !hash) continue;
      const target = file || p;
      if (/\.(css|js|svg|png)$/.test(target)) { assert.ok(existsSync(join(site, dir, target)), `${dir}/${p}: ${target}`); continue; }
      assert.ok(pages[target], `${dir}/${p}: broken link ${target}`);
      if (hash && hash.length > 1) assert.ok(anchors(pages[target]).has(decodeURIComponent(hash.slice(1))), `${dir}/${p}: missing anchor ${target}${hash}`);
    }
  }
});

test("the Turkish and English versions have the same number of sections, quizzes and widgets", () => {
  for (const f of Object.keys(tr)) {
    const a = tr[f], b = en[f];
    assert.ok(b, `no English twin for ${f}`);
    assert.equal(headings(a).length, headings(b).length, `${f}: h2/h3 count`);
    assert.equal((a.match(/class="quiz"/g) || []).length, (b.match(/class="quiz"/g) || []).length, `${f}: quizzes`);
    assert.equal((a.match(/data-widget=/g) || []).length, (b.match(/data-widget=/g) || []).length, `${f}: widgets`);
  }
});

test("every data-widget is implemented", () => {
  const known = widgets.match(/const WIDGETS = \{([^}]+)\}/)[1].split(",").map((s) => s.trim());
  for (const pages of [tr, en]) for (const [p, src] of Object.entries(pages)) for (const m of src.matchAll(/data-widget="([^"]+)"/g))
    assert.ok(known.includes(m[1]), `${p}: unknown widget ${m[1]}`);
});

test("quizzes have a valid answer and every option explains itself", () => {
  for (const pages of [tr, en]) for (const [p, src] of Object.entries(pages)) for (const m of src.matchAll(/<div class="quiz" data-answer="(\d)">([\s\S]*?)<\/ol>/g)) {
    const lis = m[2].match(/<li/g) || [];
    assert.ok(Number(m[1]) >= 1 && Number(m[1]) <= lis.length, `${p}: answer ${m[1]} of ${lis.length}`);
    assert.equal((m[2].match(/<li data-why="/g) || []).length, lis.length, `${p}: an option without data-why`);
  }
});

test("the exam date is the announced one", () => {
  assert.match(layout, /2026-11-11T15:30:00\+03:00/);
  assert.match(tr["exam-midterm2.html"], /11 Kasım 2026 Çarşamba, 15:30–17:30 · Derslik 306/);
  assert.match(en["exam-midterm2.html"], /Wednesday 11 November 2026, 15:30–17:30 · Room 306/);
});
