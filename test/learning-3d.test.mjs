import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {cuda3dIndex} from "../site/js/learning-model.js";
const base=new URL("../site/",import.meta.url);
const file=p=>readFileSync(new URL(p,base),"utf8");
test("3D x-fastest linear indexing follows the lecturer's (16,8,2) example",()=>{
 const a=cuda3dIndex(16,8,2,5,3,1);
 assert.deepEqual(a,{linear:181,warp:5,lane:21,threads:256,planeOffset:128});
 assert.equal(cuda3dIndex(4,4,2,1,0,1).linear,17);
 assert.throws(()=>cuda3dIndex(16,8,2,16,3,1),RangeError);
 assert.throws(()=>cuda3dIndex(32,32,2,0,0,0),RangeError);
});
test("3D explorer appears next to thread hierarchy in both languages",()=>{
 for(const prefix of ["","en/"]){
   const source=file(prefix+"l4-cuda-intro.html"),at=source.indexOf('data-learning="dim3-index"');
   assert.ok(at>source.indexOf("<h2>"),"3D widget missing");
   assert.ok(source.slice(source.lastIndexOf("<h2>",at),at).includes(prefix?"hierarchy":"hiyerarşisi"));
 }
 const js=file("js/learning-widgets.js");
 assert.match(js,/function mountDim3/);
 assert.match(js,/threadIdx.z \* blockDim.x \* blockDim.y/);
});
