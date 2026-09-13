import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';

const rawBase=process.argv[2]||process.env.XRAI_LIVE_URL||'https://jt5d.github.io/xrai-agent/';
const flow=process.argv[3]||process.env.XRAI_E2E_FLOW||'smoke';
const base=rawBase.replace(/^http:/,'https:').replace(/\/?$/,'/');
const artifacts='artifacts';
const FLOW_DEADLINES={smoke:60_000,web:45_000,'chat-retry':180_000,repo:360_000};
const flowDeadline=FLOW_DEADLINES[flow]||180_000;
await fs.mkdir(artifacts,{recursive:true});
const reportPath=`${artifacts}/live-e2e-${flow}.json`;
const report={base,flow,startedAt:new Date().toISOString(),phase:'starting',flows:{},consoleErrors:[],pageErrors:[],submitProbes:[],navigations:[],networkEvents:[],flowDeadlineMs:flowDeadline,lastHeartbeat:null};
let browser;
let page;
let finished=false;

function checkpoint(phase){
  report.phase=phase;report.updatedAt=new Date().toISOString();
  fsSync.writeFileSync(reportPath,JSON.stringify(report,null,2));
  console.log(`[live-e2e:${flow}] ${phase}`);
}
function timeoutError(label,ms){return new Error(`${label} timed out after ${Math.round(ms/1000)}s`)}
async function within(promise,label,ms){
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(timeoutError(label,ms)),ms)})])}
  finally{clearTimeout(timer)}
}
async function safe(promise,ms=3000){try{return await within(promise,'diagnostic browser RPC',ms)}catch{return null}}
const hardTimer=setTimeout(()=>{
  if(finished)return;
  report.ok=false;report.hardTimeout=true;report.error=`Hard ${flow} flow deadline exceeded after ${Math.round(flowDeadline/1000)}s`;
  report.heartbeatAgeMs=report.lastHeartbeat?Date.now()-report.lastHeartbeat:null;
  checkpoint('hard-timeout');
  process.exit(124);
},flowDeadline);
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{report.cancelled=true;report.heartbeatAgeMs=report.lastHeartbeat?Date.now()-report.lastHeartbeat:null;checkpoint(`cancelled:${signal}`);process.exit(143)});

async function state(){return within(page.evaluate(()=>{try{return JSON.parse(localStorage.getItem('xrai-ui-v4')||'null')}catch{return null}}),'state snapshot',3000)}
async function userMessages(){return within(page.locator('#messages .msg.user .bubble p').allTextContents(),'user messages',3000)}
async function agentMessages(){return within(page.locator('#messages .msg.agent .bubble p').allTextContents(),'agent messages',3000)}
async function waitForReady(timeout=30_000){
  await within(page.waitForSelector('#task',{timeout}),'composer ready',timeout+1000);
  await within(page.waitForFunction(()=>{
    const mode=document.querySelector('#modeLabel')?.textContent?.trim();
    const run=document.querySelector('#runButton');
    const welcome=document.querySelector('#messages .msg.agent .bubble p');
    return Boolean(mode&&mode!=='detecting'&&run&&!run.disabled&&welcome);
  },null,{timeout}),'runtime ready',timeout+1000);
}
async function waitForNewResult(oldRun,timeout){
  await within(page.waitForFunction(previous=>{
    try{
      const s=JSON.parse(localStorage.getItem('xrai-ui-v4')||'null');
      return Boolean(s?.result?.runId&&s.result.runId!==previous&&['completed','error'].includes(s.runStatus));
    }catch{return false}
  },oldRun,{timeout,polling:250}),'new result',timeout+1000);
  return state();
}
async function waitForTaskRegistration(text,timeout=3000){
  try{
    await within(page.waitForFunction(expected=>{
      try{
        const s=JSON.parse(localStorage.getItem('xrai-ui-v4')||'null');
        return Boolean(s?.lastTask===expected||s?.messages?.some(m=>m?.role==='user'&&m?.text===expected)||s?.runStatus==='running');
      }catch{return false}
    },text,{timeout,polling:100}),'task registration',timeout+1000);
    return state();
  }catch{return null}
}
async function submit(text,timeout){
  await waitForReady();
  const before=await state(),oldRun=before?.result?.runId||null;
  const probe={text,hrefBefore:page.url(),beforeState:before};
  await within(page.evaluate(()=>{
    globalThis.__xraiE2EProbe={clicks:0,submits:0};
    document.querySelector('#runButton')?.addEventListener('click',()=>globalThis.__xraiE2EProbe.clicks++,true);
    document.querySelector('#chatForm')?.addEventListener('submit',()=>globalThis.__xraiE2EProbe.submits++,true);
  }),'install submit probe',3000);
  await within(page.locator('#task').fill(text,{timeout:5000}),'fill task',6000);
  probe.beforeClick=await within(page.evaluate(()=>({value:document.querySelector('#task')?.value||'',disabled:Boolean(document.querySelector('#runButton')?.disabled),mode:document.querySelector('#modeLabel')?.textContent?.trim()||'',probe:globalThis.__xraiE2EProbe||null})),'pre-click probe',3000);
  await within(page.locator('#runButton').click({noWaitAfter:true,timeout:5000}),'submit click',6000);
  const registered=await waitForTaskRegistration(text,3000);
  probe.afterClick={href:page.url(),state:await safe(state()),dom:await safe(page.evaluate(()=>({value:document.querySelector('#task')?.value||'',disabled:Boolean(document.querySelector('#runButton')?.disabled),probe:globalThis.__xraiE2EProbe||null}))),registered:Boolean(registered)};
  if(!registered){
    const heartbeatAge=report.lastHeartbeat?Date.now()-report.lastHeartbeat:null;
    probe.heartbeatAgeMs=heartbeatAge;report.submitProbes.push(probe);checkpoint('submit:not-registered');
    throw new Error(`User click did not register task state within 3s; browser heartbeat age=${heartbeatAge??'unknown'}ms`);
  }
  report.submitProbes.push(probe);checkpoint('submit:registered');
  return waitForNewResult(oldRun,timeout);
}
function require(condition,message){if(!condition)throw new Error(message)}

