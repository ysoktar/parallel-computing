// Handwriting reference controls. The filled A4 content is present as HTML even without JS.
const root = document.querySelector(".copy-ready");
if (root) {
  const pair=root.querySelector(".copy-sheet-pair");
  const buttons=[...root.querySelectorAll("[data-copy-view]")];
  const pages=[...root.querySelectorAll("[data-sheet]")];
  const zoom=root.querySelector("[data-copy-zoom]");
  const zoomLabel=root.querySelector("[data-copy-zoom-label]");
  const key="parallel-cheatsheet-view-v1";

  let saved={};
  try { saved=JSON.parse(localStorage.getItem(key)||"{}"); } catch { saved={}; }
  const persist=()=>{try {localStorage.setItem(key,JSON.stringify({
    view:pair.dataset.view,zoom:Number(zoom.value)
  }));}catch {/* Storage disabled; controls still work. */}};
  function show(view,save=true){
    if(!["front","back","both"].includes(view))view="front";
    pair.dataset.view=view;
    for(const page of pages)page.hidden=view!=="both"&&page.dataset.sheet!==view;
    for(const b of buttons)b.setAttribute("aria-pressed",String(b.dataset.copyView===view));
    if(save)persist();
  }
  function resize(value,save=true){
    const amount=Math.max(85,Math.min(155,Math.round((Number(value)||100)/5)*5));
    zoom.value=String(amount);
    root.style.setProperty("--copy-zoom",String(amount/100));
    zoomLabel.textContent=amount+"%";
    if(save)persist();
  }
  for(const b of buttons)b.addEventListener("click",()=>show(b.dataset.copyView));
  zoom.addEventListener("input",()=>resize(zoom.value));
  resize(saved.zoom||100,false);
  show(saved.view||"front",false);
}
