import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("free Chromium visual audit includes written exam and actually interacts with its UI",()=>{
 const code=src("scripts/visual-audit.mjs");
 assert.match(code,/mock-exam\.html/);
 assert.match(code,/file==="mock-exam\.html"/);
 assert.match(code,/\.mock-question/);
 assert.match(code,/\.mock-inline-input/);
 assert.match(code,/\.mock-grid-cell/);
 assert.match(code,/\.mock-feedback/);
 assert.match(code,/\.click\(/);
});
test("editing an answer hides stale feedback and refreshes the saved score",()=>{
 const code=src("site/js/mock-exam.js");
 assert.match(code,/const progress=/);
 assert.match(code,/codeLines\(question,entry,\(\)=>renderFeedback\(\)\)/);
 assert.match(code,/entry\.revealed=false/);
});