async function runChatRetry(){
  checkpoint('chat:start');
  const task='What is 2 + 2? Reply briefly.';
  const beforeAgents=(await agentMessages()).length;
  const chat=await submit(task,75_000);
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
  await within(page.locator('#task').fill('try again',{timeout:5000}),'fill retry',6000);
  await within(page.locator('#runButton').click({noWaitAfter:true,timeout:5000}),'retry click',6000);
  const retry=await waitForNewResult(oldRun,75_000);
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
  const result=await submit(task,25_000),events=result.events||[],output=String(result.result?.output||'');
  require(result.runStatus==='completed',`web research ended with ${result.runStatus}: ${result.statusText||''}`);
  require(events.some(e=>e.name==='web_search'||/web search/i.test(String(e.summary||''))),'web research recorded no web_search execution event');
  require(/https?:\/\//.test(output),'web research output contained no source URL');
  report.flows.web={ok:true,provider:result.result?.provider,runId:result.result?.runId,output:output.slice(0,700)};
  checkpoint('web:done');
}

async function runRepo(){
  checkpoint('repo:start');
  const task='review repo, fix any failed tests, verify & explain';
  const result=await submit(task,300_000),events=result.events||[];
  require(result.runStatus==='completed',`repo execution ended with ${result.runStatus}: ${result.statusText||''}`);
  require(result.result?.provider==='browser-webcontainer',`repo execution provider was ${result.result?.provider||'none'}, expected browser-webcontainer`);
  require(result.result?.repo==='JT5D/xrai-agent',`repo execution targeted ${result.result?.repo||'none'}`);
  require(events.some(e=>e.name==='GitHub public repo'&&e.type==='tool:done'),'repo execution lacks real GitHub import evidence');
  require(events.some(e=>e.name==='Test verifier'&&e.type==='tool:done'&&/PASS/.test(String(e.summary||''))),'repo execution lacks passing deterministic verifier evidence');
  report.flows.repo={ok:true,provider:result.result?.provider,repo:result.result?.repo,sha:result.result?.sha,changedFiles:result.result?.changedFiles||[],runId:result.result?.runId};
  checkpoint('repo:done');

  checkpoint('provenance:start');
  const persisted=await state(),ids=new Set((persisted.events||[]).map(e=>e.id));
  const nodeIds=await within(page.locator('#graph .node[data-event-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.eventId).filter(Boolean)),'provenance nodes',3000);
  require(nodeIds.length>0,'X-ray rendered no event-bound provenance nodes');
  require(nodeIds.every(id=>ids.has(id)),'X-ray contains a node not backed by a recorded execution event');
  const graphText=await within(page.locator('#graph').innerText(),'provenance text',3000);
  require(/Test verifier|GitHub public repo|User Goal/.test(graphText),'X-ray does not visibly reflect the executed repo path');
  report.flows.provenance={ok:true,boundNodes:nodeIds.length,recordedEvents:ids.size};
  checkpoint('provenance:done');
}

try{
  checkpoint('browser:launch');
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  page=await context.newPage();
  page.setDefaultTimeout(5000);
  page.setDefaultNavigationTimeout(60_000);
  await page.exposeFunction('__xraiE2EHeartbeat',ts=>{report.lastHeartbeat=Number(ts)||Date.now()});
  await page.addInitScript(()=>{setInterval(()=>globalThis.__xraiE2EHeartbeat?.(Date.now()),500)});
  page.on('console',msg=>{if(msg.type()==='error')report.consoleErrors.push(msg.text())});
  page.on('pageerror',error=>report.pageErrors.push(String(error?.stack||error)));
  page.on('framenavigated',frame=>{if(frame===page.mainFrame()){report.navigations.push({url:frame.url(),ts:new Date().toISOString()});checkpoint('navigation')}});
  const recordNetwork=(kind,url,status=null)=>{if(!/duckduckgo|wikipedia|algolia|api\.github\.com|search\.jina\.ai|jsdelivr|huggingface|webcontainer/i.test(url))return;report.networkEvents.push({kind,url,status,ts:new Date().toISOString()});report.networkEvents=report.networkEvents.slice(-80)};
  page.on('request',request=>recordNetwork('request',request.url()));
  page.on('response',response=>recordNetwork('response',response.url(),response.status()));
  page.on('requestfailed',request=>recordNetwork('failed',request.url()));

  await page.goto(`${base}?e2e=${flow}-${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60_000});
  await within(page.waitForSelector('#task',{timeout:30_000}),'initial composer',31_000);
  await within(page.evaluate(()=>{localStorage.clear();sessionStorage.clear()}),'clear browser state',3000);
  await page.reload({waitUntil:'domcontentloaded',timeout:60_000});
  await waitForReady(30_000);
  report.runtime=await state().then(()=>within(page.evaluate(()=>({href:location.href,userAgent:navigator.userAgent,deviceMemory:navigator.deviceMemory??null,webgpu:Boolean(navigator.gpu),crossOriginIsolated:globalThis.crossOriginIsolated,mode:document.querySelector('#modeLabel')?.textContent?.trim()||null})),'runtime snapshot',3000));
  checkpoint('runtime:ready');

  if(flow==='chat-retry')await runChatRetry();
  else if(flow==='web')await runWeb();
  else if(flow==='repo')await runRepo();
  else if(flow!=='smoke')throw new Error(`Unknown E2E flow: ${flow}`);
  else report.flows.runtime={ok:true,...report.runtime};

  report.ok=true;checkpoint('complete');
  await safe(page.screenshot({path:`${artifacts}/live-e2e-${flow}-success.png`,fullPage:true}),5000);
}catch(error){
  report.ok=false;report.error=String(error?.stack||error);report.heartbeatAgeMs=report.lastHeartbeat?Date.now()-report.lastHeartbeat:null;
  if(page){
    report.failureState=await safe(state());
    report.visibleStatus=await safe(page.locator('#status').textContent());
    report.visibleProgress=await safe(page.locator('#progressLabel').textContent());
    report.userMessages=await safe(userMessages())||[];
    report.agentMessages=await safe(agentMessages())||[];
    await safe(page.screenshot({path:`${artifacts}/live-e2e-${flow}-failure.png`,fullPage:true}),5000);
  }
  checkpoint('failed');throw error;
}finally{
  finished=true;clearTimeout(hardTimer);report.finishedAt=new Date().toISOString();checkpoint(report.ok?'finished':'failed:finished');
  if(browser)await safe(browser.close(),5000);
}
