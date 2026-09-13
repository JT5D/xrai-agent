// Export contract only. Seeded UI result; no model or autonomous repair claim.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {buildChangeReport} from '../web/browser-workspace.js';
import {chromium} from 'playwright';
await fs.mkdir('artifacts',{recursive:true});
const report={scope:'Patch generation and download only; seeded UI result, not AI repair',cases:[],views:[],browser:'Chromium; mobile viewport is not iOS'};
const verify=async(before,after,patch)=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'xrai-patch-'));
  try{await fs.mkdir(path.join(dir,'src'));await fs.writeFile(path.join(dir,'src/sum.js'),before);await fs.writeFile(path.join(dir,'change.patch'),patch);execFileSync('git',['apply','--check','change.patch'],{cwd:dir});execFileSync('git',['apply','change.patch'],{cwd:dir});assert.equal(await fs.readFile(path.join(dir,'src/sum.js'),'utf8'),after)}finally{await fs.rm(dir,{recursive:true,force:true})}
};
for(const [before,after] of [['a\n','b\n'],['a','b'],['','b\n'],['a\n',''],['a\n','a'],['a','a\n'],['a\nb\nc\n','a\nx\nc\n'],['0\n1\n2\n3\n4\n5\n6\n7\n','0\n1\n2\n3\nX\n5\n6\n7\n']]){
  await verify(before,after,buildChangeReport([{path:'src/sum.js',before,after}]));report.cases.push({before,after,applies:true});
}
const root=path.resolve('web');
const server=http.createServer(async(req,res)=>{
  const name=new URL(req.url,'http://local').pathname.replace(/^\/xrai-agent\//,'/'),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  const headers={'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cache-Control':'no-store'};
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
  try{const data=await fs.readFile(file);res.writeHead(200,{...headers,'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});res.end(data)}catch{res.writeHead(404,headers);res.end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=process.argv[2]||`http://127.0.0.1:${server.address().port}/xrai-agent/`;
const before='export function sum(a,b){return a-b;}\n',after='export function sum(a,b){return a+b;}\n';
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true});
    const patch=buildChangeReport([{path:'src/sum.js',before,after}]);
    await context.addInitScript(patch=>{
      if(sessionStorage.getItem('patch-fixture-seeded'))return;
      sessionStorage.setItem('patch-fixture-seeded','1');
      localStorage.setItem('xrai-ui-v4',JSON.stringify({version:4,view:'workspace',lastTask:'Patch export QA fixture (not an AI-generated repair)',runStatus:'completed',statusText:'Export fixture ready',messages:[],events:[],result:{diff:patch,repo:'xrai-e2e/repair',output:'Patch export QA fixture only.',score:null,changedFiles:['src/sum.js']}}));
    },patch);
    const page=await context.newPage(),errors=[],consoleErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')consoleErrors.push(e.text())});
    await page.goto(base);await page.waitForFunction(()=>document.querySelector('#modeLabel')?.textContent==='browser',null,{timeout:30000});
    const actual=await page.evaluate(async({before,after})=>{const {buildChangeReport}=await import('./browser-workspace.js');return buildChangeReport([{path:'src/sum.js',before,after}])},{before,after});
    assert.equal(actual,patch,'Served exporter must match the tested code');
    await page.reload();await page.locator('#downloadPatch').waitFor({state:'visible'});
    assert.match(await page.title(),/XRAI/i);assert.ok((await page.locator('body').innerText()).length>200);
    const waiting=page.waitForEvent('download');await page.locator('#downloadPatch').click();const download=await waiting;const file=`artifacts/download-${width}.patch`;await download.saveAs(file);assert.equal(await download.failure(),null);
    assert.equal(await fs.readFile(file,'utf8'),patch);await verify(before,after,patch);
    await page.screenshot({path:`artifacts/patch-${width}.png`});assert.deepEqual(errors,[]);
    assert.ok(consoleErrors.every(e=>e.includes('404')),`Unexpected console error: ${consoleErrors.join('; ')}`);
    report.views.push({width,url:page.url(),title:await page.title(),downloadApplies:true,pageErrors:errors,consoleErrors,consoleNote:'Missing optional local-host API/favicon returns 404 in static browser mode.'});await context.close();
  }
  report.ok=true;
}catch(e){report.ok=false;report.error=e.stack}
finally{await fs.writeFile('artifacts/patch-export.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser?.close();server.close()}
if(!report.ok)process.exitCode=1;
