// Every lecture subpage stands on its own: an introduction (lead + goals) at the start and questions at the end.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../site/", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const layout = read("js/layout.js");
const ids = [...layout.matchAll(/\{ id: "([^"]+)", title: "[^"]*", title_en: "[^"]*", lec: "L\d", num: "[\d.]+" \}/g)].map((m) => m[1]);

test("the lecture subpages are listed in the site map", () => {
  assert.ok(ids.length >= 25, `only ${ids.length} lecture subpages found`);
});

for (const id of ids) {
  test(`${id}: starts with a lead and ends with questions, in both languages`, () => {
    for (const lang of ["", "en/"]) {
      const src = read(`${lang}${id}.html`);
      const afterH1 = src.slice(src.indexOf("</h1>") + 5).trimStart();
      assert.ok(afterH1.startsWith('<p class="lead">'), `${lang}${id}: no lead right after the title`);
      const quizzes = (src.match(/class="quiz"/g) || []).length;
      assert.ok(quizzes >= 2, `${lang}${id}: ${quizzes} questions`);
      if (!id.endsWith("review")) assert.match(src, /class="callout goals"/, `${lang}${id}: no goals`);
    }
  });
}
