import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("the compact coalescing card uses spare front space so the back stays A4-sized",()=>{
 for(const lang of ["","en/"]){
  const s=read("site/"+lang+"cheatsheet.html");
  const front=s.slice(s.indexOf('data-sheet="front"'),s.indexOf('data-sheet="back"'));
  const back=s.slice(s.indexOf('data-sheet="back"'),s.indexOf('id="copy-ready-end"'));
  assert.match(front,/data-copy-card="7"/);
  assert.doesNotMatch(back,/data-copy-card="7"/);
  assert.match(back,/data-copy-card="8"/);
  assert.match(front,/A\[row\*W\+col\]/);
  assert.match(front,/pitchBytes/);
 }
});
test("A4 source examples do not split CUDA host copy directions in the middle of a word",()=>{
 for(const lang of ["","en/"]){
  const s=read("site/"+lang+"cheatsheet.html");
  const card=s.match(/data-copy-card="2">([\s\S]*?)<\/section>/)?.[1]||"";
  assert.match(card,/cudaMemcpy\(dA,hA,bytes,\n/);
  assert.match(card,/cudaMemcpyHostToDevice\)/);
  assert.match(card,/cudaMemcpy\(hB,dB,bytes,\n/);
  assert.match(card,/cudaMemcpyDeviceToHost\)/);
 }
});
test("free browser screenshot audit rejects oversize desktop A4 sheets",()=>{
 const src=read("scripts/visual-audit.mjs");
 assert.match(src,/entry\.sheetRatio\s*>\s*1\.48/);
 assert.match(src,/A4 page too tall/);
});
