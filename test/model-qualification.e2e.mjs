import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base=(process.argv[2]||process.env.XRAI_QUALIFY_URL||'http://127.0.0.1:8765/').replace(/\/?$/,'/');
const artifactDir='artifacts/model-qualification';
await fs.mkdir(artifactDir,{recursive:true});

const launchArgs=[
  '--enable-unsafe-webgpu',
  '--enable-unsafe-swiftshader',
  '--enable-features=Vulkan',
  '--use-angle=vulkan',
  '--use-vulkan=swiftshader',
  '--use-webgpu-adapter=swiftshader',
  '--disable-vulkan-surface',
  '--ignore-gpu-blocklist',
  '--enable-gpu',
  '--disable-dev-shm-usage'
];

const browser=await chromium.launch({headless:false,args:launchArgs});
const page=await browser.newPage();
const report={base,startedAt:new Date().toISOString(),consoleErrors:[],pageErrors:[],cases:[]};
page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text())});
page.on('pageerror',e=>report.pageErrors.push(String(e)));

function exact(name,output,expected){return{name,passed:String(output).trim()===expected,expected,output:String(output)}}
function jsonCase(name,output,expected){
  let parsed=null,error=null;try{parsed=JSON.parse(String(output).trim())}catch(e){error=String(e)}
  const passed=!error&&Object.entries(expected).every(([k,v])=>parsed?.[k]===v);
  return{name,passed,expected,output:String(output),parsed,error};
}

try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:30_000});
  await page.waitForFunction(()=>document.querySelector('#modeLabel')?.textContent?.trim()!=='detecting',null,{timeout:30_000});
  const raw=await page.evaluate(async()=>{
    const {getLocalModel}=await import('./local-agent.js');
    const progress=[];const model=await getLocalModel(message=>progress.push(String(message)));
    const ask=messages=>model.prompt(messages);
    const outputs={};
    outputs.instruction=await ask([{role:'user',content:'Follow this instruction exactly. Reply with only XRAI_OK and no punctuation or explanation.'}]);
    outputs.arithmetic=await ask([{role:'user',content:'Reply with only the number. What is 17 + 25?'}]);
    outputs.recall=await ask([{role:'user',content:'The codeword is ORBIT-73.'},{role:'assistant',content:'Acknowledged.'},{role:'user',content:'What is the codeword? Reply with only the codeword.'}]);
    outputs.toolArgs=await ask([{role:'user',content:'Return only valid JSON with exactly two string fields: "tool" set to "read_file" and "path" set to "src/app.js". No markdown.'}]);
    outputs.diagnosis=await ask([{role:'user',content:'Bug: function add(a,b){return a-b}. The test add(2,3) expects 5. Reply with exactly the single replacement operator and nothing else.'}]);
    outputs.repair=await ask([{role:'user',content:'Repair this code: function add(a,b){return a-b}. Return only valid JSON with exactly two string fields: "search" set to "return a-b" and "replace" set to "return a+b". No markdown.'}]);
    return{model:model.name,progress,outputs};
  });
  report.model=raw.model;report.progress=raw.progress;
  report.cases.push(exact('instruction-following',raw.outputs.instruction,'XRAI_OK'));
  report.cases.push(exact('arithmetic-sanity',raw.outputs.arithmetic,'42'));
  report.cases.push(exact('conversation-recall',raw.outputs.recall,'ORBIT-73'));
  report.cases.push(jsonCase('structured-tool-arguments',raw.outputs.toolArgs,{tool:'read_file',path:'src/app.js'}));
  report.cases.push(exact('simple-code-diagnosis',raw.outputs.diagnosis,'+'));
  report.cases.push(jsonCase('simple-code-repair',raw.outputs.repair,{search:'return a-b',replace:'return a+b'}));
  report.passed=report.cases.filter(x=>x.passed).length;report.total=report.cases.length;report.ok=report.passed===report.total;
  report.finishedAt=new Date().toISOString();
  await fs.writeFile(`${artifactDir}/qualification.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({model:report.model,passed:report.passed,total:report.total,cases:report.cases.map(x=>({name:x.name,passed:x.passed,output:x.output}))},null,2));
  if(!report.ok)throw new Error(`Model qualification failed ${report.passed}/${report.total}`);
}catch(error){
  report.ok=false;report.error=error instanceof Error?error.message:String(error);report.finishedAt=new Date().toISOString();
  await fs.writeFile(`${artifactDir}/qualification.json`,JSON.stringify(report,null,2));
  throw error;
}finally{
  await browser.close();
}
