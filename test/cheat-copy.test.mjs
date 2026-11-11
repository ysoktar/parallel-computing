import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src=p=>readFileSync(new URL("../site/"+p,import.meta.url),"utf8");

test("cheat sheet is a complete hand-copyable two-sided A4 reference in both languages",()=>{
 for(const file of ["cheatsheet.html","en/cheatsheet.html"]){
  const html=src(file);
  assert.match(html,/id="copy-ready"/);
  assert.match(html,/class="copy-sheet-page[^"]*"[^>]*data-sheet="front"/);
  assert.match(html,/class="copy-sheet-page[^"]*"[^>]*data-sheet="back"/);
  assert.equal((html.match(/data-copy-card="/g)||[]).length,13,file);
  assert.match(html,/(?:js|\.\.\/js)\/cheat-copy\.js/);
  assert.match(html,/data-copy-view="front"/);
  assert.match(html,/data-copy-view="back"/);
  assert.match(html,/data-copy-view="both"/);
  assert.match(html,/data-copy-zoom/);
  const ready=html.split('id="copy-ready"')[1].split('id="copy-ready-end"')[0];
  assert.match(ready,/__syncthreads\(\)/);
  assert.match(ready,/threadIdx\.y\s*\*\s*blockDim\.x/);
  assert.match(ready,/2304/);
  assert.match(ready,/1029/);
  assert.match(ready,/Mds\[/);
  assert.match(ready,/Nds\[/);
  assert.match(ready,/32\s*B/);
  assert.match(ready,/Amdahl/);
  assert.doesNotMatch(ready,/(?:bank conflict|bank çatışmas).*(?:optimi[sz]|çözüm)/i);
 }
});

test("copy page is legible and complete without JavaScript, with front/back switching on screen",()=>{
 const css=src("css/style.css"),js=src("js/cheat-copy.js");
 for(const name of [".copy-ready",".copy-sheet-page",".copy-sheet-grid",".copy-sheet-code",
  ".copy-sheet-controls","@media print"]) assert.ok(css.includes(name),name);
 assert.match(css,/210mm/);
 assert.match(css,/297mm/);
 assert.match(js,/aria-pressed/);
 assert.match(js,/data-copy-view/);
 assert.match(js,/data-copy-zoom/);
 assert.match(js,/localStorage/); // optional preference persistence, no server.
});
