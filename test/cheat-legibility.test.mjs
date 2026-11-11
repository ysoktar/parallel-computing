import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=p=>readFileSync(new URL("../site/"+p,import.meta.url),"utf8");

test("handcopy reference uses comfortably legible fonts at real A4 screen width",()=>{
 const css=src("css/style.css");
 assert.match(css,/\.copy-sheet-page\s*\{[^}]*font-size:\s*calc\(13px\s*\*\s*var\(--copy-zoom\)\)/s);
 assert.match(css,/\.copy-sheet-code\s*\{[^}]*font:\s*calc\(11\.8px\s*\*\s*var\(--copy-zoom\)\)/s);
});
test("shared transpose formula identifies both swapped block coordinates correctly",()=>{
 for(const lang of ["","en/"]){
  const s=src(lang+"cheatsheet.html");
  const ready=s.slice(s.indexOf('id="copy-ready"'),s.indexOf('id="copy-ready-end"'));
  assert.ok(ready.includes("B[(bx*T+ty)*N + (by*T+tx)] = tile[tx][ty]"),lang);
  assert.ok(ready.includes("tile[ty][tx]"),lang);
 }
});
