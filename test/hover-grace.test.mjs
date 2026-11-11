import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHoverGrace, HOVER_GRACE_MS } from "../site/js/hover-grace.js";

test("hover remains visible across the gap until grace elapses", () => {
  const tasks=new Map(); let seq=0, cleared=0;
  const grace=createHoverGrace({delay:350,
    schedule:(fn,ms)=>{assert.equal(ms,350); const id=++seq;tasks.set(id,fn);return id;},
    cancel:id=>tasks.delete(id)});
  assert.equal(HOVER_GRACE_MS,350);
  let active="row 2";
  grace.leave(()=>{active=null;cleared++;});
  assert.equal(active,"row 2");
  const oldTask=[...tasks.keys()][0];
  grace.enter(()=>{active="col 3";});
  assert.equal(tasks.has(oldTask),false);
  assert.equal(active,"col 3");
  assert.equal(cleared,0);
  grace.leave(()=>{active=null;cleared++;});
  const task=[...tasks.values()][0];task();
  assert.equal(active,null);
  assert.equal(cleared,1);
});

test("cancelled timeout must not clear a newer selection", () => {
  const pending=new Map();let id=0, cleared=0;
  const g=createHoverGrace({schedule:(f)=>{const key=++id;pending.set(key,f);return key;},
    cancel:key=>pending.delete(key)});
  g.leave(()=>cleared++);
  g.enter(()=>{});
  for (const f of pending.values()) f();
  assert.equal(cleared,0);
  g.leave(()=>cleared++);
  g.cancel();
  for (const f of pending.values()) f();
  assert.equal(cleared,0);
});

test("linked code, matrix and warp hover handlers share the new grace mechanism",()=>{
  const source=readFileSync(new URL("../site/js/learning-widgets.js",import.meta.url),"utf8");
  assert.match(source,/import\s*\{\s*createHoverGrace\s*\}/);
  assert.match(source,/hoverGrace\.leave/);
  assert.match(source,/hoverGrace\.enter/);
  assert.match(source,/mouse(?:enter|leave)/);
  assert.match(source,/learning-code-line/);
});
