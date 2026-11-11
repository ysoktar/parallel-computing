import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=p=>readFileSync(new URL("../site/"+p,import.meta.url),"utf8");
test("both language exams are fully integrated with navigation, index and study guide",()=>{
 const nav=src("js/layout.js");
 assert.match(nav,/id: "mock-exam"/);
 for(const lang of ["","en/"]){
  const html=src(lang+"mock-exam.html");
  assert.match(html,new RegExp('<html lang="'+(lang?"en":"tr")+'">'));
  assert.match(html,/data-page="mock-exam"/);
  assert.match(html,/mock-exam\.js/);
  assert.match(html,/id="mock-exam"/);
  assert.match(html,/120/);
  assert.match(src(lang+"index.html"),/href="mock-exam\.html"/);
  assert.match(src(lang+"exam-midterm2.html"),/href="mock-exam\.html"/);
  assert.match(src(lang+"cheatsheet.html"),/href="mock-exam\.html"/);
 }
});
test("mock-exam UI supports timer, editable code, keyboard grid, local progress and revealed rubrics",()=>{
 const script=src("js/mock-exam.js");
 for(const required of ["localStorage","textarea","data-question","aria-live","setInterval",
  "scoreSummary","scoreAnswer","role","grid","keydown","rubric","solution","hint"]) assert.ok(script.includes(required),required);
 assert.match(script,/type="button"|type: "button"/);
 const css=src("css/style.css");
 for(const required of [".mock-exam-page",".mock-grid-cell",".mock-code-line",".mock-question",".mock-essay",
  ".mock-progress",".mock-feedback"]) assert.ok(css.includes(required),required);
});
test("cheat sheet now explains worked code tracing and links to writing exam",()=>{
 for(const lang of ["","en/"]){
  const html=src(lang+"cheatsheet.html");
  assert.match(html,/id="worked-examples"/);
  assert.match(html,/href="mock-exam\.html"/);
  assert.match(html,/data-worked-example="single-thread"/);
  assert.match(html,/data-worked-example="block-loop"/);
  assert.match(html,/data-worked-example="mutex-semaphore"/);
  assert.match(html,/data-worked-example="coalescing"/);
  assert.match(html,/data-worked-example="tiled"/);
 }
});
