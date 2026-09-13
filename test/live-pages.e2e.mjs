import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';

const rawBase=process.argv[2]||process.env.XRAI_LIVE_URL||'https://jt5d.github.io/xrai-agent/';
const flow=process.argv[3]||process.env.XRAI_E2E_FLOW||'smoke';
const base=rawBase.replace(/^http:/,'https:').replace(/\/?$/,'/');
const artifacts='artifacts';
await fs.mkdir(artifacts,{recursive:true});
const reportPath=`${artifacts}/live-e2e-${flow}.json`;
const report={base,flow,startedAt:new Date().toISOString(),phase:'starting',flows:{},consoleErrors:[],pageErrors:[],submitProbes:[],navigations:[]};
let browser;
let page;

function checkpoint(phase){
  report.phase=phase;report.updatedAt=new Date().toISOString();
  fsSync.writeFileSync(reportPath,JSON.stringify(report,null,2));
  console.log(`[live-e2e:${flow}] ${phase}`);
}
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{report.cancelled=true;checkpoint(`cancelled:${signal}`);process.exit(143)});

async function state(){return page.evaluate(()=>{try{return JSON.parse(localStorage.getItem('xrai-ui-v4')||'null')}catch{return null}})}
async function userMessages(){return page.locator('#messages .msg.user .bubble p').allTextContents()}
async function agentMessages(){return page.locator('#messages .msg.agent .bubble p').allTextContents()}
async function waitForReady(timeout=60_000){
  await page.waitForSelector('#task',{timeout});
  await page.waitForFunction(()=>{
    const mode=document.querySelector('#modeLabel')?.textContent?.trim();
    const run=document.querySelector('#runButton');
    const welcome=document.querySelector('#messages .msg.agent .bubble p');
    return Boolean(mode&&mode!=='detecting'&&run&&!run.disabled&&welcome);
  },null,{timeout});
}
async function waitForNewResult(oldRun,timeout){
  const end=Date.now()+timeout;
  while(Date.now()<end){
    try{const s=await state();if(s?.result?.runId&&s.result.runId!==oldRun&&['completed','error'].includes(s.runStatus))return s}catch{}
    await page.waitForTimeout(500);
  }
  throw new Error(`Timed out waiting for a new completed run after ${Math.round(timeout/1000)}s`);
}
async function waitForTaskRegistration(text,timeout=3000){
  const end=Date.now()+timeout;
  while(Date.now()<end){
    try{
      const s=await state();
      if(s?.lastTask===text||s?.messages?.some(m=>m?.role==='user'&&m?.text===text)||s?.runStatus==='running')return s;
    }catch{}
    await page.waitForTimeout(100);
  }
  return null;
}
async function submit(text,timeout){
  await waitForReady();
  const before=await state(),oldRun=before?.result?.runId||null;
  const probe={text,hrefBefore:page.url(),beforeState:before};
  await page.evaluate(()=>{
    globalThis.__xraiE2EProbe={clicks:0,submits:0};
    document.querySelector('#runButton')?.addEventListener('click',()=>globalThis.__xraiE2EProbe.clicks++,true);
    document.querySelector('#chatForm')?.addEventListener('submit',()=>globalThis.__xraiE2EProbe.submits++,true);
  });
  await page.locator('#task').fill(text);
  probe.beforeClick=await page.evaluate(()=>({value:document.querySelector('#task')?.value||'',disabled:Boolean(document.querySelector('#runButton')?.disabled),mode:document.querySelector('#modeLabel')?.textContent?.trim()||'',probe:globalThis.__xraiE2EProbe||null}));
  await page.locator('#runButton').click({noWaitAfter:true});
  let registered=await waitForTaskRegistration(text,3000);
  probe.afterClick={href:page.url(),state:await state().catch(()=>null),dom:await page.evaluate(()=>({value:document.querySelector('#task')?.value||'',disabled:Boolean(document.querySelector('#runButton')?.disabled),probe:globalThis.__xraiE2EProbe||null})).catch(()=>null),registered:Boolean(registered)};
  if(!registered){
    await page.locator('#chatForm').evaluate(form=>form.requestSubmit());
    const requestRegistered=await waitForTaskRegistration(text,3000);
    probe.afterRequestSubmit={href:page.url(),state:await state().catch(()=>null),dom:await page.evaluate(()=>({value:document.querySelector('#task')?.value||'',disabled:Boolean(document.querySelector('#runButton')?.disabled),probe:globalThis.__xraiE2EProbe||null})).catch(()=>null),registered:Boolean(requestRegistered)};
    report.submitProbes.push(probe);checkpoint('submit:not-registered');
    throw new Error(`User click did not register task state within 3s; requestSubmit registered=${Boolean(requestRegistered)}`);
  }
  report.submitProbes.push(probe);checkpoint('submit:registered');
  return waitForNewResult(oldRun,timeout);
}
function require(condition,message){if(!condition)throw new Error(message)}

