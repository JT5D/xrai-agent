// Real WebContainer commands and browser storage; source fixture and model are scripted.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
const root=path.resolve('web'),artifacts='artifacts';
const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://local').pathname.replace(/^\/xrai-agent\//,'/');
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
  try{const body=await fs.readFile(file);res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'});res.end(body)}catch{res.writeHead(404);res.end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=process.argv[2]||`http://127.0.0.1:${server.address().port}/xrai-agent/`;
const report={base,mocked:['small public repository fixture','model actions'],real:['WebContainer Node process','test exit codes','UI submission','localStorage','reuse after reload'],checks:[]};
const files={'package.json':JSON.stringify({name:'xrai-learning-fixture',version:'1.0.0',type:'module',scripts:{test:'node --test test/value.test.js'}}),'src/value.js':'export const value=1;\n','test/value.test.js':"import {strict as assert} from 'node:assert';import {value} from '../src/value.js';assert.equal(value,2);\n"};
const sha='abc1234567890abc1234567890abc1234567890abc';
const timer=setTimeout(()=>{console.error('Learning E2E hard deadline');process.exit(124)},180000);
await fs.mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:false});
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    globalThis.learningModelCalls=0;
    const session=()=>({clone:async()=>session(),destroy(){},prompt:async()=>{globalThis.learningModelCalls++;return globalThis.learningModelCalls===1?JSON.stringify({tool:'patch',edits:[{path:'src/value.js',search:'value=1',replace:'value=2'}]}):JSON.stringify({tool:'finish',summary:'Fixed the value from real test feedback.'})}});
    globalThis.LanguageModel={availability:async()=> 'available',create:async()=>session()};
  });
  await page.route('https://api.github.com/repos/xrai-test-fixture/learning**',async route=>{
    const url=route.request().url();const body=url.includes('/git/trees/')?{tree:Object.entries(files).map(([path,text])=>({type:'blob',path,size:text.length}))}:url.includes('/commits/')?{sha}:{private:false,default_branch:'main',full_name:'xrai-test-fixture/learning'};
    await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Cross-Origin-Resource-Policy':'cross-origin'},body:JSON.stringify(body)});
  });
  await page.route('https://raw.githubusercontent.com/xrai-test-fixture/learning/**',async route=>{
    const p=new URL(route.request().url()).pathname.split('/').slice(4).join('/');
    await route.fulfill({status:files[p]===undefined?404:200,contentType:'text/plain',headers:{'Access-Control-Allow-Origin':'*','Cross-Origin-Resource-Policy':'cross-origin'},body:files[p]||''});
  });
  async function ready(){await page.waitForFunction(()=>document.querySelector('#modeLabel')?.textContent==='browser'&&!document.querySelector('#runButton')?.disabled,{},{timeout:30000})}
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('xrai-ui-v4')));
  async function submit(){await ready();await page.locator('#task').fill('fix tests in repo: xrai-test-fixture/learning');await page.locator('#runButton').click();await page.waitForFunction(()=>['completed','incomplete','error'].includes(JSON.parse(localStorage.getItem('xrai-ui-v4')).runStatus),{},{timeout:75000});const s=await state();assert.equal(s.runStatus,'completed',s.statusText+' '+s.result?.output);return s}
  await page.goto(base);await ready();assert.equal(await page.title(),'XRAI Agent');
  const first=await submit();assert.equal(first.result.learning.status,'retained');assert.ok(first.result.diff.includes('+export const value=2;'));assert.ok(first.result.evidence.every(r=>r.code===0));
  const beforeCalls=await page.evaluate(()=>globalThis.learningModelCalls);assert.equal(beforeCalls,2);
  await page.screenshot({path:`${artifacts}/learning-desktop.png`});
  await page.setViewportSize({width:390,height:844});await page.reload();await ready();
  const second=await submit();assert.equal(second.result.learning.status,'reused');assert.equal(await page.evaluate(()=>globalThis.learningModelCalls),0);
  await page.locator('[data-view="skills"]').first().click();await page.waitForTimeout(100);
  assert.match(await page.locator('#skillsContent').textContent(),/1 verified procedures/);assert.match(await page.locator('#skillsContent').textContent(),/1 verified reuses/);
  await page.screenshot({path:`${artifacts}/learning-mobile.png`});
  assert.deepEqual(errors,[]);report.checks.push({retained:true,verifiedReuseAfterReload:true,repairModelCalls:beforeCalls,reuseModelCalls:0,desktopWidth:1440,mobileWidth:390,pageErrors:errors});report.ok=true;
}catch(error){report.error=String(error.stack||error);throw error}
finally{clearTimeout(timer);await fs.writeFile(`${artifacts}/learning.json`,JSON.stringify(report,null,2));await browser.close();server.close()}
console.log(JSON.stringify(report));
