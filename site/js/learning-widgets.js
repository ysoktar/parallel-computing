// Topic-local, code-linked exercises for the BİL 455/533 lecture pages.
// Hover/focus previews, click pins; hovering a source line highlights the corresponding data.
import { h, highlightC } from "./lib/ui.js";
import { newBarrier, stepBarrier } from "./exam-model.js";
import { t } from "./lib/i18n.js";
import { amdahl, matrixIndex, cudaCell, haloCell, raceInit, raceStep,
  tiledLoads, pitchedCell, transposeCell, warpSegments } from "./learning-model.js";

const lang=(tr,en)=>t(tr,en);
const elt=(tag,cls,...children)=>h(tag,{class:cls},...children);
const text=(label,value)=>elt("p","learning-fact",h("strong",{},label+" "),h("code",{},String(value)));
const button=(name,action)=>{const b=h("button",{type:"button",class:"btn small"},name);b.addEventListener("click",action);return b;};
const number=(name,value,min,max,act)=>{
 const el=h("input",{type:"number",min,max,value,step:1,"aria-label":name});
 el.addEventListener("change",()=>{const v=Math.max(min,Math.min(max,Math.trunc(Number(el.value)||0)));el.value=v;act(v);});
 return {input:el,el:h("label",{},name,el)};
};
const options=(name,choices,initial,act)=>{
 const el=h("select",{"aria-label":name},...choices.map(([id,title])=>h("option",{value:id,selected:String(id)===String(initial)},title)));
 el.addEventListener("change",()=>act(el.value));
 return {input:el,el:h("label",{},name,el)};
};
function lesson(root,title,description,source){
 const controls=elt("div","learning-controls"),figure=elt("div","learning-figure"),facts=elt("div","learning-facts");
 const code=h("pre",{class:"learning-code"},h("code"));
 const codeRoot=code.firstChild;
 let codeChanged=()=>{},hoverRole=null,lockedRole=null,activeRoles=[];
 const codeLines=source.map((line,i)=>{
   const b=h("button",{class:"learning-code-line",type:"button","data-role":line.role||"generic",
     title:lang("Üzerine gelerek bağlı görselleştirmeyi vurgula","Hover to highlight the corresponding visualization")},
     h("span",{class:"learning-line-no"},String(i+1).padStart(2,"0")),
     h("span",{class:"learning-code-src",html:highlightC(line.code)}));
   b.addEventListener("mouseenter",()=>{hoverRole=line.role;codeChanged(hoverRole);refresh();});
   b.addEventListener("mouseleave",()=>{hoverRole=null;codeChanged(lockedRole);refresh();});
   b.addEventListener("focus",()=>{hoverRole=line.role;codeChanged(hoverRole);refresh();});
   b.addEventListener("blur",()=>{hoverRole=null;codeChanged(lockedRole);refresh();});
   b.addEventListener("click",()=>{lockedRole=lockedRole===line.role?null:line.role;codeChanged(lockedRole);refresh();});
   codeRoot.append(b);return b;
 });
 function refresh(){
   const roles=hoverRole?[hoverRole]:(lockedRole?[lockedRole]:activeRoles);
   codeLines.forEach((b,i)=>b.classList.toggle("is-lit",roles.includes(source[i].role)));
   codeLines.forEach((b,i)=>b.setAttribute("aria-pressed",lockedRole===source[i].role&&
     source[i].role!=="generic"?"true":"false"));
 }
 const frame=elt("div","learning-layout",
   elt("div","learning-visual",controls,figure,facts),
   elt("div","learning-source",
     elt("div","learning-source-label",lang("Kodla bağlantılı gösterim • Kodun üzerine de gelebilirsin","Code-linked view • Hover the source too")),
     code));
 const heading=elt("div","learning-title",title);
 const intro=elt("p","learning-intro",description);
 const wrap=elt("section","learning-widget",heading,intro,frame);
 root.replaceWith(wrap);
 return {controls,figure,facts,
   onCode(fn){codeChanged=fn;},
   light(roles){activeRoles=Array.isArray(roles)?roles:[roles];refresh();},
   setFacts(...nodes){facts.replaceChildren(...nodes);}};
}
// Generates labelled rows and columns with keyboard-accessible, clickable cells.
// Reuses the nodes on hover (no hover-triggered DOM removal).
function matrix(host,R,C,events={},{value=(r,c)=>r*C+c}={}){
 const frame=elt("div","learning-matrix-wrap"),label=elt("div","learning-dim",`${R} × ${C}`),
   grid=elt("div","learning-matrix");
 grid.style.gridTemplateColumns=`repeat(${C+1},minmax(0,1fr))`;
 const cells=[];
 const corner=elt("div","learning-axis learning-axis-corner","r\\c");
 grid.append(corner);
 for(let c=0;c<C;c++){
   const b=h("button",{type:"button",class:"learning-axis",title:`col ${c}`},c);
   b.addEventListener("mouseenter",()=>events.preview?.(null,c,"col"));
   b.addEventListener("mouseleave",()=>events.clear?.());
   b.addEventListener("focus",()=>events.preview?.(null,c,"col"));
   b.addEventListener("blur",()=>events.clear?.());
   b.addEventListener("click",()=>events.pickColumn?.(c));
   grid.append(b);
 }
 for(let r=0;r<R;r++){
   const axis=h("button",{type:"button",class:"learning-axis",title:`row ${r}`},r);
   axis.addEventListener("mouseenter",()=>events.preview?.(r,null,"row"));
   axis.addEventListener("mouseleave",()=>events.clear?.());
   axis.addEventListener("focus",()=>events.preview?.(r,null,"row"));
   axis.addEventListener("blur",()=>events.clear?.());
   axis.addEventListener("click",()=>events.pickRow?.(r));
   grid.append(axis);
   for(let c=0;c<C;c++){
     const b=h("button",{type:"button",class:"learning-cell","aria-label":`row ${r}, col ${c}`},value(r,c));
     b.addEventListener("mouseenter",()=>events.preview?.(r,c,"cell"));
     b.addEventListener("mouseleave",()=>events.clear?.());
     b.addEventListener("focus",()=>events.preview?.(r,c,"cell"));
     b.addEventListener("blur",()=>events.clear?.());
     b.addEventListener("click",()=>events.pick?.(r,c));
     grid.append(b);cells.push({r,c,b});
   }
 }
 frame.append(label,grid);host.append(frame);
 return {cells,mark(fn){
   for(const {r,c,b} of cells){
     const styles=fn(r,c)||[];
     b.className="learning-cell "+styles.join(" ");
     b.setAttribute("aria-pressed",styles.includes("is-pinned")?"true":"false");
   }
 },label};
}
function paintMatrix(m,view,pinned,role,extras=()=>[]){
 m.mark((r,c)=>{
   const classes=extras(r,c);
   if(r===pinned.r&&c===pinned.c)classes.push("is-pinned");
   if(role==="row"){if(r===view.r)classes.push("is-row");}
   else if(role==="col"){if(c===view.c)classes.push("is-col");}
   else {
     if(r===view.r)classes.push("is-row");
     if(c===view.c)classes.push("is-col");
     if(r===view.r&&c===view.c)classes.push("is-active");
   }
   return classes;
 });
}
function mountAmdahl(root){
 const p=lesson(root,lang("Amdahl: tahmin et, sonra kaydır","Amdahl: predict, then adjust"),
   lang("Paralelleşebilen payı ve işçi sayısını değiştir. Seri ve paralel süreyi kodun satırlarıyla eşleştir.",
     "Change the parallel fraction and worker count. Match serial and parallel time to their code lines."),[
   {role:"serial",code:"double serial = 1.0 - fraction;"},
   {role:"parallel",code:"double parallel = fraction / workers;"},
   {role:"result",code:"double speedup = 1.0 / (serial + parallel);"}
 ]);
 let fraction=80,workers=4,role=null;
 const slider=h("input",{type:"range",min:0,max:100,value:80,"aria-label":lang("Paralel yüzde","Parallel percentage")});
 const pick=number("N",4,1,64,v=>{workers=v;render();});
 slider.addEventListener("input",()=>{fraction=Number(slider.value);render();});
 p.controls.append(h("label",{},lang("Paralel iş yüzdesi","Parallel portion"),slider),pick.el);
 const bars=elt("div","learning-bars"),guess=h("input",{type:"number",step:"0.1",min:"1",placeholder:"2.5","aria-label":"speedup"}),
   message=elt("span","learning-message");
 const barLabel=elt("p","learning-dim");
 const serial=elt("div","learning-bar learning-bar-serial"),parallel=elt("div","learning-bar learning-bar-parallel");
 bars.append(barLabel,elt("div","learning-bar-track",serial,parallel));
 function emphasize(){
   bars.classList.toggle("is-serial",role==="serial");
   bars.classList.toggle("is-parallel",role==="parallel");
   p.light(role?[role]:[]);
 }
 for(const [el,kind] of [[serial,"serial"],[parallel,"parallel"]]){
   el.addEventListener("mouseenter",()=>{role=kind;emphasize();});
   el.addEventListener("mouseleave",()=>{role=null;emphasize();});
   el.addEventListener("focus",()=>{role=kind;emphasize();});
   el.addEventListener("blur",()=>{role=null;emphasize();});
 }
 const check=button(lang("Tahmini kontrol et","Check prediction"),()=>{
   const answer=amdahl(fraction/100,workers).speedup;
   message.textContent=guess.value.trim()!==""&&Math.abs(Number(guess.value)-answer)<0.11?
    lang("Doğru","Correct"):`${lang("Sonuç","Result")}: ${answer.toFixed(2)}×`;
 });
 p.figure.append(bars,elt("div","learning-guess",h("label",{},lang("Kaç kat hızlanma bekliyorsun?","Predict speedup"),guess),check,message));
 p.onCode(v=>{role=v;render();});
 function render(){
   const x=amdahl(fraction/100,workers);
   serial.style.width=`${x.serial*100}%`;
   serial.textContent=`${(x.serial*100).toFixed(0)}%`;
   parallel.style.width=`${x.parallel*100}%`;
   parallel.textContent=`${(x.parallel*100).toFixed(0)}%`;
   barLabel.textContent=`fraction=${fraction/100}, N=${workers}`;
   emphasize();
   p.setFacts(text(lang("Seri süre","Serial time"),x.serial),
     text(lang("Paralel süre","Parallel time"),x.parallel),
     text(lang("Toplam / hızlanma","Total / speedup"),`${x.time} / ${x.speedup}×`));
 }
 render();
}
function mountHalo(root){
 const p=lesson(root,lang("Geometrik ayrıştırma: sahiplik ve halo","Geometric decomposition: ownership and halo"),
  lang("6×8 alan, yatay iki parçaya ayrılmıştır. Hücreyi seç ve komşuların hangi işçiye ait olduğunu incele.",
    "A 6×8 domain is split into two horizontal partitions. Select a cell to inspect which neighbours belong to another worker."),[
  {role:"row",code:"for (int row = begin; row < end; ++row) {"},
  {role:"col",code:"  for (int col = 0; col < width; ++col) {"},
  {role:"halo",code:"    // fetch halo row from neighbouring worker"},
  {role:"read",code:"    sum = up + down + left + right - 4 * center;"},
  {role:"index",code:"    output[row * width + col] = sum;"},
  {role:"generic",code:"  }"},
  {role:"generic",code:"}"}
 ]);
 let pinned={r:2,c:3},hover=null,role=null;
 const m=matrix(p.figure,6,8,{
  preview:(r,c,axis)=>{hover={r:r??pinned.r,c:c??pinned.c,axis};render();},
  clear:()=>{hover=null;render();},
  pick:(r,c)=>{pinned={r,c};render();},
  pickRow:r=>{pinned={r,c:pinned.c};render();},
  pickColumn:c=>{pinned={r:pinned.r,c};render();}
 });
 p.onCode(v=>{role=v;render();});
 const legend=elt("div","learning-legend",lang("Yeşil: işçi 0 • Mavi: işçi 1 • Turuncu: halo komşusu",
  "Green: worker 0 • Blue: worker 1 • Orange: halo neighbour"));p.figure.append(legend);
 function render(){
  const view=hover||pinned,x=haloCell(6,8,2,view.r,view.c);
  paintMatrix(m,view,pinned,role||hover?.axis,
    (r,c)=>{
      const classes=[r<3?"is-owner-a":"is-owner-b"];
      if(x.remoteNeighbours.some(([a,b])=>a===r&&b===c))classes.push("is-halo");
      if(x.neighbours.some(([a,b])=>a===r&&b===c))classes.push("is-neighbour");
      if(role==="halo"&&x.remoteNeighbours.some(([a,b])=>a===r&&b===c))classes.push("is-active");
      return classes;
    });
  p.light(role?[role]:hover?[hover.axis==="cell"?"index":hover.axis,"read","halo"]:[]);
  p.setFacts(text(lang("Seçili konum","Position"),`(${view.r},${view.c}) → A[${view.r*8+view.c}]`),
   text(lang("Sahip işçi / satırlar","Owner / rows"),`${x.owner} / ${x.ownedRows.join("…")}`),
   text(lang("Halo komşuları","Halo neighbours"),x.remoteNeighbours.length?x.remoteNeighbours.map(v=>`(${v})`).join(", "):lang("Yok","None")));
 }
 render();
}
function mountRace(root){
 const p=lesson(root,lang("Race condition: hangi sıra doğru?","Race condition: which interleaving is safe?"),
  lang("İki thread counter++ işlemini üç aşamada yürütür. Önce T0 ve T1 sırayla load yapsın; sonra increment ve store. Kilitli sürümle karşılaştır.",
    "Two threads execute counter++ as load, increment, store. Interleave them and compare with the locked version."),[
  {role:"lock",code:"std::lock_guard<std::mutex> guard(m); // optional"},
  {role:"load",code:"int local = counter;"},
  {role:"add",code:"local = local + 1;"},
  {role:"store",code:"counter = local;"}
 ]);
 let state=raceInit(false),role=null;
 const toggle=h("input",{type:"checkbox","aria-label":lang("Mutex etkin","Mutex enabled")});
 toggle.addEventListener("change",()=>{state=raceInit(toggle.checked);render();});
 const t0=button("Thread 0 →",()=>{state=raceStep(state,0);render();});
 const t1=button("Thread 1 →",()=>{state=raceStep(state,1);render();});
 p.controls.append(h("label",{class:"learning-inline"},toggle,lang("Mutex ile koru","Protect with mutex")),t0,t1,
   button(lang("Sıfırla","Reset"),()=>{state=raceInit(toggle.checked);render();}));
 const lanes=elt("div","learning-race-lanes");p.figure.append(lanes);
 p.onCode(v=>{role=v;render();});
 function render(){
  const actions=["load","add","store"];
  lanes.replaceChildren(...state.threads.map((x,i)=>elt("div","learning-race-lane",
    elt("strong","",`T${i}`),
    ...actions.map((a,j)=>elt("span","learning-operation"+(x.phase===j?" is-next":"")+(x.phase>j?" is-done":"")+
       (role===a?" is-highlight":""),a)),
    elt("span","learning-local",`local=${x.local??"?"}`))));
  t0.disabled=state.threads[0].phase===3;
  t1.disabled=state.threads[1].phase===3;
  const latest=state.history.at(-1);
  p.light(role?[role]:latest?[latest.action]:[]);
  p.setFacts(text("counter",state.counter),text(lang("Mutex sahibi","Lock owner"),state.owner??"—"),
    text(lang("Son adım","Last step"),latest?`T${latest.thread} ${latest.action}`:lang("Başlamadı","Not started")),
    elt("p","learning-note",lang("Bu yalnızca seçilen olay sırasını gösterir. C/C++ data race tanımsız davranıştır; gerçek sonuç garanti değildir.",
      "This is an interleaving illustration. A data race in C/C++ is undefined behaviour, not a guaranteed numeric result.")));
 }
 render();
}
function mountCudaIndex(root){
 const p=lesson(root,lang("CUDA: satır, sütun, thread ve sınır kontrolü","CUDA: rows, columns, threads and bounds"),
   lang("Matris boyutunu ve blockDim'i değiştir. Hover satır/sütun ve kodu eşler; tıklama seçimi sabitler. Kenardaki fazladan thread'lerin neden yazmadığını gör.",
     "Change the matrix dimensions and blockDim. Hover to link rows/columns to code, click to pin a cell, and inspect edge threads."),[
   {role:"col",code:"int col = blockIdx.x * blockDim.x + threadIdx.x;"},
   {role:"row",code:"int row = blockIdx.y * blockDim.y + threadIdx.y;"},
   {role:"bounds",code:"if (row < rows && col < cols) {"},
   {role:"index",code:"  output[row * cols + col] = input[row * cols + col];"},
   {role:"generic",code:"}"},
   {role:"launch",code:"dim3 block(BX, BY);"},
   {role:"launch",code:"dim3 grid((cols+BX-1)/BX, (rows+BY-1)/BY);"}
 ]);
 const state={rows:7,cols:9,bx:4,by:3,pinned:{r:5,c:5},hover:null,role:null};
 const width=number("cols",9,2,12,v=>{state.cols=v;regenerate();});
 const height=number("rows",7,2,12,v=>{state.rows=v;regenerate();});
 const bx=number("blockDim.x",4,1,16,v=>{state.bx=v;regenerate();});
 const by=number("blockDim.y",3,1,16,v=>{state.by=v;regenerate();});
 p.controls.append(height.el,width.el,bx.el,by.el);
 let m=null;
 p.onCode(v=>{state.role=v;paint();});
 function regenerate(){
   state.pinned.r=Math.min(state.pinned.r,state.rows-1);state.pinned.c=Math.min(state.pinned.c,state.cols-1);state.hover=null;
   p.figure.replaceChildren();
   const rows=Math.ceil(state.rows/state.by)*state.by,cols=Math.ceil(state.cols/state.bx)*state.bx;
   // Prevent huge DOM tables, while showing the true covered dimensions in the facts.
   const shownR=Math.min(rows,16),shownC=Math.min(cols,16);
   m=matrix(p.figure,shownR,shownC,{
     preview:(r,c,axis)=>{state.hover={r:r??state.pinned.r,c:c??state.pinned.c,axis};paint();},
     clear:()=>{state.hover=null;paint();},
     pick:(r,c)=>{state.pinned={r,c};paint();},
     pickRow:r=>{state.pinned={r,c:state.pinned.c};paint();},
     pickColumn:c=>{state.pinned={r:state.pinned.r,c};paint();}
   },{value:(r,c)=>r>=state.rows||c>=state.cols?"×":r*state.cols+c});
   paint();
 }
 function paint(){
  if(!m)return;
  const st=state,view=st.hover||st.pinned;
  const blockX=Math.floor(view.c/st.bx),blockY=Math.floor(view.r/st.by),
    tx=view.c%st.bx,ty=view.r%st.by;
  const a=cudaCell(st.rows,st.cols,st.bx,st.by,blockX,blockY,tx,ty);
  paintMatrix(m,view,st.pinned,st.role||st.hover?.axis,(r,c)=>{
    const flags=[];
    if(r>=st.rows||c>=st.cols)flags.push("is-outside");
    if(Math.floor(r/st.by)===blockY&&Math.floor(c/st.bx)===blockX)flags.push("is-block");
    if(st.role==="bounds"&&(r>=st.rows||c>=st.cols))flags.push("is-active");
    return flags;
  });
  p.light(st.role?[st.role]:st.hover?[st.hover.axis==="cell"?"index":st.hover.axis,"row","col","bounds"]:[]);
  p.setFacts(text(lang("Matris / tüm grid kapsamı","Matrix / grid coverage"),`${st.rows}×${st.cols} / ${a.covered.rows}×${a.covered.cols}`),
    text("gridDim",`(${a.grid.x},${a.grid.y})`),
    text("blockIdx / threadIdx",`(${blockX},${blockY}) / (${tx},${ty})`),
    text("row,col / linear",`(${a.row},${a.col}) / ${a.offset??"—"}`),
    text("local id / warp / lane",`${a.localId} / ${a.warp} / ${a.lane}`),
    elt("p",a.valid?"learning-good":"learning-bad",a.valid?
      lang("Koşul doğru, bu thread elemanı işleyebilir.","In bounds, this thread may process the cell."):
      lang("Sınır dışında: koşul yanlış, yazma yok.","Out of bounds: guard fails, no write.")));
 }
 regenerate();
}
function mountTile(root){
 const p=lesson(root,lang("Tiled matmul: M, N ve P üzerinde aynı thread","Tiled matmul: one thread in M, N and P"),
  lang("P hücresine gel, M satırını ve N sütununu izle. Fazı değiştirince shared memory'ye yüklenen elemanlar değişir.",
    "Hover a P cell to see its M row and N column. Change phase to watch which values enter shared memory."),[
  {role:"row",code:"int Row = blockIdx.y * T + threadIdx.y;"},
  {role:"col",code:"int Col = blockIdx.x * T + threadIdx.x;"},
  {role:"loadM",code:"Mds[ty][tx] = M[Row * W + phase*T + tx];"},
  {role:"loadN",code:"Nds[ty][tx] = N[(phase*T + ty)*W + Col];"},
  {role:"barrier",code:"__syncthreads();"},
  {role:"accum",code:"for (int k=0; k<T; ++k) sum += Mds[ty][k]*Nds[k][tx];"},
  {role:"barrier",code:"__syncthreads();"},
  {role:"index",code:"P[Row * W + Col] = sum;"}
 ]);
 const s={phase:0,pinned:{r:1,c:6},hover:null,role:null};
 const selector=options(lang("Faz","Phase"),[[0,"0"],[1,"1"]],0,v=>{s.phase=Number(v);render();});
 p.controls.append(selector.el);
 const panels=elt("div","learning-matrices");p.figure.append(panels);
 const matrices={};
 p.onCode(v=>{s.role=v;render();});
 function hover(r,c,axis){s.hover={r:r??s.pinned.r,c:c??s.pinned.c,axis};render();}
 function clear(){s.hover=null;render();}
 for(const type of ["M","N","P"]){
  const host=elt("div","learning-tile-matrix");
  host.append(elt("strong","learning-matrix-name",type));
  matrices[type]=matrix(host,8,8,
    type==="P"?{preview:hover,clear,pick:(r,c)=>{s.pinned={r,c};render();},
      pickRow:r=>{s.pinned.r=r;render();},pickColumn:c=>{s.pinned.c=c;render();}}:{
      preview:(r,c,axis)=>{if(type==="M"&&r!==null)hover(r,s.pinned.c,axis==="col"?"col":"row");
        else if(type==="N"&&c!==null)hover(s.pinned.r,c,axis==="row"?"row":"col");},
      clear
    },{value:(r,c)=>`${r},${c}`});
  panels.append(host);
 }
 function render(){
   const view=s.hover||s.pinned;
   const bx=Math.floor(view.c/4),by=Math.floor(view.r/4),tx=view.c%4,ty=view.r%4;
   const x=tiledLoads(8,4,bx,by,tx,ty,s.phase);
   matrices.P.mark((r,c)=>{
     const q=[];
     if(r===s.pinned.r&&c===s.pinned.c)q.push("is-pinned");
     if(r===view.r)q.push("is-row");if(c===view.c)q.push("is-col");
     if(r===view.r&&c===view.c)q.push("is-active");
     if(Math.floor(r/4)===by&&Math.floor(c/4)===bx)q.push("is-block");
     return q;
   });
   matrices.M.mark((r,c)=>{
     const q=[];if(r===view.r)q.push("is-row");
     if(r===x.M[0]&&c===x.M[1])q.push("is-read","is-active");
     if(s.role==="loadM"&&r>=by*4&&r<by*4+4&&c>=s.phase*4&&c<s.phase*4+4)q.push("is-block");
     return q;
   });
   matrices.N.mark((r,c)=>{
     const q=[];if(c===view.c)q.push("is-col");
     if(r===x.N[0]&&c===x.N[1])q.push("is-read","is-active");
     if(s.role==="loadN"&&c>=bx*4&&c<bx*4+4&&r>=s.phase*4&&r<s.phase*4+4)q.push("is-block");
     return q;
   });
   p.light(s.role?[s.role]:s.hover?["row","col","loadM","loadN","index"]:[]);
   p.setFacts(text("P[Row][Col]",`${x.output} → P[${x.outIndex}]`),
    text("Mds[ty][tx]",`M[${x.M}] → M[${x.mIndex}]`),
    text("Nds[ty][tx]",`N[${x.N}] → N[${x.nIndex}]`),
    text(lang("Karo / faz / toplam faz","Tile / phase / phases"),`4×4 / ${s.phase} / 2`),
    elt("p","learning-note",lang("Her faz yükle → bariyer → 4 çarpım-toplama → bariyer. Bu görünüm bir thread'in yüklemesini gösterir.",
      "Each phase loads → barrier → 4 multiply-adds → barrier. This view shows one thread's loads.")));
 }
 render();
}
function mountPitch(root){
 const p=lesson(root,lang("Pitch: fiziksel ve mantıksal sütun","Pitch: physical vs logical columns"),
  lang("5 float genişliğindeki mantıksal satır, 32 B pitch ile 8 floatlık fiziksel alana yerleşir. Padding hücrelerini seçip kodun neden byte offset kullandığını gör.",
    "A logical row of five floats occupies an eight-float physical row with a 32-byte pitch. Inspect padding and the byte-offset formula."),[
  {role:"row",code:"char* rowPtr = (char*)base + row * pitchBytes;"},
  {role:"col",code:"float* ptr = (float*)rowPtr + col;"},
  {role:"index",code:"float value = *ptr;"},
  {role:"bounds",code:"// col < width: do not access padding"}
 ]);
 let pinned={r:3,c:2},hover=null,role=null;
 const m=matrix(p.figure,6,8,{
   preview:(r,c,axis)=>{hover={r:r??pinned.r,c:c??pinned.c,axis};render();},
   clear:()=>{hover=null;render();},
   pick:(r,c)=>{pinned={r,c};render();},
   pickRow:r=>{pinned={r,c:pinned.c};render();},
   pickColumn:c=>{pinned={r:pinned.r,c};render();}
  },{value:(r,c)=>c<5?r*5+c:"pad"});
 p.figure.append(elt("p","learning-legend",lang("5 sütun veri + 3 sütun padding • 4 B/float • pitch 32 B",
   "5 data columns + 3 padding columns • 4 B/float • pitch 32 B")));
 p.onCode(v=>{role=v;render();});
 function render(){
  const view=hover||pinned,logical=view.c<5,x=logical?pitchedCell(5,6,32,view.r,view.c):null;
  paintMatrix(m,view,pinned,role||hover?.axis,(r,c)=>{
    const a=[];if(c>=5)a.push("is-outside");
    if(role==="bounds"&&c>=5)a.push("is-active");
    return a;
  });
  p.light(role?[role]:hover?[hover.axis==="cell"?"index":hover.axis,"row","col"]:[]);
  p.setFacts(text(lang("Mantıksal boyut","Logical shape"),"6×5 floats"),
    text(lang("Pitch / fiziksel satır","Pitch / physical row"),"32 B / 8 floats"),
    text(lang("Seçilen bayt offset","Selected byte offset"),x?x.offsetBytes:`${view.r*32+view.c*4} (padding)`),
    text(lang("Sıkı paketlenmiş offset","Tight packed offset"),x?x.tightBytes:lang("Veri dışında","Not data")));
 }
 render();
}
function mountCoalesce(root){
 const p=lesson(root,lang("Warp bellek istekleri: şerit → segment","Warp memory requests: lane → segment"),
  lang("32 lane'in adreslerini ve 32 B segmentlerini incele. Üzerine geldiğin lane'in segmenti vurgulanır; kodda stride satırına gelerek erişimleri karşılaştır.",
    "Inspect 32 lane addresses and 32 B segments. Hover a lane to highlight its segment, and inspect the strided access in code."),[
  {role:"lane",code:"int lane = threadIdx.x; // one warp, lanes 0..31"},
  {role:"address",code:"float x = a[offset + lane * stride];"},
  {role:"segment",code:"// aligned 32-byte segments touched by the warp"}
 ]);
 const s={stride:1,offset:0,pinned:4,hover:null,role:null};
 const stride=options("stride",[[1,"1"],[2,"2"],[8,"8"],[1024,"1024"]],1,v=>{s.stride=Number(v);render();});
 const offset=number("offset",0,0,8,v=>{s.offset=v;render();});
 p.controls.append(stride.el,offset.el);
 const lanes=elt("div","learning-lanes");p.figure.append(lanes);
 const btns=Array.from({length:32},(_,i)=>{
   const b=h("button",{type:"button",class:"learning-lane"},String(i));
   b.addEventListener("mouseenter",()=>{s.hover=i;render();});
   b.addEventListener("mouseleave",()=>{s.hover=null;render();});
   b.addEventListener("focus",()=>{s.hover=i;render();});
   b.addEventListener("blur",()=>{s.hover=null;render();});
   b.addEventListener("click",()=>{s.pinned=i;render();});
   lanes.append(b);return b;
 });
 p.onCode(v=>{s.role=v;render();});
 function render(){
   const x=warpSegments(s.stride,s.offset),lane=s.hover??s.pinned,
     segment=Math.floor(x.addresses[lane]/32);
   btns.forEach((b,i)=>{
     const seg=Math.floor(x.addresses[i]/32);
     b.className="learning-lane"+(i===s.pinned?" is-pinned":"")+
       (i===lane?" is-active":"")+(seg===segment?" is-same-segment":"");
     b.title=`lane ${i}: a[${s.offset+i*s.stride}], byte ${x.addresses[i]}, segment ${seg}`;
     b.setAttribute("aria-pressed",i===s.pinned?"true":"false");
   });
   p.light(s.role?[s.role]:s.hover!==null?["lane","address","segment"]:[]);
   p.setFacts(text(lang("Seçili lane / eleman","Selected lane / element"),`${lane} / ${s.offset+lane*s.stride}`),
     text(lang("Adres / segment","Byte address / segment"),`${x.addresses[lane]} / ${segment}`),
     text(lang("Dokunulan 32 B segment","32 B segments touched"),x.segments),
     text(lang("32 B cinsinden trafik","Traffic at 32 B granularity"),`${x.bytes} B`),
     elt("p","learning-note",lang("Adresler 32 B hizalı bir tabandan itibaren hesaplanır. Bu, veri yolu işlemlerinin öğretimsel alt sınır modelidir; donanım zamanlaması değildir.",
       "Addresses are relative to a 32 B-aligned base. This is a teaching model of accessed segments, not a hardware timing prediction.")));
 }
 render();
}
function mountTranspose(root){
 const p=lesson(root,lang("Transpose: A[r][c] hangi B hücresine gider?","Transpose: where does A[r][c] go in B?"),
  lang("A matrisinin satır ve sütunlarına gel; B üzerinde aynı elemanın transpoze konumu vurgulanır. Kod satırlarını da deneyebilirsin.",
    "Hover rows and columns in A to highlight the transposed destination in B. Try hovering the corresponding code lines too."),[
  {role:"row",code:"int row = blockIdx.y * blockDim.y + threadIdx.y;"},
  {role:"col",code:"int col = blockIdx.x * blockDim.x + threadIdx.x;"},
  {role:"read",code:"float value = A[row * N + col];"},
  {role:"write",code:"B[col * N + row] = value;"}
 ]);
 let pinned={r:2,c:3},hover=null,role=null;
 const pair=elt("div","learning-matrices"),original=elt("div","learning-tile-matrix"),
   target=elt("div","learning-tile-matrix");
 original.append(elt("strong","learning-matrix-name","A"));
 target.append(elt("strong","learning-matrix-name","B"));
 pair.append(original,target);p.figure.append(pair);
 const from=matrix(original,6,6,{
  preview:(r,c,axis)=>{hover={r:r??pinned.r,c:c??pinned.c,axis};render();},
  clear:()=>{hover=null;render();},
  pick:(r,c)=>{pinned={r,c};render();},
  pickRow:r=>{pinned.r=r;render();},
  pickColumn:c=>{pinned.c=c;render();}
 },{value:(r,c)=>r*6+c});
 const to=matrix(target,6,6,{
  preview:(r,c,axis)=>{hover={r:c??pinned.r,c:r??pinned.c,axis:axis==="row"?"col":axis==="col"?"row":"cell"};render();},
  clear:()=>{hover=null;render();},
  pick:(r,c)=>{pinned={r:c,c:r};render();}
 },{value:(r,c)=>c*6+r});
 p.onCode(v=>{role=v;render();});
 function render(){
  const view=hover||pinned,x=transposeCell(6,view.r,view.c);
  paintMatrix(from,view,pinned,role||hover?.axis);
  paintMatrix(to,{r:view.c,c:view.r},{r:pinned.c,c:pinned.r},
    role==="row"?"col":role==="col"?"row":hover?.axis==="row"?"col":hover?.axis==="col"?"row":role,
    (r,c)=>r===view.c&&c===view.r?["is-write"] : []);
  p.light(role?[role]:hover?["row","col","read","write"]:[]);
  p.setFacts(text("A[row][col]",`${x.read} → A[${x.readIndex}]`),
    text("B[col][row]",`${x.write} → B[${x.writeIndex}]`),
    elt("p","learning-note",lang("Naive transpose'ta yan yana x-lane'ler genellikle çıktı belleğine stride N ile yazar. Shared-memory karo sürümü erişimleri yeniden düzenleyebilir.",
      "With naive transpose adjacent x-lanes generally write output with stride N. A shared tile can reorganize these stores.")));
 }
 render();
}

