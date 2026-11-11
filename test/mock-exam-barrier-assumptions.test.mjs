import {test} from "node:test";
import assert from "node:assert/strict";
import {QUESTIONS} from "../site/js/mock-exam-model.js";
test("divergent-barrier question fixes block size so branch divergence actually occurs",()=>{
 const q=QUESTIONS.find(x=>x.id==="divergent-sync");
 assert.ok(q.prompt.includes("blockDim.x=8"));
 assert.ok(q.prompt_en.includes("blockDim.x=8"));
 assert.match(q.solution,/__syncthreads\(\);/);
});