async function runChatRetry(){
  checkpoint('chat:start');
  const task='What is 2 + 2? Reply briefly.';
  const beforeAgents=(await agentMessages()).length;
  const chat=await submit(task,210_000);
  const users=await userMessages(),agents=await agentMessages();
  require(users.filter(x=>x===task).length===1,`normal chat user message count was ${users.filter(x=>x===task).length}, expected 1`);
  require(chat.runStatus==='completed',`normal chat ended with ${chat.runStatus}: ${chat.statusText||''}`);
  require(agents.length>beforeAgents,'normal chat produced no agent response');
  require(String(chat.result?.output||'').trim().length>0,'normal chat result output was empty');
  report.flows.chat={ok:true,provider:chat.result?.provider,runId:chat.result?.runId,output:String(chat.result?.output||'').slice(0,500)};
  checkpoint('chat:done');

  checkpoint('retry:start');
  const prior=await state(),oldRun=prior?.result?.runId;
  await waitForReady();
  await page.locator('#task').fill('try again');
  await page.locator('#runButton').click({noWaitAfter:true});
  const retry=await waitForNewResult(oldRun,210_000);
  const retryUsers=await userMessages();
  require(retryUsers.filter(x=>x==='try again').length===1,`retry visible message count was ${retryUsers.filter(x=>x==='try again').length}, expected 1`);
  require(retryUsers.at(-1)==='try again',`retry did not remain the latest visible user message; latest was ${JSON.stringify(retryUsers.at(-1))}`);
  require(!retryUsers.some(x=>x.includes('Previous XRAI context')),'hidden retry context leaked into visible user chat');
  require(retry.runStatus==='completed',`retry ended with ${retry.runStatus}: ${retry.statusText||''}`);
  require(retry.result?.runId!==oldRun,'retry did not execute a new run');
  report.flows.retry={ok:true,runId:retry.result?.runId,visibleLatest:retryUsers.at(-1)};
  checkpoint('retry:done');
}

