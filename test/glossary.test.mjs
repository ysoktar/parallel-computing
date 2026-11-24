// Glossary: well-formed data, every term found by its own name (in both languages), pages link to the glossary page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TERMS, CATS } from "../site/js/glossary-data.js";
import { matchTerms } from "../site/js/lib/glossary.js";

const site = join(import.meta.dirname, "..", "site");

test("glossary data is well formed", () => {
  const ids = new Set();
  for (const t of TERMS) {
    assert.ok(!ids.has(t.id), `duplicate id ${t.id}`); ids.add(t.id);
    assert.ok(CATS[t.cat], `${t.id}: unknown category ${t.cat}`);
    for (const k of ["tr", "en", "d", "e", "lec"]) assert.ok(t[k] && String(t[k]).trim(), `${t.id}: missing ${k}`);
    assert.ok(t.m.length > 0, `${t.id}: no match patterns`);
  }
  assert.ok(TERMS.length >= 100);
});

test("each term's plain patterns are recognised as that term", () => {
  for (const t of TERMS) for (const src of t.m) {
    if (/[\\()[\]?*+|{}]/.test(src)) continue;            // only literal patterns
    const found = matchTerms(`Bu cümlede ${src} geçiyor.`);
    assert.ok(found.length, `${t.id}: "${src}" not found`);
    // a longer pattern of another term may legitimately win (e.g. "bank conflict" over "bank"), but never a shorter one
    if (found[0] !== t.id) {
      const winner = TERMS.find((x) => x.id === found[0]);
      assert.ok(winner.m.some((p) => p.length > src.length), `${t.id}: "${src}" was matched as ${found[0]}`);
    }
  }
});

test("the clock cycle term is found with Turkish suffixes", () => {
  assert.deepEqual(matchTerms("okuma ≈ 400–600 çevrim sürer, yani yüzlerce çevrimi bekler"), ["cycle", "cycle"]);
  assert.deepEqual(matchTerms("warp'ın 32 thread'i"), ["warp", "thread"]);
});

test("the glossary page exists in both languages and the layout annotates other pages", () => {
  for (const f of ["glossary.html", "en/glossary.html"]) assert.match(readFileSync(join(site, f), "utf8"), /glossary-page\.js/);
  assert.match(readFileSync(join(site, "js", "layout.js"), "utf8"), /annotateGlossary\(content\)/);
});
