import { test } from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const css=readFileSync(new URL("../site/css/style.css",import.meta.url),"utf8");
test("source code in narrow panels wraps whole expressions instead of clipping horizontally",()=>{
  const section=css.slice(css.lastIndexOf("/* Source code line wrapping for narrow teaching panels */"));
  assert.ok(section.length>150);
  assert.match(section,/pre\.learning-code\s+code\s*\{[^}]*min-width:\s*0/s);
  assert.match(section,/\.learning-code-line\s*\{[^}]*white-space:\s*pre-wrap/s);
  assert.match(section,/\.learning-code-src\s*\{[^}]*overflow-wrap:\s*anywhere/s);
});
