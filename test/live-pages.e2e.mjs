import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const rawBase=process.argv[2]||process.env.XRAI_LIVE_URL||'https://jt5d.github.io/xrai-agent/';
const base=rawBase.replace(/^http:/,'https:').replace(/\/?$/,'/');
const artifacts='artifacts';
await fs.mkdir(artifacts,{recursive:true});

const report={base,startedAt:new Date().toISOString(),flows:{},consoleErrors:[],pageErrors:[]};
let browser;
let page;

async function state(){
  return page.evaluate(()=>{try{return JSON.parse(localStorage.getItem('xrai-ui-v4')||'null')}catch{return null}});
}
async function userMessages(){return page.locator('#messages .msg.user .bubble p').allTextContents()}
async function agentMessages(){return page.locator('#messages .msg.agent .bubble p').allTextContents()}
async function waitForReady(timeout=60_000){
  await page.waitForSelector('#task',{timeout});
  const end=Date.now()+timeout;
  while(Date.now()<end){
    try{if(await page.locator('#runButton').isEnabled())return}catch{}
    await page.waitForTimeout(250);
  }
  throw new Error('Run button never became ready');
}
async function waitForNewResult(oldRun,timeout=240_000){
  const end=Date.now()+timeout;
  while(Date.now()<end){
    try{
      const s=await state();
      if(s?.result?.runId&&s.result.runId!==oldRun&&['completed','error'].includes(s.runStatus))return s;
    }catch{}
    await page.waitForTimeout(500);
  }
  throw new Error(`Timed out waiting for a new completed run after ${Math.round(timeout/1000)}s`);
}
async function submit(text,timeout=240_000){
  await waitForReady();
  const before=await state(),oldRun=before?.result?.runId||null;
  await page.locator('#task').fill(text);
  await page.locator('#runButton').click({noWaitAfter:true});
  return waitForNewResult(oldRun,timeout);
}
function require(condition,message){if(!condition)throw new Error(message)}

