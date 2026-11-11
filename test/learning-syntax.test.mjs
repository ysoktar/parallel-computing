import {test} from "node:test";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL("../site/",import.meta.url));
test("all lesson interactive JavaScript files parse as ES modules",()=>{
 for(const file of ["js/learning-widgets.js","js/learning-model.js","js/exam-model.js","js/exam-lab.js"]){
  execFileSync(process.execPath,["--check",new URL(file,"file://"+root+"/").pathname],{stdio:"pipe"});
 }
});
