import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base=(process.argv[2]||process.env.XRAI_QUALIFY_URL||'http://127.0.0.1:8765/').replace(/\/?$/,'/');
const profile=(process.argv[3]||process.env.XRAI_MODEL_PROFILE||'production').toLowerCase();
if(!['production','lfm12b'].includes(profile))throw new Error(`Unknown model profile: ${profile}`);
const artifactDir=`artifacts/model-qualification-${profile}`;
const MODEL_LOAD_TIMEOUT_MS=profile==='lfm12b'?240_000:150_000;
const CASE_TIMEOUT_MS=45_000;
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

const browser=await chromium.launch({channel:'chrome',headless:false,args:launchArgs});
const page=await browser.newPage();
const report={base,profile,startedAt:new Date().toISOString(),consoleErrors:[],pageErrors:[],cases:[]};
page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text())});
page.on('pageerror',e=>report.pageErrors.push(String(e)));

function exact(name,output,expected,durationMs){return{name,passed:String(output).trim()===expected,expected,output:String(output),durationMs}}
function jsonCase(name,output,expected,durationMs){
  let parsed=null,error=null;try{parsed=JSON.parse(String(output).trim())}catch(e){error=String(e)}
  const passed=!error&&Object.entries(expected).every(([k,v])=>parsed?.[k]===v)&&Object.keys(parsed||{}).length===Object.keys(expected).length;
  return{name,passed,expected,output:String(output),parsed,error,durationMs};
}
async function persist(){await fs.writeFile(`${artifactDir}/qualification.json`,JSON.stringify(report,null,2))}

// Ordered cheapest/foundational first. Each case gets only the output budget
// needed to express the required answer; this measures compliance rather than
// accidentally benchmarking hundreds of unnecessary generated tokens.
const cases=[
  {name:'instruction-following',maxNewTokens:12,messages:[{role:'user',content:'Follow this instruction exactly. Reply with only XRAI_OK and no punctuation or explanation.'}],grade:(out,ms)=>exact('instruction-following',out,'XRAI_OK',ms)},
  {name:'arithmetic-sanity',maxNewTokens:12,messages:[{role:'user',content:'Reply with only the number. What is 17 + 25?'}],grade:(out,ms)=>exact('arithmetic-sanity',out,'42',ms)},
  {name:'conversation-recall',maxNewTokens:24,messages:[{role:'user',content:'The codeword is ORBIT-73.'},{role:'assistant',content:'Acknowledged.'},{role:'user',content:'What is the codeword? Reply with only the codeword.'}],grade:(out,ms)=>exact('conversation-recall',out,'ORBIT-73',ms)},
  {name:'structured-tool-arguments',maxNewTokens:72,messages:[{role:'user',content:'Return only valid JSON with exactly two string fields: "tool" set to "read_file" and "path" set to "src/app.js". No markdown.'}],grade:(out,ms)=>jsonCase('structured-tool-arguments',out,{tool:'read_file',path:'src/app.js'},ms)},
  {name:'simple-code-diagnosis',maxNewTokens:12,messages:[{role:'user',content:'Bug: function add(a,b){return a-b}. The test add(2,3) expects 5. Reply with exactly the single replacement operator and nothing else.'}],grade:(out,ms)=>exact('simple-code-diagnosis',out,'+',ms)},
  {name:'simple-code-repair',maxNewTokens:96,messages:[{role:'user',content:'Repair this code: function add(a,b){return a-b}. Return only valid JSON with exactly two string fields: "search" set to "return a-b" and "replace" set to "return a+b". No markdown.'}],grade:(out,ms)=>jsonCase('simple-code-repair',out,{search:'return a-b',replace:'return a+b'},ms)}
];

try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:30_000});
  await page.waitForFunction(()=>document.querySelector('#modeLabel')?.textContent?.trim()!=='detecting',null,{timeout:30_000});
  const loaded=await page.evaluate(async({profile,timeoutMs})=>{
    globalThis.__xraiQualificationProgress=[];
    const work=(async()=>{
      if(profile==='lfm12b'){
        const {getLfm12bCandidate}=await import('./model-candidates.js');
        return getLfm12bCandidate(message=>globalThis.__xraiQualificationProgress.push(String(message)));
      }
      const {getLocalModel}=await import('./local-agent.js');
      return getLocalModel(message=>globalThis.__xraiQualificationProgress.push(String(message)));
    })().then(model=>{globalThis.__xraiQualificationModel=model;return{model:model.name,progress:globalThis.__xraiQualificationProgress}});
    return Promise.race([work,new Promise((_,reject)=>setTimeout(()=>reject(new Error(`model load timed out after ${Math.round(timeoutMs/1000)}s`)),timeoutMs))]);
  },{profile,timeoutMs:MODEL_LOAD_TIMEOUT_MS});
  report.model=loaded.model;report.progress=loaded.progress;report.modelLoadFinishedAt=new Date().toISOString();await persist();
  for(const item of cases){
    const started=Date.now();let output='';let graded;
    try{
      output=await page.evaluate(async({messages,maxNewTokens,timeoutMs})=>{
        if(!globalThis.__xraiQualificationModel)throw new Error('qualification model is not loaded');
        return Promise.race([globalThis.__xraiQualificationModel.prompt(messages,{maxNewTokens}),new Promise((_,reject)=>setTimeout(()=>reject(new Error(`case timed out after ${Math.round(timeoutMs/1000)}s`)),timeoutMs))]);
      },{messages:item.messages,maxNewTokens:item.maxNewTokens,timeoutMs:CASE_TIMEOUT_MS});
      graded=item.grade(output,Date.now()-started);
    }catch(error){
      graded={name:item.name,passed:false,output:String(output),durationMs:Date.now()-started,error:error instanceof Error?error.message:String(error)};
    }
    report.cases.push(graded);await persist();
    if(!graded.passed){report.stoppedEarly=true;report.stopReason=`${item.name} failed`;break}
  }
  report.passed=report.cases.filter(x=>x.passed).length;report.total=cases.length;report.executed=report.cases.length;report.ok=report.passed===report.total;report.finishedAt=new Date().toISOString();await persist();
  console.log(JSON.stringify({profile:report.profile,model:report.model,passed:report.passed,total:report.total,executed:report.executed,stoppedEarly:report.stoppedEarly||false,cases:report.cases.map(x=>({name:x.name,passed:x.passed,durationMs:x.durationMs,output:x.output,error:x.error}))},null,2));
  if(!report.ok)throw new Error(`Model qualification failed ${report.passed}/${report.total}; executed ${report.executed}/${report.total}`);
}catch(error){
  report.ok=false;report.error=error instanceof Error?error.message:String(error);report.finishedAt=new Date().toISOString();await persist();throw error;
}finally{
  await browser.close();
}
