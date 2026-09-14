// Real UI + HTTP + subprocess. Controlled agent runner, NOT live model inference.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {startWebServer} from '../src/server.js';
import {chromium} from 'playwright';
const exec=promisify(execFile);
await fs.mkdir('artifacts/server-ui',{recursive:true});
const report={mocked:['agent runner'],real:['browser UI','HTTP transport','Node subprocess'],browser:'Chromium; mobile viewport is not iPhone/Safari',checks:[]};
let count=0,browser;
const {server,url}=await startWebServer(0,'127.0.0.1',{
  runner:async(task,opts)=>{
    count++;
    const {stdout}=await exec(process.execPath,['--input-type=module','-e','import assert from "node:assert/strict"; assert.equal(7+5,12); console.log("TRANSPORT_CHECK_PASSED");'],{timeout:5000});
    return{runId:opts.runId,status:'completed',output:`${stdout.trim()}: controlled runner, not model inference.`,provider:'transport-QA',learning:{status:'none'}};
  }
});
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:900}});
    const page=await context.newPage(),errors=[],consoleErrors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',e=>{if(e.type()==='error')consoleErrors.push(e.text())});
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#chatModeHint')?.textContent.includes('Local execution host connected'),null,{timeout:30000});
    assert.match(await page.title(),/XRAI/);
    assert.ok((await page.locator('body').innerText()).length>200);
    const initial=count;
    await page.locator('#task').fill('Run the transport verification fixture.');
    const waiting=page.waitForResponse(r=>r.url().endsWith('/api/runs')&&r.request().method()==='POST');
    await page.locator('#runButton').click();
    const response=await waiting,started=await response.json();
    assert.equal(response.status(),202);
    assert.equal(typeof started.runId,'string');
    await page.waitForFunction(()=>document.body.innerText.includes('TRANSPORT_CHECK_PASSED')&&!document.querySelector('#runButton')?.disabled,null,{timeout:15000});
    assert.equal(count,initial+1);
    const recovered=await (await fetch(`${url}/api/runs/${started.runId}`)).json();
    assert.equal(recovered.status,'completed');
    assert.match(recovered.result.output,/TRANSPORT_CHECK_PASSED/);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.body.innerText.includes('TRANSPORT_CHECK_PASSED'),null,{timeout:15000});
    assert.equal(count,initial+1,'Reload must not duplicate the completed execution');
    assert.deepEqual(errors,[]);
    assert.ok(consoleErrors.every(e=>/404/.test(e)),`Unexpected console errors: ${consoleErrors.join('; ')}`);
    await page.screenshot({path:`artifacts/server-ui/${width}.png`});
    report.checks.push({width,url:page.url(),title:await page.title(),httpStatus:response.status(),runId:started.runId,commandCompleted:true,reloadPreserved:true,exactlyOnce:true,pageErrors:errors,consoleErrors,consoleNote:'Only optional missing-resource 404s are tolerated.'});
    await context.close();
  }
  report.ok=true;
}catch(error){report.ok=false;report.error=error.stack;process.exitCode=1}
finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
  await fs.writeFile('artifacts/server-ui/report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
