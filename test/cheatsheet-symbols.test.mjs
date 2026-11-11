import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../site/"+p,import.meta.url),"utf8");

test("handwritten A4 cards define indices, tile phases and Amdahl symbols locally",()=>{
 for(const p of ["cheatsheet.html","en/cheatsheet.html"]){
  const html=read(p);
  const card=n=>html.match(new RegExp('data-copy-card="'+n+'">([\\s\\S]*?)</section>'))?.[1]??"";
  for(const [n,parts] of [
   [1,["threadIdx", "blockDim", "blockIdx", "W=", "H=", "tx", "ty"]],
   [3,["T=", "m=", "k=", "tx=", "ty="]],
   [7,["pitchBytes", "lane"]],
   [8,["bx=", "by=", "tx=", "ty="]],
   [13,["f=", "a=", "N="]]
  ]) for(const part of parts) assert.ok(card(n).includes(part),p+" card "+n+" missing "+part);
 }
});
test("extended glossary defines all variable names and old concurrency primitives",()=>{
 for(const p of ["cheatsheet.html","en/cheatsheet.html"]){
  const html=read(p);
  const a=html.indexOf('id="cheat-symbols"'),b=html.indexOf('id="worked-examples"');
  assert.ok(a>0&&b>a);
  const glossary=html.slice(a,b);
  for(const name of ["blockIdx","blockDim","threadIdx","row","col","W","H",
   "N","T","phase","k","tx","ty","lane","warp","pitchBytes","bytes",
   "f","a","mutex","semaphore","lock_guard","unique_lock","condition_variable"]){
    assert.ok(glossary.includes(name),p+" glossary missing "+name);
  }
 }
});
