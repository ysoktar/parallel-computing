import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const get=p=>readFileSync(new URL("../site/"+p,import.meta.url),"utf8");
test("printed handwritten cheat-sheet heading shows the actual CUDA launch shape, not an HTML tag",()=>{
 for(const path of ["cheatsheet.html","en/cheatsheet.html"]){
  const s=get(path);
  const cards=s.slice(s.indexOf('id="copy-ready"'),s.indexOf('id="copy-ready-end"'));
  assert.match(cards,/&lt;&lt;&lt;dim3\(3,3\), dim3\(8,32\)&gt;&gt;&gt;/);
  assert.doesNotMatch(cards,/<<<dim3\(3,3\), dim3\(8,32\)>>>/);
 }
});
