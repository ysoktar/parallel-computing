import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../site/"+p,import.meta.url),"utf8");
test("cheat sheet explains coalescing with aligned segment counts and transpose addresses in both languages",()=>{
 for(const lang of ["","en/"]){
  const s=read(lang+"cheatsheet.html");
  const a=s.indexOf('data-copy-card="7"');
  const b=s.indexOf('data-copy-card="8"',a);
  const note=s.slice(a,b);
  assert.ok(note.includes("32 B"));
  assert.ok(note.includes("lane"));
  assert.ok(note.includes("pitchBytes"));
  assert.ok(note.includes("row*W+col"));
  const worked=s.slice(s.indexOf('id="cheat-symbols"'));
  assert.ok(worked.includes('data-worked-example="coalescing-trace"'));
  for(const phrase of ["stride", "A[row*W+col]", "B[col*H+row]", "128", "256", "1024"])assert.ok(worked.includes(phrase),lang+": "+phrase);
  assert.match(worked,/\b32 B\b/);
 }
});
