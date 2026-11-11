import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=p=>readFileSync(new URL("../site/"+p,import.meta.url),"utf8");
test("navigation names the completed hand-copy reference, not an empty proposal",()=>{
 const layout=src("js/layout.js");
 assert.match(layout,/title:\s*"Hazır A4 kopya kâğıdı"/);
 assert.match(layout,/title_en:\s*"Ready A4 cheat sheet"/);
 assert.match(src("index.html"),/>hazır kopya kâğıdı<\/a>/);
 assert.match(src("en/index.html"),/>ready cheat sheet<\/a>/);
});
test("lead accurately describes a completed two-sided sheet in both languages",()=>{
 const tr=src("cheatsheet.html"),en=src("en/cheatsheet.html");
 assert.match(tr,/<p class="lead">[^]*?iki yüzü hazırlanmış/);
 assert.match(en,/<p class="lead">[^]*?both sides are prepared/);
});
