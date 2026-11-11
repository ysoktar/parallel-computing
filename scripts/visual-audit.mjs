// Free Playwright/Chromium screenshot audit, run against the built static site.
// npm run build && npm install --no-save playwright && npx playwright install chromium
// npm start? Serve dist separately, then: node scripts/visual-audit.mjs
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const base=process.env.AUDIT_BASE_URL || "http://127.0.0.1:8000";
const out=process.env.AUDIT_OUT || "visual-audit";
const sitePages=["index.html","l1-intro.html","l2-design.html","l3-threads.html",
  "l4-cuda-intro.html","l5-cuda-kernels.html","l6-cuda-memory.html",
  "coalescing.html","lab.html","exam-midterm2.html","mock-exam.html","cheatsheet.html"];
const sizes=[{name:"desktop",width:1440,height:900},{name:"mobile",width:390,height:844}];
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const results=[];
let errors=0;
try {
 for(const locale of ["","en/"]){
  for(const file of sitePages) {
   for(const size of sizes) {
    const page=await browser.newPage({viewport:{width:size.width,height:size.height},deviceScaleFactor:1,
      reducedMotion:"reduce",colorScheme:"light"});
    const entry={page:locale+file,viewport:size.name,width:size.width,
      scriptErrors:[],consoleErrors:[],status:0,widgets:0,overflowPixels:0};
    page.on("pageerror",e=>entry.scriptErrors.push(e.message));
    page.on("console",e=>{if(e.type()==="error")entry.consoleErrors.push(e.text());});
    const url=base+"/"+locale+file;
    try{
      const response=await page.goto(url,{waitUntil:"networkidle",timeout:45000});
      entry.status=response?.status()??0;
      await page.locator(".learning-widget").first().waitFor({state:"visible",timeout:2000}).catch(()=>{});
      entry.widgets=await page.locator(".learning-widget").count();
      entry.overflowPixels=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-window.innerWidth));
      const name=locale.replace("/","-")||"tr-";
      const prefix=`${name}${file.replace(".html","")}-${size.name}`;
      const path=join(out,prefix+".png");
      await page.screenshot({path,fullPage:true,animations:"disabled"});
      entry.screenshot=path;
      if(file==="cheatsheet.html"){
        // Inspect each actual filled side, not only the default visible side.
        const front=page.locator('.copy-sheet-page[data-sheet="front"]');
        const back=page.locator('.copy-sheet-page[data-sheet="back"]');
        entry.sheetCards=await page.locator("[data-copy-card]").count();
        if(entry.sheetCards!==13)entry.scriptErrors.push("Expected 13 filled cheat-sheet sections");
        await page.locator('[data-copy-view="front"]').click();
        await front.screenshot({path:join(out,prefix+"-copy-front.png"),animations:"disabled"});
        await page.locator('[data-copy-view="back"]').click();
        await back.screenshot({path:join(out,prefix+"-copy-back.png"),animations:"disabled"});
        const dims=await back.evaluate(el=>{
          const rect=el.getBoundingClientRect();
          return {width:rect.width,height:rect.height,scrollHeight:el.scrollHeight};
        });
        entry.sheetRatio=Number((dims.height/dims.width).toFixed(3));
        entry.sheetBodyOverflow=Math.max(0,Math.ceil(dims.scrollHeight-dims.height));
        await page.locator('[data-copy-view="both"]').click();
      }
      if(entry.widgets){
        const widget=page.locator(".learning-widget").first();
        await widget.scrollIntoViewIfNeeded();
        const cell=widget.locator(".learning-cell").first();
        const code=widget.locator(".learning-code-line").first();
        if(await cell.count()) {
          await cell.hover({timeout:5000});
          entry.hoverLit=await widget.locator(".learning-code-line.is-lit").count();
          await cell.click({timeout:5000});
          entry.pinned=await cell.getAttribute("aria-pressed");
          await code.hover({timeout:5000});
          entry.codeHoverHits=await widget.locator(".learning-cell.is-row,.learning-cell.is-col,.learning-cell.is-active").count();
        }
        await widget.screenshot({path:join(out,prefix+"-widget.png"),animations:"disabled"});
      }
    } catch(e){entry.scriptErrors.push("Audit action: "+e.message);}
    if(entry.scriptErrors.length || entry.status!==200) errors++;
    results.push(entry);
    console.log(JSON.stringify({page:entry.page,viewport:entry.viewport,status:entry.status,
      widgets:entry.widgets,overflow:entry.overflowPixels,errors:entry.scriptErrors.slice(0,2)}));
    await page.close();
   }
  }
 }
} finally {await browser.close();}
await writeFile(join(out,"report.json"),JSON.stringify({generatedAt:new Date().toISOString(),base,
  failedPages:errors,results},null,2));
if(errors)process.exitCode=1;
