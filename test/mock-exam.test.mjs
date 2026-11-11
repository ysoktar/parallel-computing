import { test } from "node:test";
import assert from "node:assert/strict";
import { QUESTIONS, EXAM_MINUTES, scoreAnswer, traceSingleThread, traceWholeBlock,
  scoreSummary, normalizeCodeToken } from "../site/js/mock-exam-model.js";

test("the written exam is a two-hour 100-point bilingual paper with 12 substantial questions",()=>{
 assert.equal(EXAM_MINUTES,120);
 assert.equal(QUESTIONS.length,12);
 assert.equal(QUESTIONS.reduce((n,q)=>n+q.points,0),100);
 assert.equal(new Set(QUESTIONS.map(q=>q.id)).size,12);
 for(const q of QUESTIONS){
  for(const key of ["title","title_en","prompt","prompt_en","hint","hint_en","solution",
    "solution_en","rubric","rubric_en"])assert.ok(q[key]?.length>15,q.id+": "+key);
  assert.ok(["blanks","numbers","grid","essay"].includes(q.type),q.id+": "+q.type);
  assert.ok(q.code?.length>20,q.id+" missing source code");
  if(q.type==="blanks"||q.type==="numbers"){
   assert.ok(Object.keys(q.answers).length>=2,q.id+" needs multiple answer slots");
   assert.deepEqual(Object.keys(q.answers).sort(),Object.keys(q.labels).sort());
   for(const [key,values] of Object.entries(q.answers)){
     assert.ok(values.length>0,q.id+" empty answers for "+key);
     assert.ok(q.code.includes("{{"+key+"}}"),q.id+" lacks editable placeholder "+key);
   }
  }
  if(q.type==="grid")assert.ok(q.grid?.rows>0&&q.grid?.cols>0&&q.grid?.expected.length>0);
 }
 assert.ok(QUESTIONS.filter(q=>/mutex|sema|race|lock|deadlock/i.test(q.id+" "+q.code)).length>=3);
 assert.ok(QUESTIONS.filter(q=>/cuda|tile|transpose|coalesc|index/i.test(q.id+" "+q.code)).length>=6);
 assert.ok(QUESTIONS.filter(q=>q.type==="essay").length>=2);
 assert.equal(QUESTIONS.filter(q=>q.type==="grid").length,2);
});
test("single fixed CUDA thread + for loop traces exactly three locations",()=>{
 assert.deepEqual(traceSingleThread(),[[1,6],[3,6],[5,6]]);
});
test("a fixed block's 8 threads each write two rows with a loop, within H and W",()=>{
 const result=traceWholeBlock();
 assert.equal(result.length,16);
 assert.ok(result.every(([r,c])=>r>=2&&r<=5&&c>=4&&c<=7));
 assert.deepEqual(result.slice(0,4),[[2,4],[2,5],[2,6],[2,7]]);
 assert.ok(result.some(([r,c])=>r===5&&c===7));
});
test("blank answers are checked one by one with partial credit, harmless formatting variation",()=>{
 const q=QUESTIONS.find(q=>q.id==="cuda-kernel");
 const exact=Object.fromEntries(Object.entries(q.answers).map(([k,v])=>[k,v[0]]));
 assert.equal(scoreAnswer(q,exact).earned,q.points);
 const partial={...exact,[Object.keys(exact)[0]]:"deliberately_wrong"};
 const result=scoreAnswer(q,partial);
 assert.ok(result.earned>0&&result.earned<q.points);
 assert.equal(result.correct, false);
 assert.equal(normalizeCodeToken(" ( row * W + col ) ; "),normalizeCodeToken("(row*W+col);"));
});
test("grid marking never gives full score for extra cells or missing cells",()=>{
 for(const q of QUESTIONS.filter(q=>q.type==="grid")){
  const expected=q.grid.expected.map(x=>x.join(","));
  const exact=scoreAnswer(q,expected);
  assert.equal(exact.earned,q.points);
  assert.equal(exact.correct,true);
  const missing=scoreAnswer(q,expected.slice(1));
  assert.ok(missing.earned<q.points);
  const extra=scoreAnswer(q,[...expected,"0,0"]);
  assert.ok(extra.earned<q.points);
  assert.equal(scoreAnswer(q,[]).earned,0);
 }
});
test("free code and prose must be self-graded, never syntax-scored as if compiled",()=>{
 for(const q of QUESTIONS.filter(q=>q.type==="essay")){
  const result=scoreAnswer(q,"some CUDA snippet");
  assert.equal(result.earned,null);
  assert.equal(result.manual,true);
 }
});
test("reported score distinguishes graded answers and self-assessed answers",()=>{
 const values={};
 const q=QUESTIONS.find(q=>q.id==="cuda-kernel");
 values[q.id]={response:Object.fromEntries(Object.entries(q.answers).map(([k,v])=>[k,v[0]])),revealed:true};
 const summary=scoreSummary(QUESTIONS,values);
 assert.equal(summary.autoEarned,q.points);
 assert.equal(summary.manualEarned,0);
 assert.ok(summary.unassessedPoints>0);
 assert.ok(summary.totalPossible===100);
});