try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  page=await context.newPage();
  page.on('console',msg=>{if(msg.type()==='error')report.consoleErrors.push(msg.text())});
  page.on('pageerror',error=>report.pageErrors.push(String(error?.stack||error)));

  await page.goto(`${base}?e2e=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60_000});
  await page.waitForSelector('#task',{timeout:60_000});
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear()});
  await page.reload({waitUntil:'domcontentloaded',timeout:60_000});
  await waitForReady(60_000);

  report.runtime=await page.evaluate(()=>({href:location.href,userAgent:navigator.userAgent,deviceMemory:navigator.deviceMemory??null,webgpu:Boolean(navigator.gpu),crossOriginIsolated:globalThis.crossOriginIsolated}));

  // A. Normal chat: exact user message once, real model response, no silent hang.
  {
    const task='What is 2 + 2? Reply briefly.';
    const beforeAgents=(await agentMessages()).length;
    const result=await submit(task,240_000);
    const users=await userMessages(),agents=await agentMessages();
    require(users.filter(x=>x===task).length===1,`normal chat user message count was ${users.filter(x=>x===task).length}, expected 1`);
    require(result.runStatus==='completed',`normal chat ended with ${result.runStatus}: ${result.statusText||''}`);
    require(agents.length>beforeAgents,'normal chat produced no agent response');
    require(String(result.result?.output||'').trim().length>0,'normal chat result output was empty');
    report.flows.chat={ok:true,provider:result.result?.provider,runId:result.result?.runId,output:String(result.result?.output||'').slice(0,500)};
  }

  // B. Retry: visible user text remains exactly "try again" and prior task reruns internally.
  {
    const prior=await state(),oldRun=prior?.result?.runId;
    await waitForReady();
    await page.locator('#task').fill('try again');
    await page.locator('#runButton').click({noWaitAfter:true});
    const result=await waitForNewResult(oldRun,240_000);
    const users=await userMessages();
    require(users.filter(x=>x==='try again').length===1,`retry visible message count was ${users.filter(x=>x==='try again').length}, expected 1`);
    require(users.at(-1)==='try again',`retry did not remain the latest visible user message; latest was ${JSON.stringify(users.at(-1))}`);
    require(!users.some(x=>x.includes('Previous XRAI context')),'hidden retry context leaked into visible user chat');
    require(result.runStatus==='completed',`retry ended with ${result.runStatus}: ${result.statusText||''}`);
    require(result.result?.runId!==oldRun,'retry did not execute a new run');
    report.flows.retry={ok:true,runId:result.result?.runId,visibleLatest:users.at(-1)};
  }

  // D. Fresh web research: browser tool path returns live source evidence.
  {
    const task='Search the web for the current Model Context Protocol specification and give source URLs.';
    const result=await submit(task,90_000);
    const events=result.events||[],output=String(result.result?.output||'');
    require(result.runStatus==='completed',`web research ended with ${result.runStatus}: ${result.statusText||''}`);
    require(events.some(e=>e.name==='web_search'||/web search/i.test(String(e.summary||''))),'web research recorded no web_search execution event');
    require(/https?:\/\//.test(output),'web research output contained no source URL');
    report.flows.web={ok:true,provider:result.result?.provider,runId:result.result?.runId,output:output.slice(0,700)};
  }

  // C. Repo execution: real public repo import + deterministic verifier evidence.
  {
    const task='review repo, fix any failed tests, verify & explain';
    const result=await submit(task,300_000);
    const events=result.events||[];
    require(result.runStatus==='completed',`repo execution ended with ${result.runStatus}: ${result.statusText||''}`);
    require(result.result?.provider==='browser-webcontainer',`repo execution provider was ${result.result?.provider||'none'}, expected browser-webcontainer`);
    require(result.result?.repo==='JT5D/xrai-agent',`repo execution targeted ${result.result?.repo||'none'}`);
    require(events.some(e=>e.name==='GitHub public repo'&&e.type==='tool:done'),'repo execution lacks real GitHub import evidence');
    require(events.some(e=>e.name==='Test verifier'&&e.type==='tool:done'&&/PASS/.test(String(e.summary||''))),'repo execution lacks passing deterministic verifier evidence');
    report.flows.repo={ok:true,provider:result.result?.provider,repo:result.result?.repo,sha:result.result?.sha,changedFiles:result.result?.changedFiles||[],runId:result.result?.runId};
  }

  // E. X-ray/provenance: visible graph nodes bind to actual persisted event ids.
  {
    const result=await state(),ids=new Set((result.events||[]).map(e=>e.id));
    const nodeIds=await page.locator('#graph .node[data-event-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.eventId).filter(Boolean));
    require(nodeIds.length>0,'X-ray rendered no event-bound provenance nodes');
    require(nodeIds.every(id=>ids.has(id)),'X-ray contains a node not backed by a recorded execution event');
    const graphText=await page.locator('#graph').innerText();
    require(/Test verifier|GitHub public repo|User Goal/.test(graphText),'X-ray does not visibly reflect the executed repo path');
    report.flows.provenance={ok:true,boundNodes:nodeIds.length,recordedEvents:ids.size};
  }

  report.ok=true;
}catch(error){
  report.ok=false;report.error=String(error?.stack||error);
  if(page){
    report.failureState=await state().catch(()=>null);
    report.visibleStatus=await page.locator('#status').textContent().catch(()=>null);
    report.visibleProgress=await page.locator('#progressLabel').textContent().catch(()=>null);
    report.userMessages=await userMessages().catch(()=>[]);
    report.agentMessages=await agentMessages().catch(()=>[]);
    report.runtime=report.runtime||await page.evaluate(()=>({href:location.href,userAgent:navigator.userAgent,deviceMemory:navigator.deviceMemory??null,webgpu:Boolean(navigator.gpu),crossOriginIsolated:globalThis.crossOriginIsolated})).catch(()=>null);
    await page.screenshot({path:`${artifacts}/live-e2e-failure.png`,fullPage:true}).catch(()=>{});
  }
  throw error;
}finally{
  report.finishedAt=new Date().toISOString();
  await fs.writeFile(`${artifacts}/live-e2e-report.json`,JSON.stringify(report,null,2));
  if(browser)await browser.close().catch(()=>{});
  console.log(JSON.stringify(report,null,2));
}