function mountBarrier(root){
 const p=lesson(root,lang("Blok bariyeri: önce paylaş, sonra oku","Block barrier: share before reading"),
   lang("Dört thread'i istediğin sırada ilerlet. Her thread tile[i] yazar, sonra komşusunun değerini okumaya çalışır. Aynı bloktaki herkes bariyere ulaşmalıdır.",
     "Advance four threads in any order. Each writes tile[i], then tries to read its neighbour. All block threads must reach the barrier."),[
   {role:"declare",code:"__shared__ int tile[4];"},
   {role:"write",code:"tile[threadIdx.x] = threadIdx.x + 1;"},
   {role:"barrier",code:"__syncthreads();"},
   {role:"read",code:"int next = tile[(threadIdx.x + 1) % 4];"}
 ]);
 let state=newBarrier(true),selected=0,hover=null,role=null;
 const switcher=h("input",{type:"checkbox",checked:true,"aria-label":lang("Bariyer etkin","Barrier enabled")});
 const panel=elt("div","learning-barrier-lanes");
 const reset=()=>{state=newBarrier(switcher.checked);render();};
 switcher.addEventListener("change",reset);
 p.controls.append(h("label",{class:"learning-inline"},switcher,lang("Bariyeri kullan","Use barrier")),
   button(lang("Sıfırla","Reset"),reset));
 const lanes=Array.from({length:4},(_,i)=>{
  const b=h("button",{type:"button",class:"learning-barrier-lane"});
  b.addEventListener("mouseenter",()=>{hover=i;render();});
  b.addEventListener("mouseleave",()=>{hover=null;render();});
  b.addEventListener("focus",()=>{hover=i;render();});
  b.addEventListener("blur",()=>{hover=null;render();});
  b.addEventListener("click",()=>{selected=i;state=stepBarrier(state,i);render();});
  panel.append(b);return b;
 });
 p.figure.append(panel);
 p.onCode(v=>{role=v;render();});
 function render(){
   const stages=[lang("Yazmaya hazır","Ready to write"),lang("Yazdı","Written"),lang("Bariyerde","Waiting at barrier"),
    lang("Bariyer açıldı","Barrier released"),lang("Okudu","Read")];
   const shown=hover??selected;
   lanes.forEach((b,i)=>{
     const phase=state.phase[i];
     b.textContent=`T${i}: ${stages[phase]} • tile[${i}]=${state.shared[i]??"?"} • next=${phase===4?(state.reads[i]??"?"):"—"}`;
     b.className="learning-barrier-lane"+(i===shown?" is-active":"")+(i===selected?" is-pinned":"");
     b.disabled=phase===4;
     b.setAttribute("aria-pressed",i===selected?"true":"false");
   });
   const current=state.phase[shown],active=current===0?"write":current===1||current===2?"barrier":"read";
   p.light(role?[role]:hover!==null?[active]:[]);
   const bad=state.phase.some((phase,i)=>phase===4&&state.reads[i]===null);
   p.setFacts(text(lang("Shared dizi","Shared array"),state.shared.map(x=>x??"?").join(", ")),
     text(lang("Seçili thread / aşama","Selected thread / phase"),`T${shown} / ${stages[current]}`),
     elt("p",bad?"learning-bad":"learning-note",bad?
       lang("Bariyersiz erken okuma: veri yarışı; gerçek CUDA sonucu garanti edilmez.",
         "Unsynchronized early read: data race; real CUDA output is not guaranteed."):
       state.enabled?lang("Bariyer, tüm blok thread'leri beklemeden okumayı başlatmaz.",
         "No thread passes the barrier until all threads in the block arrive."):
       lang("Bariyer kapalı: okuma başka thread'in yazmasından önce gerçekleşebilir.",
         "Barrier disabled: a read can occur before another thread writes.")));
 }
 render();
}

const WIDGETS={"amdahl":mountAmdahl,barrier:mountBarrier,"halo":mountHalo,"race":mountRace,
 "cuda-index":mountCudaIndex,"tile":mountTile,"pitch":mountPitch,
 "coalesce-lanes":mountCoalesce,"transpose":mountTranspose};
for(const node of document.querySelectorAll("[data-learning]")){
 const widget=WIDGETS[node.dataset.learning];
 if(widget)widget(node);
}
