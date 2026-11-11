import {test} from "node:test";
import assert from "node:assert/strict";
class N {
 constructor(tag="text",value=""){this.tag=tag;this.children=[];this.style={};this.dataset={};this.attributes={};this.listeners={};this.className="";this._t=value;
  this.classList={toggle:(k,on)=>{const s=new Set(this.className.split(" ").filter(Boolean));on?s.add(k):s.delete(k);this.className=[...s].join(" ");}};}
 append(...a){this.children.push(...a);}
 replaceChildren(...a){this.children=a;}
 replaceWith(x){this.replacement=x;}
 get firstChild(){return this.children[0];}
 setAttribute(k,v){this.attributes[k]=String(v);if(k==="value")this.value=String(v);}
 getAttribute(k){return this.attributes[k];}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
 fire(k){(this.listeners[k]||[]).forEach(fn=>fn());}
 set textContent(s){this._t=String(s);this.children=[];}
 get textContent(){return this._t+this.children.map(x=>x.textContent||"").join("");}
}
const kinds=["amdahl","halo","race","cuda-index","dim3-index","tile","pitch","coalesce-lanes","transpose","barrier"];
const roots=kinds.map(k=>{const n=new N("div");n.dataset.learning=k;return n;});
globalThis.Node=N;
globalThis.document={documentElement:{lang:"en"},createElement:t=>new N(t),createTextNode:v=>new N("text",String(v)),
 querySelectorAll:s=>s==="[data-learning]"?roots:[]};
const all=n=>[n,...n.children.flatMap(all)];
await import("../site/js/learning-widgets.js");
test("every course widget mounts with source code",()=>{
 for(let i=0;i<kinds.length;i++){
  assert.ok(roots[i].replacement,"missing "+kinds[i]);
  assert.ok(all(roots[i].replacement).some(n=>n.className.includes("learning-code-line")),"code missing "+kinds[i]);
 }
});
test("hovering a matrix cell highlights code, clicking pins it, code hover highlights row",()=>{
 const root=roots[kinds.indexOf("cuda-index")].replacement;
 const cells=all(root).filter(n=>n.className.startsWith("learning-cell"));
 assert.ok(cells.length>30);
 const cell=cells[35];
 cell.fire("mouseenter");
 const code=all(root).filter(n=>n.className.includes("learning-code-line"));
 assert.ok(code.some(n=>n.className.includes("is-lit")));
 cell.fire("click");cell.fire("mouseleave");
 assert.equal(cell.getAttribute("aria-pressed"),"true");
 code.find(n=>n.getAttribute("data-role")==="row").fire("mouseenter");
 assert.ok(cells.some(n=>n.className.includes("is-row")));
});
test("3D explorer starts at thread 181 and displays dimensions",()=>{
 const root=roots[kinds.indexOf("dim3-index")].replacement;
 assert.match(root.textContent,/181/);
 assert.ok(all(root).some(n=>n.className==="learning-dim"&&n.textContent.includes("×")));
});
