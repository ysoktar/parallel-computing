import { test } from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../scripts/visual-audit.mjs",import.meta.url),"utf8");
test("free browser audit screenshots both sides and checks sheet height in both languages",()=>{
 assert.match(source,/file==="cheatsheet\.html"/);
 assert.match(source,/data-copy-view="front"/);
 assert.match(source,/data-copy-view="back"/);
 assert.match(source,/-copy-front\.png/);
 assert.match(source,/-copy-back\.png/);
 assert.match(source,/sheetRatio/);
});
