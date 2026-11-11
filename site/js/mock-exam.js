// The mock exam runs locally in the browser. It does not compile CUDA or send answers to a server.
import {h,highlightC} from "./lib/ui.js";
import {t,EN} from "./lib/i18n.js";
import {QUESTIONS,EXAM_MINUTES,scoreAnswer,scoreSummary} from "./mock-exam-model.js";
import {createHoverGrace} from "./hover-grace.js";

const tr=(a,b)=>t(a,b);
const root=document.getElementById("mock-exam");
const STORE="parallel-computing-written-mock-v1";
const b=(label,action,className="")=>{
 const node=h("button",{type: "button",class:"btn mock-action "+className},label);
 node.addEventListener("click",action);
 return node;
};
const node=(tag,cls,...children)=>h(tag,{class:cls},...children);
const write=(el,value)=>{el.textContent=String(value);};
function restore(){
 try{
  const parsed=JSON.parse(localStorage.getItem(STORE)||"{}");
  return parsed&&typeof parsed==="object"?parsed:{};
 }catch{return {};}
}
const saved=restore();
const answers=(saved.answers&&typeof saved.answers==="object")?saved.answers:{};
let clock=Number.isFinite(saved.clock)&&saved.clock>=0?Math.min(EXAM_MINUTES*60,saved.clock):EXAM_MINUTES*60;
let running=Boolean(saved.running),lastTick=Date.now();
if(running){clock=Math.max(0,clock-Math.floor((Date.now()-(Number(saved.lastTick)||Date.now()))/1000));}
function persist(){
 try{localStorage.setItem(STORE,JSON.stringify({answers,clock,running,lastTick:Date.now()}));}
 catch{/* Storage can be disabled: current-session practice still works. */}
}
const safeEntry=(question)=>{
 const prior=answers[question.id];
 if(!prior||typeof prior!=="object")answers[question.id]={response:question.type==="grid"?[]:
   question.type==="essay"?"":{},revealed:false,selfScore:null,solutionVisible:false};
 return answers[question.id];
};
const cards=new Map();
function sumUI(){
 const s=scoreSummary(QUESTIONS,answers);
 const checked=QUESTIONS.filter(q=>answers[q.id]?.revealed).length;
 write(progress,tr("Kontrol edilen soru: ","Checked questions: ")+checked+"/"+QUESTIONS.length+
  "  •  "+tr("Puan: ","Score: ")+(s.autoEarned+s.manualEarned).toFixed(2)+
  "/"+s.totalPossible+
  (s.unassessedPoints?"  •  "+tr("Henüz değerlendirilmeyen: ","Not yet assessed: ")+s.unassessedPoints:""));
 for(const [id,render] of cards)render();
 persist();
}
function roleOf(line){
 if(/^\s*int\s+row\s*=|^\s*row\s*=/.test(line))return "row";
 if(/^\s*int\s+col\s*=|^\s*col\s*=/.test(line))return "col";
 if(/\bfor\s*\(/.test(line))return "loop";
 if(/\bif\s*\(/.test(line))return "guard";
 if(/A\[|B\[/.test(line))return "access";
 return "";
}
function codeLines(question,entry,rerender){
 const wrap=node("div","mock-code");
 const lines=question.code.split("\n");
 const slots=new Map();
 const roles=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i],row=node("div","mock-code-line");
  const lineNo=node("span","mock-line-no",String(i+1).padStart(2,"0"));
  const body=node("span","mock-code-body");
  const re=/\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g;
  let m,last=0;
  while((m=re.exec(line))){
   if(m.index>last)body.append(h("span",{html:highlightC(line.slice(last,m.index))}));
   const key=m[1],value=entry.response&&typeof entry.response==="object"?entry.response[key]||"":"";
   // Identical placeholder keys are single input fields by design.
   const input=h("input",{type:"text",value,autocomplete:"off",spellcheck:"false",
    class:"mock-inline-input","aria-label":question.labels?.[key]||key,
    placeholder:question.labels?.[key]||"?",size:Math.min(25,Math.max(8,key.length+5))});
   input.addEventListener("input",()=>{
    entry.response[key]=input.value;entry.revealed=false;entry.selfScore=null;entry.solutionVisible=false;
    rerender();sumUI();
   });
   body.append(input);slots.set(key,input);
   last=re.lastIndex;
  }
  if(last<line.length)body.append(h("span",{html:highlightC(line.slice(last))}));
  if(!body.childNodes.length)body.append(document.createTextNode(" "));
  row.append(lineNo,body);
  const role=roleOf(line);
  row.dataset.role=role;
  roles.push(row);
  wrap.append(row);
 }
 return {wrap,slots,roles};
}
function makeGrid(question,entry){
 const {rows,cols}=question.grid;
 const wrap=node("div","mock-grid-wrap");
 const guide=node("p","mock-grid-guide",tr("Satır ↓, sütun →. Hücreye tıklayarak işaretle; tekrar tıklarsan kaldırılır. ",
   "Row ↓, column →. Click a cell to mark it; click again to remove it. "));
 const live=h("span",{"aria-live":"polite",class:"mock-grid-status"});
 const codeLink=node("p","mock-grid-guide",tr("Kod satırlarının veya hücrelerin üzerine gelerek satır/sütun eşleşmesini izle.",
  "Hover source lines or cells to trace the row/column relationship."));
 const grid=node("div","mock-grid");
 grid.style.gridTemplateColumns="repeat("+String(cols+1)+",minmax(0,1fr))";
 const cells=[];
 let hovered=null,codeHover=null,lockedRole=null;
 const grace=createHoverGrace();
 function selected(){return new Set(entry.response);}
 function repaint(){
  const set=selected();
  const chosen=hovered||lastChosen;
  const vr=chosen?.[0]??0,vc=chosen?.[1]??0;
  for(const [r,c,cell] of cells){
   const k=r+","+c;
   cell.className="mock-grid-cell"+
    (set.has(k)?" is-marked":"")+
    (hovered&&hovered[0]===r&&hovered[1]===c?" is-hover":"")+
    ((codeHover||lockedRole)==="row"&&r===vr?" is-row":"")+
    ((codeHover||lockedRole)==="col"&&c===vc?" is-col":"")+
    (entry.solutionVisible&&question.grid.expected.some(p=>p[0]===r&&p[1]===c)?" is-expected":"")+
    (entry.solutionVisible&&set.has(k)&&!question.grid.expected.some(p=>p[0]===r&&p[1]===c)?" is-extra":"");
   cell.setAttribute("aria-pressed",String(set.has(k)));
  }
  for(const line of sourceLines){
   const role=line.dataset.role;
   line.classList.toggle("is-active",Boolean(codeHover||lockedRole)?role===(codeHover||lockedRole):
     Boolean(hovered)&&["row","col","loop","guard","access"].includes(role));
  }
 }
 let lastChosen=[0,0];
 const sourceLines=[];
 function bindCode(lines){
  sourceLines.push(...lines);
  for(const line of lines){
   line.classList.add("mock-code-interactive");
   line.setAttribute("tabindex","0");
   line.addEventListener("mouseenter",()=>grace.enter(()=>{codeHover=line.dataset.role;repaint();}));
   line.addEventListener("mouseleave",()=>grace.leave(()=>{codeHover=null;repaint();}));
   line.addEventListener("focus",()=>grace.enter(()=>{codeHover=line.dataset.role;repaint();}));
   line.addEventListener("blur",()=>grace.leave(()=>{codeHover=null;repaint();}));
   line.addEventListener("click",()=>{lockedRole=lockedRole===line.dataset.role?null:line.dataset.role;repaint();});
  }
  repaint();
 }
 grid.append(node("span","mock-grid-axis","r\\c"));
 for(let c=0;c<cols;c++)grid.append(node("span","mock-grid-axis",String(c)));
 for(let r=0;r<rows;r++){
  grid.append(node("span","mock-grid-axis",String(r)));
  for(let c=0;c<cols;c++){
   const k=r+","+c,cell=h("button",{type: "button",class:"mock-grid-cell",
    "aria-label":tr("Satır "+r+", sütun "+c,"Row "+r+", column "+c),
    "aria-pressed":String(selected().has(k)),
    "aria-keyshortcuts":"ArrowUp ArrowDown ArrowLeft ArrowRight"},String(r*cols+c));
   cell.addEventListener("mouseenter",()=>grace.enter(()=>{hovered=[r,c];repaint();}));
   cell.addEventListener("mouseleave",()=>grace.leave(()=>{hovered=null;repaint();}));
   cell.addEventListener("focus",()=>grace.enter(()=>{hovered=[r,c];repaint();}));
   cell.addEventListener("blur",()=>grace.leave(()=>{hovered=null;repaint();}));
   cell.addEventListener("click",()=>{
     const set=selected();
     if(set.has(k))set.delete(k);else set.add(k);
     lastChosen=[r,c];entry.response=[...set];
     entry.revealed=false;entry.selfScore=null;entry.solutionVisible=false;
     write(live,tr("İşaretlenen hücre: ","Marked cells: ")+set.size);
     repaint();sumUI();
   });
   cell.addEventListener("keydown",ev=>{
     const dirs={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]};
     const d=dirs[ev.key];if(!d)return;
     ev.preventDefault();
     const nr=Math.max(0,Math.min(rows-1,r+d[0])),nc=Math.max(0,Math.min(cols-1,c+d[1]));
     cells.find(([rr,cc])=>rr===nr&&cc===nc)?.[2].focus();
   });
   grid.append(cell);cells.push([r,c,cell]);
  }
 }
 wrap.append(guide,codeLink,grid,live);
 repaint();
 return {wrap,repaint,bindCode};
}
function makeQuestion(question,i){
 const entry=safeEntry(question);
 const card=h("section",{class:"mock-question",id:"question-"+question.id,"data-question":question.id});
 const top=node("div","mock-question-head",
  node("span","mock-question-number",String(i+1).padStart(2,"0")),
  node("div","mock-question-title",
   h("h2",{},EN?question.title_en:question.title),
   node("p","mock-meta",question.topic+"  •  "+question.points+" "+tr("puan","points")+"  •  "+question.minutes+" "+tr("dk","min"))));
 card.append(top,node("p","mock-prompt",EN?question.prompt_en:question.prompt));
 const feedback=h("div",{class:"mock-feedback","aria-live":"polite"});
 const resultBox=node("div","mock-solution");
 const {wrap:source,slots,roles}=codeLines(question,entry,()=>{});
 let grid=null,essay=null,manualSlider=null,manualLabel=null;
 if(question.type==="grid"){
  grid=makeGrid(question,entry);
  card.append(node("div","mock-workspace",source,grid.wrap));
  grid.bindCode(roles);
 }else{
  card.append(source);
  if(question.type==="essay"){
   essay=h("textarea",{class:"mock-essay",rows:"9",spellcheck:"false",
    placeholder:tr("Cevabını veya düzeltilmiş kodunu buraya yaz...",
      "Write your explanation or corrected code here..."),
    "aria-label":tr("Açık uçlu yanıt","Free-response answer")});
   essay.value=typeof entry.response==="string"?entry.response:"";
   essay.addEventListener("input",()=>{entry.response=essay.value;entry.revealed=false;
     entry.selfScore=null;entry.solutionVisible=false;renderFeedback();sumUI();});
   card.append(h("label",{class:"mock-answer-label"},tr("Senin yanıtın:","Your answer:"),essay));
  }
 }
 const actions=node("div","mock-actions");
 const hintBox=node("p","mock-hint");
 let hintShown=false;
 actions.append(
  b(tr("İpucu","Hint"),()=>{hintShown=!hintShown;hintBox.hidden=!hintShown;}, "secondary"),
  b(question.type==="essay"?tr("Ölçütleri göster","Show rubric"):tr("Kontrol et","Check"),()=>{
    entry.revealed=true;renderFeedback();sumUI();
  }, "primary"),
  b(tr("Çözümü göster / gizle","Show / hide solution"),()=>{
    entry.revealed=true;entry.solutionVisible=!entry.solutionVisible;renderFeedback();sumUI();
  },"secondary")
 );
 hintBox.textContent=EN?question.hint_en:question.hint;
 hintBox.hidden=true;
 card.append(actions,hintBox,feedback,resultBox);
 function renderFeedback(){
  const visible=Boolean(entry.revealed);
  feedback.hidden=!visible;
  resultBox.hidden=!visible;
  if(!visible){resultBox.replaceChildren();if(grid)grid.repaint();return;}
  const assessment=scoreAnswer(question,entry.response);
  feedback.className="mock-feedback "+(assessment.manual?"needs-review":assessment.correct?"correct":"partial");
  if(assessment.manual){
   write(feedback,tr("Bu açık uçlu kod/yorum yanıtı otomatik çalıştırılmadı. Aşağıdaki ölçüte göre kendin puan ver.",
    "This code/prose answer was not compiled or automatically graded. Use the rubric to self-assess."));
  }else{
   const count=assessment.checks.filter(x=>x.correct).length;
   write(feedback,assessment.earned.toFixed(2)+"/"+question.points+" "+
    tr("puan","points")+(question.type==="grid"?
    "  ·  "+assessment.checks[0].hits+" "+tr("doğru, ","correct, ")+assessment.checks[0].missed+
      tr(" eksik, "," missed, ")+assessment.checks[0].extras+tr(" fazla hücre"," extra cells"):
    "  ·  "+count+"/"+assessment.checks.length+tr(" doğru alan"," correct fields")));
  }
  resultBox.replaceChildren();
  const rubric=node("p","mock-rubric",EN?question.rubric_en:question.rubric);
  resultBox.append(node("h3","",tr("Puanlama ölçütü","Marking rubric")),rubric);
  if(!assessment.manual&&question.type!=="grid"){
   for(const c of assessment.checks){
    resultBox.append(node("p",c.correct?"mock-check-ok":"mock-check-wrong",
      (c.correct?"✓ ":"✗ ")+c.slot+": "+(c.correct?tr("doğru","correct"):tr("tekrar dene","try again"))));
   }
  }
  if(assessment.manual){
   const rangeLabel=h("label",{class:"mock-manual-label"},tr("Kendime verdiğim puan: ","Self-awarded points: "));
   manualSlider=h("input",{type:"range",min:"0",max:String(question.points),
     step:question.points===10?"1":"1",value:String(entry.selfScore??0)});
   manualLabel=h("output",{},entry.selfScore===null?tr("Henüz verilmedi","Not yet assigned"):String(entry.selfScore));
   manualSlider.addEventListener("input",()=>{write(manualLabel,manualSlider.value);});
   rangeLabel.append(manualSlider,manualLabel);
   resultBox.append(rangeLabel,b(tr("Öz puanı kaydet","Save self-score"),()=>{
     entry.selfScore=Number(manualSlider.value);sumUI();
   },"secondary"));
  }
  if(entry.solutionVisible){
   resultBox.append(node("h3","",tr("Örnek çözüm ve nedenleri","Sample solution and reasoning")),
    h("pre",{class:"mock-solution-code"},h("code",{},EN?question.solution_en:question.solution)));
  }
  if(grid)grid.repaint();
 }
 cards.set(question.id,()=>{
   const done=Boolean(entry.revealed);
   card.classList.toggle("is-checked",done);
 });
 renderFeedback();
 return card;
}
if(root){
 root.classList.add("mock-exam-page");
 const toolbar=node("div","mock-toolbar");
 const timerText=h("span",{class:"mock-timer",role:"timer","aria-live":"off"});
 const progress=h("span",{class:"mock-progress","aria-live":"polite"});
 const start=b(tr("Başlat / sürdür","Start / resume"),()=>{
   if(clock===0)clock=EXAM_MINUTES*60;
   running=true;lastTick=Date.now();updateClock();persist();
 },"primary");
 const pause=b(tr("Duraklat","Pause"),()=>{advanceClock();running=false;updateClock();persist();},"secondary");
 const reset=b(tr("Süreyi sıfırla","Reset timer"),()=>{
   running=false;clock=EXAM_MINUTES*60;updateClock();persist();
 },"secondary");
 toolbar.append(timerText,start,pause,reset,progress);
 const jump=h("nav",{class:"mock-jump","aria-label":tr("Soruya atla","Jump to question")});
 const all=node("div","mock-questions");
 for(let i=0;i<QUESTIONS.length;i++){
  const question=QUESTIONS[i];
  jump.append(b(String(i+1),()=>document.getElementById("question-"+question.id)?.scrollIntoView({behavior:"smooth",block:"start"}),"mock-jump-button"));
  all.append(makeQuestion(question,i));
 }
 const note=node("p","mock-notice",tr(
  "Bu sınav kendi kendine çalışma içindir. CUDA kodu derlenmez. Boşluklar yalnız beklenen yazım kalıplarına göre karşılaştırılır; doğru eşdeğer kod farklı yazılmış olabilir. Yanıtlar yalnızca bu tarayıcıda tutulur.",
  "This is a self-study exam. CUDA code is not compiled. Blanks use limited text matching, so equivalent valid code may use other syntax. Answers stay in this browser only."));
 const clear=b(tr("Bütün yanıtları temizle","Clear all answers"),()=>{
   if(!window.confirm(tr("Bütün sınav yanıtların silinsin mi?","Delete all your exam answers?")))return;
   try{localStorage.removeItem(STORE);}catch{}
   window.location.reload();
 },"danger");
 root.append(toolbar,jump,note,all,clear);
 function updateClock(){
   const mins=String(Math.floor(clock/60)).padStart(2,"0"),secs=String(clock%60).padStart(2,"0");
   write(timerText,tr("Kalan süre: ","Time remaining: ")+mins+":"+secs);
   timerText.classList.toggle("is-over",clock<=0);
 }
 function advanceClock(){
   if(!running)return;
   const now=Date.now(),elapsed=Math.max(0,Math.floor((now-lastTick)/1000));
   if(!elapsed)return;
   lastTick+=elapsed*1000;clock=Math.max(0,clock-elapsed);
   if(clock===0)running=false;
   updateClock();persist();
 }
 updateClock();sumUI();
 window.setInterval(advanceClock,1000);
}
