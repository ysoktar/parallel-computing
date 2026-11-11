import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const site = new URL("../site/",import.meta.url);
const file = p=>readFileSync(new URL(p,site),"utf8");
test("both Lab languages embed transpose, synchronization and warp-geometry visualizations",()=>{
 for (const path of ["lab.html","en/lab.html"]) {
  const html=file(path);
  for(const name of ["transpose","barrier","warp-shape"])
   assert.match(html,new RegExp('data-exam-widget="'+name+'"'),path+": "+name);
  assert.match(html,/js\/exam-lab\.js/);
 }
});
test("both language versions describe exactly two exam hours",()=>{
 for(const path of ["exam-midterm2.html","en/exam-midterm2.html"])
  assert.match(file(path),/15:30–17:30/);
});
test("the visual controls use the existing site color variables",()=>{
 const css=file("css/style.css");
 for(const selector of [".exam-lab-controls",".exam-lab-cells",".exam-lab-step",".exam-lab-status"])
  assert.ok(css.includes(selector),selector);
});
