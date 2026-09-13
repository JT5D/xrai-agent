// Real UI and status tool; CI responses are fixtures unless XRAI_STATUS_LIVE=1.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve('web'),live=process.env.XRAI_STATUS_LIVE==='1';
const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://local').pathname.replace(/^\/xrai-agent\//,'/');
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try{const body=await fs.readFile(file);res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'});res.end(body)}catch{res.writeHead(404);res.end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=(process.argv[2]||`http://127.0.0.1:${server.address().port}/xrai-agent/`).replace(/^http:\/\/jt5d/,'https://jt5d');
const out=process.env.XRAI_STATUS_ARTIFACTS||'artifacts';await fs.mkdir(out,{recursive:true});
const report={base,live,modelMocked:false,ciMocked:!live,browser:'Chromium; mobile viewport is not iOS',checks:[]};
const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,headless:true}:{channel:'chrome',headless:true});
try{
  for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:900},...(live?{}:{serviceWorkers:'block'})}),page=await context.newPage(),errors=[],modelRequests=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(/huggingface|transformers|onnx|model_q4/i.test(r.url()))modelRequests.push(r.url())});
    const sha='a'.repeat(40),runId=12;
    if(!live){
      await page.route('**/coi-bootstrap.js*',route=>route.fulfill({contentType:'text/javascript',body:"(async()=>{for(const f of ['input-guard.js','browser-enhancements.js','event-inspector.js','policy-inspector.js','improvement-guard.js','app.js'])await import('./'+f)})()"}));
      await page.route('**/build-info.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({repo:'JT5D/xrai-agent',sha,runId,version:'0.3.49'})}));
      await page.route('https://api.github.com/repos/JT5D/xrai-agent/actions/runs/12/jobs*',route=>route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({jobs:['deploy','conversation','chat-retry','mobile-chat','mobile-repo','model-runtime','web','repo'].map(n=>({name:n==='deploy'?n:`live-e2e (${n})`,head_sha:sha,run_id:runId,status:'completed',conclusion:'success'}))})}));
    }
    await page.goto(base);await page.waitForFunction(()=>document.querySelector('#modeLabel')?.textContent==='browser');
    assert.equal(await page.title(),'XRAI Agent');
    async function send(task){
      await page.locator('#task').fill(task);await page.locator('#runButton').click();
      await page.waitForFunction(()=>['completed','incomplete','error'].includes(JSON.parse(localStorage.getItem('xrai-ui-v4')).runStatus),null,{timeout:20000});
      const s=await page.evaluate(()=>JSON.parse(localStorage.getItem('xrai-ui-v4')));
      assert.equal(s.result?.provider,'runtime-evidence');assert.equal(s.messages.filter(m=>m.role==='user'&&m.text===task).length>=1,true);return s;
    }
    let s=await send('are we fixed & working now?');
    assert.match(s.result.output,/This tab: XRAI/);assert.doesNotMatch(s.result.output,/still under development|need more context/i);
    assert.match(s.result.output,/No repository verification/);
    if(live){assert.match(s.result.output,/Deployed build:/);assert.match(s.result.output,/Deployment evidence:/);}else assert.match(s.result.output,/SUCCESS live-e2e \(repo\)/);
    await send('try again');
    if(!live){
      await page.evaluate(({sha})=>{
        const s=JSON.parse(localStorage.getItem('xrai-ui-v4'));s.context={repo:'JT5D/xrai-agent',goal:'Fix duplicate replies in XRAI'};
        s.events.push({id:'imported',runId:'repo1',ts:Date.now(),type:'tool:done',name:'GitHub public repo',summary:'Imported repository',data:{repo:'JT5D/xrai-agent',sha}},
          {id:'evaluated',runId:'repo1',ts:Date.now(),type:'eval',summary:'Test failed',data:{commands:[{cmd:'npm test',exitCode:1,timedOut:false}]}},
          {id:'finished',runId:'repo1',ts:Date.now(),type:'run:done',summary:'Not verified',data:{status:'incomplete',changedFiles:[]}});
        localStorage.setItem('xrai-ui-v4',JSON.stringify(s));
      },{sha});
      await page.reload();await page.waitForFunction(()=>document.querySelector('#modeLabel')?.textContent==='browser');
      s=await send('what is our status?');assert.match(s.result.output,/FAIL npm test/);assert.equal(s.context.goal,'Fix duplicate replies in XRAI');
      await page.reload();await page.waitForFunction(()=>document.querySelector('#modeLabel')?.textContent==='browser');
      s=await send('are we fixed & working now?');assert.match(s.result.output,/FAIL npm test/);
    }
    assert.deepEqual(errors,[]);assert.deepEqual(modelRequests,[]);
    await page.screenshot({path:`${out}/status-${width}.png`,fullPage:false});
    report.checks.push({width,ok:true,output:s.result.output,provider:s.result.provider,pageErrors:errors,modelRequests,controlsVisible:await page.locator('#runButton').isVisible()});
    await context.close();
  }
  report.ok=true;
}finally{await fs.writeFile(`${out}/status.json`,JSON.stringify(report,null,2));await browser.close();server.close()}
console.log(JSON.stringify(report));