async function runWeb(){
  checkpoint('web:start');
  const task='Search the web for the current Model Context Protocol specification and give source URLs.';
  const result=await submit(task,75_000),events=result.events||[],output=String(result.result?.output||'');
  require(result.runStatus==='completed',`web research ended with ${result.runStatus}: ${result.statusText||''}`);
  require(events.some(e=>e.name==='web_search'||/web search/i.test(String(e.summary||''))),'web research recorded no web_search execution event');
  require(/https?:\/\//.test(output),'web research output contained no source URL');
  report.flows.web={ok:true,provider:result.result?.provider,runId:result.result?.runId,output:output.slice(0,700)};
  checkpoint('web:done');
}

async function runRepo(){
  checkpoint('repo:start');
  const task='review repo, fix any failed tests, verify & explain';
  const result=await submit(task,420_000),events=result.events||[];
  require(result.runStatus==='completed',`repo execution ended with ${result.runStatus}: ${result.statusText||''}`);
  require(result.result?.provider==='browser-webcontainer',`repo execution provider was ${result.result?.provider||'none'}, expected browser-webcontainer`);
  require(result.result?.repo==='JT5D/xrai-agent',`repo execution targeted ${result.result?.repo||'none'}`);
  require(events.some(e=>e.name==='GitHub public repo'&&e.type==='tool:done'),'repo execution lacks real GitHub import evidence');
  require(events.some(e=>e.name==='Test verifier'&&e.type==='tool:done'&&/PASS/.test(String(e.summary||''))),'repo execution lacks passing deterministic verifier evidence');
  report.flows.repo={ok:true,provider:result.result?.provider,repo:result.result?.repo,sha:result.result?.sha,changedFiles:result.result?.changedFiles||[],runId:result.result?.runId};
  checkpoint('repo:done');

  checkpoint('provenance:start');
  const persisted=await state(),ids=new Set((persisted.events||[]).map(e=>e.id));
  const nodeIds=await page.locator('#graph .node[data-event-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.eventId).filter(Boolean));
  require(nodeIds.length>0,'X-ray rendered no event-bound provenance nodes');
  require(nodeIds.every(id=>ids.has(id)),'X-ray contains a node not backed by a recorded execution event');
  const graphText=await page.locator('#graph').innerText();
  require(/Test verifier|GitHub public repo|User Goal/.test(graphText),'X-ray does not visibly reflect the executed repo path');
  report.flows.provenance={ok:true,boundNodes:nodeIds.length,recordedEvents:ids.size};
  checkpoint('provenance:done');
}

try{
  checkpoint('browser:launch');
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  page=await context.newPage();
  page.on('console',msg=>{if(msg.type()==='error')report.consoleErrors.push(msg.text())});
  page.on('pageerror',error=>report.pageErrors.push(String(error?.stack||error)));
  page.on('framenavigated',frame=>{if(frame===page.mainFrame()){report.navigations.push({url:frame.url(),ts:new Date().toISOString()});checkpoint('navigation')}});

  await page.goto(`${base}?e2e=${flow}-${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60_000});
  await page.waitForSelector('#task',{timeout:60_000});
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear()});
  await page.reload({waitUntil:'domcontentloaded',timeout:60_000});
  await waitForReady(60_000);
  report.runtime=await page.evaluate(()=>({href:location.href,userAgent:navigator.userAgent,deviceMemory:navigator.deviceMemory??null,webgpu:Boolean(navigator.gpu),crossOriginIsolated:globalThis.crossOriginIsolated,mode:document.querySelector('#modeLabel')?.textContent?.trim()||null}));
  checkpoint('runtime:ready');

  if(flow==='chat-retry')await runChatRetry();
  else if(flow==='web')await runWeb();
  else if(flow==='repo')await runRepo();
  else if(flow!=='smoke')throw new Error(`Unknown E2E flow: ${flow}`);
  else report.flows.runtime={ok:true,...report.runtime};

  report.ok=true;checkpoint('complete');
  await page.screenshot({path:`${artifacts}/live-e2e-${flow}-success.png`,fullPage:true}).catch(()=>{});
}catch(error){
  report.ok=false;report.error=String(error?.stack||error);
  if(page){
    report.failureState=await state().catch(()=>null);
    report.visibleStatus=await page.locator('#status').textContent().catch(()=>null);
    report.visibleProgress=await page.locator('#progressLabel').textContent().catch(()=>null);
    report.userMessages=await userMessages().catch(()=>[]);
    report.agentMessages=await agentMessages().catch(()=>[]);
    await page.screenshot({path:`${artifacts}/live-e2e-${flow}-failure.png`,fullPage:true}).catch(()=>{});
  }
  checkpoint('failed');throw error;
}finally{
  report.finishedAt=new Date().toISOString();checkpoint(report.ok?'finished':'failed:finished');
  if(browser)await browser.close().catch(()=>{});
}
