import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
const profiles={
  cpu:{modelId:'onnx-community/Qwen3-0.6B-ONNX',device:'wasm',dtype:'q4'},
  gpu:{modelId:'onnx-community/Qwen3-0.6B-ONNX',device:'webgpu',dtype:'q4'},
  precision:{modelId:'onnx-community/Qwen2.5-0.5B-Instruct',device:'wasm',dtype:'q8'}
};
const profile={...profiles[process.env.PROFILE],maxNewTokens:256,label:process.env.PROFILE};
const file='web/local-agent.js',source=await fs.readFile(file,'utf8');
const needle='const preferred=await resolveBrowserModelProfile(navigator,true),';
if(!source.includes(needle))throw Error('Loader changed; inspect before patching');
await fs.writeFile(file,source.replace(needle,`const preferred=${JSON.stringify(profile)},`).replace('@4.0.1','@4.2.0').replace('repetition_penalty:1.05','repetition_penalty:1.0,tokenizer_encode_kwargs:{enable_thinking:false}'));
const root=path.resolve('web'),report={profile,mocked:[],cases:[],errors:[]};
await fs.mkdir('artifacts',{recursive:true});
const checkpoint=async()=>fs.writeFile('artifacts/inference.json',JSON.stringify(report,null,2));
await checkpoint();
const timer=setTimeout(()=>{report.error='Hard 270s diagnostic deadline';checkpoint().finally(()=>process.exit(124));},270000);
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://local'),p=path.resolve(root,'.'+url.pathname);
  const headers={'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cache-Control':'no-store'};
  if(url.pathname==='/probe'){res.writeHead(200,{...headers,'Content-Type':'text/html'});res.end('<title>Inference isolation</title>');return}
  if(!p.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
  try{const body=await fs.readFile(p);res.writeHead(200,{...headers,'Content-Type':p.endsWith('.js')?'text/javascript':'text/plain'});res.end(body)}catch{res.writeHead(404,headers);res.end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--enable-unsafe-swiftshader','--enable-features=Vulkan','--use-angle=vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--disable-vulkan-surface']});
  const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/probe`);
  const started=Date.now();
  report.provider=await page.evaluate(async()=>{globalThis.agent=await import('/local-agent.js');globalThis.model=await agent.getLocalModel();return model.name});
  report.loadMs=Date.now()-started;await checkpoint();
  const cases=[
    {name:'minimal-math',task:'What is 2 + 2? Reply with only the number.',minimal:true},
    {name:'app-math',task:'What is 2 + 2? Reply with only the number.'},
    {name:'app-instruction',task:'My project code is cobalt-47. Reply with only that code.'},
    {name:'app-recall',task:'What is my project code? Reply with only the code.',messages:[{role:'user',content:'My project code is cobalt-47. Reply with only that code.'},{role:'assistant',content:'cobalt-47'}]},
    {name:'patch',task:'Fix the failing sum test.\n\nREAL COMMAND EVIDENCE:\n$ npm test (exit 1)\nExpected 12; actual 2.\n\n--- src/sum.js ---\nexport function sum(a,b){return a-b;}\n--- test/sum.test.js ---\nassert.equal(sum(7,5),12);\n\nReturn JSON only: {"summary":"diagnosis","edits":[{"path":"src/sum.js","search":"exact existing text","replace":"replacement"}]}. Make the smallest correct edit to the source, not the test.',minimal:true}
  ];
  for(const c of cases){
    const start=Date.now();
    try{
      const output=await page.evaluate(async c=>c.minimal?model.prompt([{role:'system',content:c.name==='patch'?'You are XRAI Repo Fixer. Use only supplied real files and command evidence. Return JSON only. Never claim success until re-verification passes.':'You are a helpful assistant.'},{role:'user',content:c.task}]):(await agent.runLocalTask(c.task,{conversation:{repo:'JT5D/xrai-agent',goal:'',messages:c.messages||[]}})).output,c);
      const ok=c.name.endsWith('math')?/^4[.!]?$/.test(output.trim()):c.name==='patch'?(()=>{try{const p=JSON.parse(output.replace(/^```(?:json)?\s*|\s*```$/g,''));return p.edits?.some(e=>e.path==='src/sum.js'&&'export function sum(a,b){return a-b;}'.includes(e.search)&&e.search!==e.replace&&e.replace?.includes('+'))}catch{return false}})():output.trim()==='cobalt-47';
      report.cases.push({name:c.name,output,ok,ms:Date.now()-start});
    }catch(e){report.cases.push({name:c.name,ok:false,error:e.message,ms:Date.now()-start})}
    await checkpoint();
  }
  report.ok=report.cases.length===cases.length&&report.cases.every(c=>c.ok);
}catch(e){report.error=e.message;report.ok=false}
finally{await checkpoint();console.log(JSON.stringify(report));clearTimeout(timer);await browser?.close();server.close()}
if(!report.ok)process.exitCode=1;
