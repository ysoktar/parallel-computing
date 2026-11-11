import { test } from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const site=new URL("../site/",import.meta.url);
const src=path=>readFileSync(new URL(path,site),"utf8");
test("block-wide barrier teaching lives at synchronization section, in both languages",()=>{
 for(const prefix of ["","en/"]){
   const page=src(prefix+"l5-cuda-kernels.html");
   const idx=page.indexOf('data-learning="barrier"');
   assert.ok(idx>=0,prefix+"L5 missing inline barrier");
   const before=page.lastIndexOf("<h2>",idx),after=page.indexOf("<h2>",idx);
   assert.ok(page.slice(before,idx).includes("__syncthreads"),"should be in synchronization section");
   assert.ok(after>idx);
   assert.ok(src(prefix+"exam-midterm2.html").includes('data-learning="barrier"'));
 }
});
test("the barrier control is linked to displayed CUDA source, not a timing claim",()=>{
 const srcCode=src("js/learning-widgets.js");
 assert.match(srcCode,/function mountBarrier\(/);
 assert.match(srcCode,/newBarrier\(/);
 assert.match(srcCode,/stepBarrier\(/);
 assert.match(srcCode,/__syncthreads\(\)/);
 assert.match(srcCode,/barrier:mountBarrier/);
});
