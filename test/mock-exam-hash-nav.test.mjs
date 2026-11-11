import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const code=readFileSync(new URL("../site/js/mock-exam.js",import.meta.url),"utf8");
test("static cheat-sheet links scroll to dynamically mounted exam question after hydration",()=>{
 assert.match(code,/location\.hash/);
 assert.match(code,/requestAnimationFrame/);
 assert.match(code,/document\.getElementById\(targetId\)\?\.scrollIntoView/);
});
