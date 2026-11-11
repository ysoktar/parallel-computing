// Bilingual, browser-only teaching widgets. Pure math lives in exam-model.js.
import { h } from "./lib/ui.js";
import { t } from "./lib/i18n.js";
import { traceTranspose, warpAccess, warpMembers, newBarrier, stepBarrier } from "./exam-model.js";

const makeButton=(text,fn)=>{const b=h("button",{type:"button",class:"btn small"},text);b.addEventListener("click",fn);return b;};
const control=(name,value,min,max,fn)=>{
  const input=h("input",{type:"number",value,min,max,step:1,"aria-label":name});
  input.addEventListener("change",()=>{
    const n=Math.max(min,Math.min(max,Math.trunc(Number(input.value)||0)));
    input.value=n;fn(n);
  });
  return {input,label:h("label",{},name,input)};
};
const line=(a,b)=>h("p",{},h("strong",{},a), " ",h("code",{},b));
const setStatus=(where,value,ok)=>{where.textContent=value;where.className="exam-lab-status "+(ok?"good":"bad");};
function mountTranspose(root){
  const s={N:64,bx:1,by:0,tx:5,ty:10,mode:"shared",step:0};
  const controls=h("div",{class:"exam-lab-controls"});
  const N=h("select",{"aria-label":"N"},...([32,64,96,128].map(v=>h("option",{value:v,selected:v===64},String(v)))));
  N.addEventListener("change",()=>{s.N=Number(N.value);s.bx=Math.min(s.bx,s.N/32-1);s.by=Math.min(s.by,s.N/32-1);bx.input.value=s.bx;by.input.value=s.by;draw();});
  const mode=h("select",{"aria-label":t("Algoritma","Algorithm")},h("option",{value:"shared"}, "Shared tile"),h("option",{value:"naive"},"Naive"));
  mode.addEventListener("change",()=>{s.mode=mode.value;s.step=0;draw();});
  const bx=control("blockIdx.x",1,0,3,v=>{s.bx=Math.min(v,s.N/32-1);bx.input.value=s.bx;draw();});
  const by=control("blockIdx.y",0,0,3,v=>{s.by=Math.min(v,s.N/32-1);by.input.value=s.by;draw();});
  const tx=control("threadIdx.x",5,0,31,v=>{s.tx=v;draw();});
  const ty=control("threadIdx.y",10,0,31,v=>{s.ty=v;draw();});
  controls.append(h("label",{},"N×N",N),h("label",{},t("Yöntem","Method"),mode),bx.label,by.label,tx.label,ty.label);
  const step=h("div",{class:"exam-lab-step","aria-live":"polite"});
  const cells=h("div",{class:"exam-lab-cells",role:"group","aria-label":t("32×32 karonun seçili 8×8 bölgesi","Selected 8×8 part of the 32×32 tile")});
  const details=h("div",{class:"exam-lab-details"});
  const backward=makeButton(t("Önceki adım","Previous step"),()=>{s.step=Math.max(0,s.step-1);draw();});
  const forward=makeButton(t("Sonraki adım","Next step"),()=>{s.step++;draw();});
  const guess=h("input",{type:"number",placeholder:"B[offset]","aria-label":t("Çıktı indeksi","Output index")});
  const status=h("span",{class:"exam-lab-status","aria-live":"polite"});
  const check=makeButton(t("Cevabı kontrol et","Check answer"),()=>{
    const x=traceTranspose(s.N,s.bx,s.by,s.tx,s.ty);
    const correct=s.mode==="naive"?x.naiveOutput.offset:x.sharedOutput.offset;
    setStatus(status,guess.value.trim()!==""&&Number(guess.value)===correct?t("Doğru!","Correct!") : t(`Doğru indeks: ${correct}`,`Correct index: ${correct}`),
      guess.value.trim()!==""&&Number(guess.value)===correct);
  });
  root.replaceWith(h("div",{class:"wgt"},h("div",{class:"wgt-title"},t("Transpose: thread ve adres izleme","Transpose: trace threads and addresses")),
    h("p",{class:"wgt-sub"},t("Bir thread seç, kodun okuma, shared bellek ve yazma aşamalarını ilerlet.","Choose a thread and step through global reads, shared memory and output writes.")),
    controls,h("div",{class:"btn-row"},backward,forward),step,
    h("p",{class:"wgt-sub"},t("Karo penceresindeki hücreyi seç (etiketler: y,x). Diğer thread'ler için koordinatları değiştir.","Select a tile cell (labels: y,x), or change thread coordinates.")),cells,details,
    h("div",{class:"exam-lab-quiz"},line(t("Mini soru: B'nin hangi lineer indeksine yazıyor?","Quiz: Which linear output index in B?"),"row*N+col"),
      h("div",{class:"btn-row"},guess,check,status))));
  function draw(){
    const x=traceTranspose(s.N,s.bx,s.by,s.tx,s.ty),a=warpAccess(s.N,s.bx,s.by,s.ty);
    const phases=s.mode==="naive"?[
      [t("Global belleği oku","Read global memory"),`A[${x.input.row}][${x.input.col}] = A[${x.input.offset}]`],
      [t("Transpoze konuma yaz","Write transposed element"),`B[${x.naiveOutput.row}][${x.naiveOutput.col}] = B[${x.naiveOutput.offset}]`]
    ]:[
      [t("Global belleği oku","Read global memory"),`A[${x.input.row}][${x.input.col}] = A[${x.input.offset}]`],
      [t("Shared karoya yaz","Write shared tile"),`tile[${x.tileWritten.join("][")}] = A[${x.input.offset}]`],
      [t("Blok bariyerinde bekle","Wait at block barrier"),"__syncthreads()"],
      [t("Başka thread'in yüklediği hücreyi oku","Read a cell loaded by another thread"),`tile[${x.tileRead.join("][")}] = A[${x.sharedInput.offset}]`],
      [t("Coalesced çıktı yaz","Coalesced output write"),`B[${x.sharedOutput.row}][${x.sharedOutput.col}] = B[${x.sharedOutput.offset}]`]
    ];
    s.step=Math.min(s.step,phases.length-1);
    backward.disabled=s.step===0;forward.disabled=s.step===phases.length-1;
    step.replaceChildren(h("strong",{},`${s.step+1}/${phases.length}: ${phases[s.step][0]}`),h("code",{},phases[s.step][1]));
    const firstX=Math.floor(s.tx/8)*8,firstY=Math.floor(s.ty/8)*8;
    cells.replaceChildren(...Array.from({length:64},(_,i)=>{
      const cx=firstX+i%8,cy=firstY+Math.floor(i/8);
      const button=makeButton(`${cy},${cx}`,()=>{s.tx=cx;s.ty=cy;tx.input.value=cx;ty.input.value=cy;guess.value="";status.textContent="";draw();});
      button.className="exam-lab-cell"+(s.tx===cx&&s.ty===cy?" selected":"");
      button.setAttribute("aria-pressed",s.tx===cx&&s.ty===cy?"true":"false");
      return button;
    }));
    const output=s.mode==="naive"?x.naiveOutput:x.sharedOutput;
    details.replaceChildren(line("blockIdx / threadIdx",`(${s.bx},${s.by}) / (${s.tx},${s.ty})`),
      line("A[row][col]",`${x.input.row},${x.input.col} → A[${x.input.offset}]`),
      line(t("Bu thread'in yazdığı B","B written by this thread"),`B[${output.row}][${output.col}] → B[${output.offset}]`),
      line(t("Warp global okumaları","Warp global reads"),`${a.read.segments} × 32 B`),
      line(t("Naive warp yazmaları","Naive warp writes"),`${a.naiveWrite.segments} × 32 B`),
      line(t("Shared warp yazmaları","Shared warp writes"),`${a.sharedWrite.segments} × 32 B`),
      h("p",{class:"wgt-sub"},t("32 B segment sayıları hizalı N×N float matris ve tam warp içindir; GPU zaman ölçümü değildir.","32 B segment counts assume aligned N×N float arrays and a full warp; they are not GPU benchmarks.")));
  }
  draw();
}
function mountBarrier(root){
  let state=newBarrier(true);
  const select=h("select",{"aria-label":t("Bariyer kullan","Use barrier")},h("option",{value:"on"}, "__syncthreads()"),h("option",{value:"off"},t("Bariyer yok","No barrier")));
  const timeline=h("div",{class:"exam-lab-timeline","aria-live":"polite"});
  const controls=h("div",{class:"btn-row"});
  const reset=()=>{state=newBarrier(select.value==="on");render();};
  select.addEventListener("change",reset);
  for(let lane=0;lane<4;lane++)controls.append(makeButton(`Thread ${lane} →`,()=>{state=stepBarrier(state,lane);render();}));
  controls.append(makeButton(t("Sıfırla","Reset"),reset));
  root.replaceWith(h("div",{class:"wgt"},h("div",{class:"wgt-title"},t("Shared memory: dört thread'in sırasını sen belirle","Shared memory: schedule four threads")),
    h("p",{class:"wgt-sub"},t("Her thread önce shared[i] yazar, sonra shared[(i+1)%4] okur. Bariyersiz erken okuma tehlikelidir; bu GPU zamanlama simülasyonu değildir.","Each thread writes shared[i] then reads shared[(i+1)%4]. An early read without a barrier is unsafe; this is not a GPU scheduling simulator.")),
    h("div",{class:"exam-lab-controls"},h("label",{},t("Senkronizasyon","Synchronization"),select)),controls,timeline));
  function render(){
    const names=[t("Yazılmadı","Not written"),t("Yazdı","Wrote"),t("Bariyerde bekliyor","At barrier"),t("Bariyerden geçti","Barrier released"),t("Okudu","Read")];
    const table=h("table",{class:"tbl-mini"},h("thead",{},h("tr",{},...["Thread",t("Durum","State"),"shared[i]",t("Komşu okuması","Neighbour read")].map(x=>h("th",{},x)))));
    const body=h("tbody");
    for(let i=0;i<4;i++)body.append(h("tr",{},h("td",{},i),h("td",{},names[state.phase[i]]),
      h("td",{},state.shared[i]??"—"),h("td",{},state.phase[i]===4?(state.reads[i]??t("Yazılmadan okundu (yarış)","Read before write (race)")):"—")));
    table.append(body);
    timeline.replaceChildren(table,h("p",{class:"exam-lab-status"},state.reads.some((v,i)=>state.phase[i]===4&&v===null)?
      t("Olası data race: gerçek CUDA sonucu garanti edilmez.","Potential data race: actual CUDA output is not guaranteed."):
      state.phase.every(x=>x===4)?t("Tüm thread'ler okudu.","All threads have read."):
      state.enabled?t("Bütün thread'ler bariyere ulaşmadan okumaya geçemez.","No reads before every thread reaches the barrier."):
      t("Bariyer yok: okuma, başka thread'in yazmasından önce olabilir.","No barrier: a read can precede another thread's write.")));
  }
  render();
}
function mountWarp(root){
  const s={width:8,height:32,tx:5,ty:10};
  const output=h("div",{class:"exam-lab-details"});
  const ctl=h("div",{class:"exam-lab-controls"});
  const width=control("blockDim.x",s.width,1,64,v=>{s.width=v;s.tx=Math.min(s.tx,v-1);tx.input.value=s.tx;draw();});
  const height=control("blockDim.y",s.height,1,32,v=>{s.height=v;s.ty=Math.min(s.ty,v-1);ty.input.value=s.ty;draw();});
  const tx=control("threadIdx.x",s.tx,0,63,v=>{s.tx=Math.min(v,s.width-1);tx.input.value=s.tx;draw();});
  const ty=control("threadIdx.y",s.ty,0,31,v=>{s.ty=Math.min(v,s.height-1);ty.input.value=s.ty;draw();});
  ctl.append(width.label,height.label,tx.label,ty.label);
  const lanes=h("div",{class:"exam-lab-lanes"});
  root.replaceWith(h("div",{class:"wgt"},h("div",{class:"wgt-title"},t("Warp şekli: x önce artar","Warp shape: x changes fastest")),
    h("p",{class:"wgt-sub"},t("32 ardışık lineer thread id'sinin hangi (x,y) hücrelerine denk geldiğini incele.","Inspect which (x,y) positions belong to 32 consecutive linear thread IDs.")),
    ctl,output,lanes));
  function draw(){
    if(s.width*s.height>1024){output.replaceChildren(h("p",{class:"bad"},t("1024 thread/blok sınırı aşıldı.","Exceeds 1024 threads/block.")));lanes.replaceChildren();return;}
    const id=s.ty*s.width+s.tx,warp=Math.floor(id/32),members=warpMembers(s.width,s.height,s.tx,s.ty);
    output.replaceChildren(line("linear thread id",`${s.ty}*${s.width}+${s.tx}=${id}`),line("warp",`${warp} (lane ${id%32})`),
      line(t("Bu warp'taki etkin thread sayısı","Active threads in this warp"),String(members.length)));
    lanes.replaceChildren(...members.map(([x,y],i)=>h("span",{class:"exam-lab-lane"+(x===s.tx&&y===s.ty?" selected":""),
      title:`lane ${i}: threadIdx=(${x},${y})`},`${x},${y}`)));
  }
  draw();
}
for(const root of document.querySelectorAll("[data-exam-widget]")){
  const name=root.dataset.examWidget;
  if(name==="transpose")mountTranspose(root);
  if(name==="barrier")mountBarrier(root);
  if(name==="warp-shape")mountWarp(root);
}
