import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const root=new URL("../site/", import.meta.url);
const src=path=>readFileSync(new URL(path,root),"utf8");
const pages={
 "l1-performance.html":["amdahl"],
 "l2-patterns.html":["halo"],
 "l3-threads.html":["race"],
 "l4-hierarchy.html":["cuda-index","dim3-index"],
 "l5-indexing.html":["cuda-index","barrier"],
 "l5-tiling.html":["tile"],
 "l6-memory-types.html":["pitch","coalesce-lanes"],
 "coalescing.html":["coalesce-lanes"],
 "coalescing-transpose.html":["transpose"],
 "exam-midterm2.html":["cuda-index","barrier","transpose"],
 "lab.html":["cuda-index"]
};
for (const [path, widgets] of Object.entries(pages)) {
 test(path+" embeds bilingual context-specific interactive exercises with linked source",()=>{
  for(const lang of ["","en/"]) {
   const page=src(lang+path);
   assert.match(page,new RegExp('src="(?:\\.\\./)?js/learning-widgets\\.js"'),lang+path);
   for(const w of widgets) assert.ok(page.includes('data-learning="'+w+'"'),lang+path+": "+w);
   assert.equal((page.match(/data-learning="/g)||[]).length,widgets.length,lang+path);
  }
 });
}
test("new lesson widgets implement interactive reverse code highlight and pinned selection",()=>{
 const js=src("js/learning-widgets.js"),css=src("css/style.css");
 assert.match(js,/mouseenter/);
 assert.match(js,/mouseleave/);
 assert.match(js,/focus/);
 assert.match(js,/click/);
 assert.match(js,/aria-pressed/);
 assert.match(js,/learning-code/);
 assert.match(js,/highlightC/);
 for(const klass of [".learning-code-line",".learning-cell",".learning-cell.is-row",".learning-cell.is-col",
   ".learning-cell.is-active",".learning-matrix",".learning-layout",".learning-dim"])
   assert.ok(css.includes(klass),klass);
});
test("exam length stays 15:30–17:30 in both languages",()=>{
 for(const lang of ["","en/"])assert.match(src(lang+"exam-midterm2.html"),/15:30–17:30/);
});
