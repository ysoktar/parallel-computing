// Pure scoring and tracing. Source text is never executed and essays are always self-assessed.
import { QUESTIONS } from "./mock-exam-questions.js";
export { QUESTIONS };
export const EXAM_MINUTES = 120;
const key=([r,c])=>String(r)+","+String(c);

export function traceSingleThread(){
  const out=[],H=6,W=8,bx=1,by=0,tx=2,ty=1;
  const row=by*2+ty,col=bx*4+tx;
  for(let dy=0;dy<3;dy++){
    const r=row+2*dy;
    if(r<H&&col<W)out.push([r,col]);
  }
  return out;
}
export function traceWholeBlock(){
  const out=[],H=6,W=8;
  for(let ty=0;ty<2;ty++)for(let tx=0;tx<4;tx++){
    const row=1*2+ty,col=1*4+tx;
    for(let j=0;j<2;j++){
      const r=row+2*j;
      if(r<H&&col<W)out.push([r,col]);
    }
  }
  return out.sort(([ar,ac],[br,bc])=>ar-br||ac-bc);
}
export function normalizeCodeToken(value){
  return String(value??"").trim().replace(/\s+/g,"").replace(/;+$/,"");
}
export function scoreAnswer(question,response){
  if(question.type==="essay")return {earned:null,max:question.points,correct:false,manual:true,checks:[]};
  if(question.type==="grid"){
    const expected=new Set(question.grid.expected.map(key));
    const selected=new Set((Array.isArray(response)?response:[]).filter(v=>/^\d+,\d+$/.test(String(v))).map(String));
    const hits=[...selected].filter(k=>expected.has(k)).length;
    const extras=[...selected].filter(k=>!expected.has(k)).length;
    const earned=Math.max(0,Number(((hits-extras)*question.points/expected.size).toFixed(2)));
    return {earned,max:question.points,correct:hits===expected.size&&extras===0,manual:false,
      checks:[{hits,missed:expected.size-hits,extras}],expected:[...expected]};
  }
  const checks=Object.entries(question.answers).map(([slot,valid])=>{
    const actual=normalizeCodeToken(response?.[slot]);
    const correct=actual!==""&&valid.some(v=>normalizeCodeToken(v)===actual);
    return {slot,correct,answer:valid[0]};
  });
  return {earned:Number((checks.filter(x=>x.correct).length*question.points/checks.length).toFixed(2)),
    max:question.points,correct:checks.every(x=>x.correct),manual:false,checks};
}
export function scoreSummary(questions,stored={}){
  let autoEarned=0,manualEarned=0,unassessedPoints=0;
  for(const q of questions){
    const entry=stored[q.id];
    if(!entry?.revealed){unassessedPoints+=q.points;continue;}
    if(q.type==="essay"){
      if(Number.isFinite(entry.selfScore))manualEarned+=Math.max(0,Math.min(q.points,entry.selfScore));
      else unassessedPoints+=q.points;
    }else autoEarned+=scoreAnswer(q,entry.response).earned;
  }
  return {autoEarned:Number(autoEarned.toFixed(2)),manualEarned:Number(manualEarned.toFixed(2)),
    unassessedPoints,totalPossible:questions.reduce((sum,q)=>sum+q.points,0)};
}
