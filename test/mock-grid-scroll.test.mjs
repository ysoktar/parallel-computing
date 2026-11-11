import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const ui=readFileSync(new URL("../site/js/mock-exam.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../site/css/style.css",import.meta.url),"utf8");
test("mobile matrix horizontal scrolling does not move its instructions or live status",()=>{
 assert.match(ui,/const gridScroll=node\("div","mock-grid-scroll"\)/);
 assert.match(ui,/gridScroll\.append\(grid\)/);
 assert.match(ui,/wrap\.append\(guide,codeLink,gridScroll,live\)/);
 assert.match(css,/\.mock-grid-scroll\s*\{[^}]*overflow-x:auto/s);
});
