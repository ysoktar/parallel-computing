import {test} from "node:test";
import assert from "node:assert/strict";
import {suggestedAnswerWidth} from "../site/js/mock-field-width.js";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../site/"+p,import.meta.url),"utf8");

test("blank fields have readable defaults and grow for long CUDA expressions",()=>{
 assert.equal(suggestedAnswerWidth(""),22);
 assert.equal(suggestedAnswerWidth("row*W+col"),22);
 assert.ok(suggestedAnswerWidth("blockIdx.x*blockDim.x+threadIdx.x")>=37);
 assert.equal(suggestedAnswerWidth("x".repeat(100)),58);
});

test("exam fields can be dragged wider, expanded by touch, and remain keyboard-friendly",()=>{
 const js=read("js/mock-exam.js");
 const css=read("css/style.css");
 assert.match(js,/mock-inline-input/);
 assert.match(js,/h\("textarea"/);
 assert.match(js,/suggestedAnswerWidth/);
 assert.match(js,/mock-field-expand/);
 assert.match(js,/aria-expanded/);
 assert.match(js,/keydown/);
 assert.match(js,/localStorage/);
 assert.match(css,/\.mock-inline-input\s*\{[^}]*resize:\s*horizontal/s);
 assert.match(css,/\.mock-inline-input\.is-expanded/);
 assert.match(css,/\.mock-field-expand/);
});

test("all A4 syntax symbols are defined near their relevant code in both languages",()=>{
 for(const lang of ["","en/"]){
  const doc=read(lang+"cheatsheet.html");
  const front=doc.slice(doc.indexOf('data-sheet="front"'),doc.indexOf('data-sheet="back"'));
  const back=doc.slice(doc.indexOf('data-sheet="back"'),doc.indexOf('id="copy-ready-end"'));
  for(const token of ["tx", "ty", "blockIdx", "blockDim", "row", "col", "W", "H", "N", "T", "phase", "lane"])
    assert.match(front+back,new RegExp("(?<![A-Za-z])"+token+"\\\\s*(?:=|:|→)"),lang+" "+token);
  assert.ok(doc.includes('data-worked-example="mutex-semaphore"'));
  assert.ok(doc.includes('data-worked-example="lock-timeline"'));
  assert.ok(doc.includes('data-worked-example="producer-consumer"'));
  assert.ok(doc.includes('data-worked-example="deadlock"'));
 }
});

test("semaphore/mutex examples distinguish permit counting, exclusive lock, and deadlock",()=>{
 const tr=read("cheatsheet.html"),en=read("en/cheatsheet.html");
 for(const html of [tr,en]){
  assert.match(html,/std::lock_guard/);
  assert.match(html,/std::counting_semaphore/);
  assert.match(html,/std::unique_lock/);
  assert.match(html,/std::scoped_lock/);
  assert.match(html,/acquire/);
  assert.match(html,/release/);
  assert.match(html,/condition_variable/);
  assert.match(html,/wait/);
  assert.match(html,/notify_one/);
 }
});
