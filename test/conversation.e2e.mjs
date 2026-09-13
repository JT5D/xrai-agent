// Deterministic UI contract tests. Mock model/search; not evidence of real AI quality.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve('web');
const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://local').pathname.replace(/^\/xrai-agent\//,'/');
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
  try{const body=await fs.readFile(file);res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'});res.end(body)}catch{res.writeHead(404);res.end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=process.argv[2]||`http://127.0.0.1:${server.address().port}/xrai-agent/`;
await fs.mkdir('artifacts',{recursive:true});
const report={base,mocked:['language model','search providers'],browser:'Chromium (mobile viewport is not iOS)',checks:[]};
const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,headless:true}:{channel:'chrome',headless:true});
try{
  for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    // Bypass only service-worker registration; app module loading remains real.
    await page.route('**/coi-bootstrap.js*',async route=>route.fulfill({contentType:'text/javascript',body:"(async()=>{for(const f of ['input-guard.js','browser-enhancements.js','event-inspector.js','policy-inspector.js','improvement-guard.js','app.js'])await import('./'+f)})()"}));
    await page.addInitScript(()=>{
      globalThis.testPrompts=[];
      const session=()=>({clone:async()=>session(),destroy(){},async prompt(text){
        globalThis.testPrompts.push(String(text));await new Promise(r=>setTimeout(r,250));
        return 'This is a proposed plan, not an executed change.';
      }});
      globalThis.LanguageModel={availability:async()=> 'available',create:async()=>session()};
    });
    await page.route(/https:\/\/(?:search\.jina\.ai|api\.duckduckgo\.com|en\.wikipedia\.org|hn\.algolia\.com|api\.github\.com\/search)/,async route=>{
      await new Promise(r=>setTimeout(r,250));
      const u=route.request().url(),item={title:'AI agent orchestration tools',url:'https://github.com/example/agents',description:'AI agent orchestration tools'};
      const body=u.includes('wikipedia')?{query:{search:[{title:item.title,snippet:item.description}]}}:u.includes('duckduckgo')?{Heading:item.title,AbstractText:item.description,AbstractURL:item.url}:u.includes('algolia')?{hits:[item]}:u.includes('api.github')?{items:[{...item,full_name:'example/agents',html_url:item.url}]}:{};
      await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Cross-Origin-Resource-Policy':'cross-origin'},body:JSON.stringify(body)});
    });
    await page.goto(base);await page.waitForFunction(()=>document.querySelector('#modeLabel')?.textContent==='browser');
    assert.equal(await page.title(),'XRAI Agent');
    const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('xrai-ui-v4')));
    async function send(task){
      await page.locator('#task').fill(task);await page.locator('#runButton').click();
      await page.waitForFunction(()=>['completed','incomplete','error'].includes(JSON.parse(localStorage.getItem('xrai-ui-v4')).runStatus));
      const s=await state();assert.notEqual(s.runStatus,'error',s.statusText);return s;
    }
    await send('Help me design conversation memory for XRAI and prevent duplicate replies.');
    const before=await state();
    await page.locator('#task').fill('try again');await page.locator('#runButton').click();
    await page.evaluate(()=>{document.querySelector('#task').value='second concurrent request';document.querySelector('#chatForm').requestSubmit()});
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('xrai-ui-v4')).runStatus==='completed');
    let s=await state();assert.equal(s.messages.filter(m=>m.role==='user').length,2);assert.equal(s.messages.filter(m=>m.text==='try again').length,1);
    assert.ok(s.events.length>before.events.length,'prior evidence was erased');
    const prompts=await page.evaluate(()=>globalThis.testPrompts);assert.equal(prompts.length,2);assert.match(prompts[1],/prevent duplicate replies/);
    assert.ok(s.messages.every(m=>!m.text.includes('Previous XRAI context')));
    await send('research similar popular repos and recommend improvements');
    const proof=await send('did self improvements happen?');
    assert.match(proof.result.output,/^0 verified improvements/,'proof questions must not rerun the prior search');
    s=await send('Summarize what we discussed.');
    assert.match((await page.evaluate(()=>globalThis.testPrompts)).at(-1),/research similar popular repos/);
    assert.equal(s.messages.filter(m=>m.role==='user').length,5);assert.equal(s.messages.filter(m=>m.role==='agent'&&m.id!=='welcome').length,5);
    await page.reload();await page.waitForFunction(()=>document.querySelector('#modeLabel')?.textContent==='browser');
    assert.equal((await state()).messages.length,s.messages.length);
    await page.screenshot({path:`artifacts/conversation-${width}.png`,fullPage:false});
    assert.deepEqual(errors,[]);report.checks.push({width,passed:true,userTurns:5,assistantTurns:5,reload:true,historyInModelInput:true,duplicateRejected:true,pageErrors:errors});
    await context.close();
  }
  report.ok=true;
}finally{await fs.writeFile('artifacts/conversation.json',JSON.stringify(report,null,2));await browser.close();server.close()}
console.log(JSON.stringify(report));
