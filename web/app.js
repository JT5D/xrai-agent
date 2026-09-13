import { clearUiState,isConstrainedDevice,loadUiState,saveUiState,taskNeedsExecutionHost } from './state.js';
import { CHAT_SWITCH_KEY } from './conversation-store.js';
import { browserRepoSupport,runBrowserRepoTask } from './browser-workspace.js';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const uid=()=>globalThis.crypto?.randomUUID?.()||`xrai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
let ui=loadUiState(localStorage);
try{if(sessionStorage.getItem(CHAT_SWITCH_KEY))sessionStorage.removeItem(CHAT_SWITCH_KEY)}catch{}
let mode='detecting';
let capabilities=null;
let sse=null;
let pollingRunId=null;

const welcome={id:'welcome',role:'agent',text:'Give me a task. On compatible desktop browsers I can inspect, test, and repair public Node/JS/TS repositories in an isolated zero-install browser sandbox. I report real command evidence and never fabricate repo access.',ts:Date.now(),runId:null};
if(!ui.messages.length)ui.messages=[welcome];

function persist(){try{if(sessionStorage.getItem(CHAT_SWITCH_KEY))return}catch{}ui=saveUiState(localStorage,ui)}
function escTime(ts){try{return new Date(ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}catch{return''}}
function makeEvent(type,summary,extra={}){return{id:uid(),runId:ui.activeRunId||uid(),ts:Date.now(),type,summary,...extra}}
function activeEvents(){return ui.events.filter(e=>e.runId===ui.activeRunId)}

function setView(view,persistView=true){
  ui.view=view;
  $('#mainStage').dataset.view=view;
  $$('.side-nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  if(persistView)persist();
}

function renderMessages(){
  const box=$('#messages');box.innerHTML='';
  for(const m of ui.messages){
    const el=document.createElement('article');el.className=`msg ${m.role}`;
    const avatar=document.createElement('div');avatar.className='avatar';avatar.textContent=m.role==='user'?'Y':m.role==='system'?'':'△';
    const bubble=document.createElement('div');bubble.className='bubble';
    const name=document.createElement('b');name.textContent=m.role==='user'?'You':m.role==='system'?'System':'XRAI Agent';
    const p=document.createElement('p');p.textContent=m.text;
    bubble.append(name,p);el.append(avatar,bubble);box.append(el);
  }
  box.scrollTop=box.scrollHeight;
}
function addMessage(role,text,{runId=ui.activeRunId,persistMessage=true}={}){
  const duplicate=ui.messages.at(-1);
  if(duplicate?.role===role&&duplicate?.text===text&&duplicate?.runId===runId)return;
  ui.messages.push({id:uid(),role,text:String(text),ts:Date.now(),runId});
  ui.messages=ui.messages.slice(-100);
  if(persistMessage)persist();renderMessages();
}

function eventProgress(ev){
  if(ev.type==='run:start')return[5,'Starting'];
  if(ev.type==='model:ready')return[14,'Model ready'];
  if(ev.type.startsWith('knowledge:')||ev.type==='skill:hit')return[22,'Retrieving'];
  if(ev.type==='agent:delegate')return[38,'Delegating'];
  if(ev.type==='agent:start')return[34,'Working'];
  if(ev.type==='tool:start')return[52,ev.name||'Using tool'];
  if(ev.type==='tool:done')return[62,'Tool complete'];
  if(ev.type==='agent:done')return[70,'Synthesizing'];
  if(ev.type==='eval')return[84,'Verifying'];
  if(ev.type==='retry')return[58,'Retrying'];
  if(ev.type.startsWith('skill:')||ev.type==='meta:update')return[93,'Learning'];
  if(ev.type==='capability:blocked')return[100,'Needs execution host'];
  if(ev.type==='run:done')return[100,'Complete'];
  return null;
}
function updateFromEvent(ev){
  const p=eventProgress(ev);if(p){$('#progressBar').style.width=`${p[0]}%`;$('#progressValue').textContent=`${p[0]}%`;$('#progressLabel').textContent=p[1]}
  if(ev.type==='run:start'){$('#currentTask').textContent=ev.summary;$('#runMeta').textContent=`run ${ev.runId.slice(0,8)}`;$('#agentState').textContent='Agent running'}
  if(ev.type==='eval'&&ev.data?.score!=null)$('#score').textContent=`${Math.round(ev.data.score*100)}%`;
  if(ev.type.startsWith('skill:')&&ev.type!=='skill:hit')$('#learning').textContent=ev.type.replace('skill:','');
  if(ev.type==='meta:update')$('#metaVersion').textContent=`v${ev.data?.meta?.version||ev.data?.version||'—'}`;
  if(ev.type==='run:done')$('#agentState').textContent='Agent ready';
}
function acceptEvent(ev,{persistEvent=true}={}){
  if(!ev?.id||!ev?.runId)return;
  if(ui.events.some(x=>x.id===ev.id))return;
  ui.activeRunId=ev.runId;
  ui.events.push(ev);ui.events=ui.events.slice(-500);
  updateFromEvent(ev);
  if(persistEvent)persist();
  renderGraph();renderActivity();renderTimeline();
}
function mergeEvents(rows=[]){for(const ev of rows)acceptEvent(ev,{persistEvent:false});persist()}

function kind(ev){
  if(ev.type==='capability:blocked')return'blocked';
  if(ev.type.startsWith('agent:'))return'agent';
  if(ev.type.startsWith('tool:')||ev.type==='model:ready')return'tool';
  if(ev.type.startsWith('knowledge:')||ev.type==='skill:hit')return'knowledge';
  if(ev.type==='eval'||ev.type==='retry')return'eval';
  if(ev.type.startsWith('skill:')||ev.type==='meta:update')return'learn';
  return'agent';
}
function renderGraph(){
  const rows=activeEvents();const graph=$('#graph');
  if(!rows.length){graph.innerHTML='<div class="empty-state"><span class="empty-mark">△</span><strong>Ready for a task</strong><p>Execution events will build the graph here.</p></div>';return}
  graph.innerHTML='';const nodes=[];const byId=new Map();let rootAgent=null;
  const add=(id,title,parent,k,summary,running=false)=>{
    if(!byId.has(id)){const n={id,title,parent,k,summary,running};byId.set(id,n);nodes.push(n)}
    else{const n=byId.get(id);n.summary=summary||n.summary;n.running=running}
  };
  for(const ev of rows){
    const k=kind(ev);let id=null,title=null,parent=null;
    if(ev.type==='run:start'){id='goal';title='User Goal'}
    else if(ev.type==='model:ready'){id='runtime';title='Runtime';parent='goal'}
    else if(ev.type==='capability:blocked'){id='blocked';title='Execution Host';parent='goal'}
    else if(ev.type==='eval'||ev.type==='retry'){id='eval';title='Evaluator';parent=rootAgent||'goal'}
    else if(ev.type==='skill:hit'||ev.type.startsWith('knowledge:')){id='knowledge';title='Knowledge + Skills';parent=rootAgent||'goal'}
    else if(ev.type.startsWith('skill:')||ev.type==='meta:update'){id='learning';title='Self-improvement';parent='eval'}
    else if(ev.type.startsWith('tool:')){id=`tool:${ev.name||'tool'}`;title=ev.name||'Tool';parent=ev.agentId?`agent:${ev.agentId}`:(rootAgent||'goal')}
    else if(ev.agentId){id=`agent:${ev.agentId}`;title=ev.name||'Agent';parent=ev.parentAgentId?`agent:${ev.parentAgentId}`:'goal';if(!ev.parentAgentId&&!rootAgent)rootAgent=id}
    if(!id)continue;
    add(id,title,parent,k,ev.summary,ev.type.endsWith(':start')||ev.type==='agent:delegate');
    if(ev.type.endsWith(':done')||ev.type==='eval'||ev.type==='capability:blocked')byId.get(id).running=false;
  }
  const depth=id=>{let d=0,n=byId.get(id),guard=0;while(n?.parent&&guard++<10){d++;n=byId.get(n.parent)}return Math.min(d,4)};
  const layers=new Map();for(const n of nodes){const d=depth(n.id);if(!layers.has(d))layers.set(d,[]);layers.get(d).push(n)}
  const width=Math.max(graph.clientWidth,690),colW=Math.max(190,width/5),pos=new Map();
  for(const [d,layer] of layers){layer.forEach((n,i)=>{const total=layer.length,rowGap=96,startY=Math.max(24,240-(total-1)*rowGap/2),x=24+d*colW,y=startY+i*rowGap;pos.set(n.id,{x,y});const el=document.createElement('div');el.className=`node ${n.k}${n.running?' running':''}`;el.style.left=`${x}px`;el.style.top=`${y}px`;const kd=document.createElement('div');kd.className='kind';kd.textContent=n.k;const ti=document.createElement('div');ti.className='title';ti.textContent=n.title;const sm=document.createElement('div');sm.className='summary';sm.textContent=n.summary||'';el.append(kd,ti,sm);graph.append(el)})}
  for(const n of nodes){if(!n.parent||!pos.has(n.parent)||!pos.has(n.id))continue;const a=pos.get(n.parent),b=pos.get(n.id),x1=a.x+176,y1=a.y+29,x2=b.x,y2=b.y+29,dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy);const edge=document.createElement('div');edge.className='edge';edge.style.left=`${x1}px`;edge.style.top=`${y1}px`;edge.style.width=`${len}px`;edge.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;graph.append(edge)}
}
function renderActivity(){
  const rows=activeEvents().slice(-5).reverse();const box=$('#activityList');box.innerHTML='';
  if(!rows.length){box.innerHTML='<p class="muted">No activity yet.</p>';return}
  for(const ev of rows){const row=document.createElement('div');row.className='activity-row';const dot=document.createElement('i');const text=document.createElement('span');text.textContent=ev.summary;const time=document.createElement('time');time.textContent=escTime(ev.ts);row.append(dot,text,time);box.append(row)}
}
function renderTimeline(){
  const box=$('#timeline');const rows=activeEvents().slice().reverse();box.innerHTML='';
  if(!rows.length){box.innerHTML='<div class="empty-state small"><strong>No activity yet.</strong></div>';return}
  for(const ev of rows){const el=document.createElement('div');el.className='event';const meta=document.createElement('div');meta.className='meta';const type=document.createElement('span');type.textContent=`${ev.type}${ev.name?` · ${ev.name}`:''}`;const time=document.createElement('span');time.textContent=escTime(ev.ts);meta.append(type,time);const summary=document.createElement('div');summary.className='summary';summary.textContent=ev.summary;el.append(meta,summary);box.append(el)}
}

function setRunStatus(status,text=status){
  ui.runStatus=status;ui.statusText=text;$('#status').textContent=text;$('#runButton').disabled=status==='running';$('#rerun').disabled=!ui.lastTask||status==='running';
  $('#statusHealth').textContent=status==='running'?'Running':status==='error'?'Needs attention':'Healthy';
  persist();
}
function updatePatchButton(){
  const button=$('#downloadPatch');if(!button)return;button.hidden=!ui.result?.diff;
}
function applyResult(result,runId=ui.activeRunId){
  ui.result={runId,output:result.output||'',score:result.score??null,attempts:result.attempts??0,learning:result.learning??null,provider:result.provider||mode,diff:result.diff||'',repo:result.repo||null,sha:result.sha||null,changedFiles:result.changedFiles||[]};
  $('#score').textContent=result.score==null?'—':`${Math.round(result.score*100)}%`;$('#attempts').textContent=result.attempts??'—';
  const learningStatus=result.learning?.status||result.learning||'none';$('#learning').textContent=learningStatus;
  $('#progressBar').style.width='100%';$('#progressValue').textContent='100%';$('#progressLabel').textContent='Complete';
  if(result.output)addMessage('agent',result.output,{runId});
  if(result.diff)addMessage('system',`Verified sandbox patch preview:\n\n${result.diff.slice(0,7000)}`,{runId});
  updatePatchButton();setRunStatus('completed',`done · ${result.provider||mode}`);
}

function connectSse(){
  if(sse||mode!=='server')return;
  sse=new EventSource('./events');
  sse.onmessage=e=>{try{const ev=JSON.parse(e.data);if(!ui.activeRunId||ev.runId===ui.activeRunId)acceptEvent(ev)}catch{}};
}

async function pollServerRun(runId){
  if(!runId||pollingRunId===runId)return;pollingRunId=runId;
  try{
    while(ui.activeRunId===runId&&ui.runStatus==='running'){
      const res=await fetch(`./api/runs/${runId}`,{cache:'no-store'});if(!res.ok)throw new Error('Run state unavailable');const state=await res.json();mergeEvents(state.events||[]);
      if(state.status==='completed'){applyResult(state.result||state,runId);break}
      if(state.status==='error'){setRunStatus('error',state.error||'run failed');addMessage('agent',`Run failed: ${state.error||'Unknown error'}`,{runId});break}
      await sleep(650);
    }
  }catch(error){if(ui.activeRunId===runId&&ui.runStatus==='running'){setRunStatus('interrupted','connection interrupted · run may still be active');showResume('The local execution host became unreachable. Reconnect to recover the run.')}}
  finally{if(pollingRunId===runId)pollingRunId=null}
}

function showResume(text){$('#resumeText').textContent=text;$('#resumeBar').hidden=false}
function hideResume(){$('#resumeBar').hidden=true}
function capabilityMessage(){
  if(mode==='browser'){
    const support=browserRepoSupport(navigator);
    return support.supported?'<strong>Zero-install browser execution</strong>Public Node/JS/TS repos run in an isolated WebContainer with real files, package commands, tests, bounded edits, patch output, and re-verification. No user API key or local install. Anonymous mode does not push to GitHub.':`<strong>Browser execution compatibility</strong>${support.reason} Normal no-key chat still works here.`;
  }
  if(capabilities?.autonomous)return '';
  return '<strong>Execution host connected, reasoning host missing</strong>Start Ollama for no-key autonomous repo work, or use ChatGPT/Claude as the MCP reasoning host.';
}
function renderCapabilities(){
  const list=$('#capabilityList');list.innerHTML='';
  const c=capabilities?.capabilities||{},support=browserRepoSupport(navigator);
  const items=mode==='browser'?
    [['On-device chat',true,isConstrainedDevice(navigator)?'mobile-safe':'local'],['XRAI knowledge',true,'local'],['Refresh recovery',true,'durable'],['Browser Node sandbox',support.supported,support.supported?'WebContainer':'desktop Chromium'],['Public repo + tests',support.supported,support.supported?'zero-install':'compatibility'],['Patch download',support.supported,'sandbox diff']]:
    [['Reasoning host',Boolean(capabilities?.autonomous),capabilities?.provider||'none'],['Filesystem + shell',Boolean(c.shell),'local'],['Repo + test execution',Boolean(c.repoExecution),'local'],['Refresh recovery',Boolean(c.runPersistence),'server'],['MCP endpoint',Boolean(c.mcp),'ready']];
  for(const [label,ok,note] of items){const li=document.createElement('li');const dot=document.createElement('i');dot.className=ok?'yes':'no';const text=document.createElement('span');text.textContent=label;const em=document.createElement('em');em.textContent=note;li.append(dot,text,em);list.append(li)}
}
async function renderSkills(){
  const box=$('#skillsContent');
  if(mode==='server')try{const res=await fetch('./api/skills',{cache:'no-store'});if(res.ok){const s=await res.json();box.innerHTML=`<div class="runtime-grid"><article><strong>${s.promoted||0} promoted</strong><p>Eligible for retrieval after passing evidence gates.</p></article><article><strong>${s.candidates||s.candidate||0} candidates</strong><p>Quarantined until verified or supported by another successful task.</p></article><article><strong>Meta v${s.meta?.version||1}</strong><p>${(s.meta?.guidance||[]).slice(-1)[0]||'Learning policy is stable.'}</p></article></div>`;return}}catch{}
  box.innerHTML='<div class="runtime-grid"><article><strong>Browser-local learning</strong><p>Promoted skills live in browser storage and are retrieved only after evidence gates pass.</p></article><article><strong>Fail closed</strong><p>Low-confidence candidates stay quarantined; they do not automatically become memory.</p></article></div>';
}

async function detectRuntime(){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),800);
  try{
    const res=await fetch('./api/capabilities',{cache:'no-store',signal:controller.signal});clearTimeout(timer);
    if(!res.ok)throw new Error('No local host');capabilities=await res.json();mode='server';connectSse();
  }catch{clearTimeout(timer);mode='browser';capabilities={provider:'browser-local',autonomous:true,capabilities:{browser:true,localInference:true,runPersistence:true}}}
  const support=browserRepoSupport(navigator);
  $('#health').textContent=mode==='server'?(capabilities.autonomous?`${capabilities.provider} online`:'execution host'):(support.supported?'browser · chat + repo sandbox':'browser · chat');
  $('#modeLabel').textContent=mode==='server'?capabilities.provider:'browser';
  const notice=capabilityMessage();$('#capabilityNotice').innerHTML=notice;$('#capabilityNotice').hidden=!notice;
  $('#chatModeHint').textContent=mode==='server'?'Local execution host connected.':'No-key browser chat. Public Node/JS/TS repo tasks execute in-browser on compatible desktop Chromium.';
  renderCapabilities();renderSkills();
  if(ui.runStatus==='interrupted'&&ui.activeRunId){if(mode==='server'){showResume('A previous run may still be active on the local host.');pollServerRun(ui.activeRunId)}else showResume('The previous local-host run was interrupted. Reconnect the host to recover it.')}
}

async function runServer(task){
  const res=await fetch('./api/runs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({task,...ui.options})});
  const data=await res.json();if(!res.ok)throw new Error(data.error||'Could not start run');ui.activeRunId=data.runId;persist();connectSse();pollServerRun(data.runId);
}
async function runBrowser(task){
  if(taskNeedsExecutionHost(task)){
    const support=browserRepoSupport(navigator);
    if(!support.supported){
      const text=`${support.reason} Open this same XRAI URL in current desktop Chrome or Edge for zero-install public-repo execution; no local install or API key is required.`;
      addMessage('agent',text);ui.result={runId:ui.activeRunId,output:text,score:null,attempts:0,learning:'none',provider:'browser-compatibility'};acceptEvent(makeEvent('run:done','Task stopped before unsupported execution.',{data:{attempts:0,learning:'none'}}));setRunStatus('error','browser compatibility');return;
    }
    const data=await runBrowserRepoTask(task,{},acceptEvent,msg=>{ui.statusText=msg;$('#status').textContent=msg;persist()});ui.activeRunId=data.runId;applyResult(data,data.runId);return;
  }
  const {runLocalTask}=await import('./local-agent.js');
  const opts={retries:ui.options.retries,maxChildren:ui.options.maxChildren};
  const data=await runLocalTask(task,opts,acceptEvent,msg=>{ui.statusText=msg;$('#status').textContent=msg;persist()});
  ui.activeRunId=data.runId;applyResult(data,data.runId);
}
async function run(task,{resume=false}={}){
  const cleaned=String(task||'').trim();if(!cleaned)return;
  hideResume();ui.lastTask=cleaned;ui.result=null;ui.events=[];ui.activeRunId=null;
  if(!resume)addMessage('user',cleaned,{runId:null,persistMessage:false});persist();setRunStatus('running','starting');
  const startEvent=makeEvent('run:start',cleaned,{data:{mode}});acceptEvent(startEvent);ui.activeRunId=startEvent.runId;persist();
  try{if(mode==='server')await runServer(cleaned);else await runBrowser(cleaned)}catch(error){const message=error instanceof Error?error.message:String(error);setRunStatus('error',message);addMessage('agent',`Run failed: ${message}`);acceptEvent(makeEvent('run:done',`Run failed: ${message}`,{data:{score:0,attempts:0,learning:'none'}}))}
}
function resumeRecovered(){hideResume();if(!ui.lastTask)return;setRunStatus('idle','ready to resume');run(ui.lastTask,{resume:true})}
function reset(){
  if(!confirm('Clear persisted XRAI UI state? Learned skills are kept.'))return;
  ui=clearUiState(localStorage);ui.messages=[welcome];renderAll();persist();
}
function renderAll(){
  renderMessages();renderGraph();renderActivity();renderTimeline();updatePatchButton();
  $('#score').textContent=ui.result?.score==null?'—':`${Math.round(ui.result.score*100)}%`;
  $('#attempts').textContent=ui.result?.attempts??'—';
  $('#learning').textContent=ui.result?.learning?.status||ui.result?.learning||'—';
  $('#currentTask').textContent=ui.lastTask||'No task running.';
  $('#status').textContent=ui.statusText||'ready';
  $('#rerun').disabled=!ui.lastTask||ui.runStatus==='running';
  $('#runButton').disabled=ui.runStatus==='running';
  $('#statusHealth').textContent=ui.runStatus==='error'?'Needs attention':ui.runStatus==='running'?'Running':'Healthy';
  if(ui.activeRunId)$('#runMeta').textContent=`run ${ui.activeRunId.slice(0,8)}`;
  if(ui.runStatus==='running'){ui.runStatus='interrupted';ui.statusText='recovered after refresh';persist();showResume('The page refreshed while a run was active. Your task and visible progress were preserved.')}
}

$('#chatForm').addEventListener('submit',e=>{e.preventDefault();const task=$('#task').value.trim();if(!task)return;$('#task').value='';run(task)});
$('#rerun').addEventListener('click',()=>ui.lastTask&&run(ui.lastTask));
$('#clear').addEventListener('click',reset);
$('#runtimeButton').addEventListener('click',()=>setView('runtime'));
$('#chatFocusButton').addEventListener('click',()=>setView('chat'));
$('#activityFocusButton').addEventListener('click',()=>setView('activity'));
$$('.side-nav button').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$$('.back-workspace').forEach(b=>b.addEventListener('click',()=>setView('workspace')));
$$('[data-runtime-target]').forEach(b=>b.addEventListener('click',()=>setView('runtime')));
$('#resumeButton').addEventListener('click',resumeRecovered);
$('#downloadPatch').addEventListener('click',()=>{if(!ui.result?.diff)return;const blob=new Blob([ui.result.diff],{type:'text/x-diff'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`xrai-${(ui.result.repo||'patch').replace(/[^a-z0-9_-]+/gi,'-')}.patch`;a.click();URL.revokeObjectURL(url);setTimeout(()=>URL.revokeObjectURL(url),1000)});
window.addEventListener('pagehide',persist);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persist()});

renderAll();detectRuntime();
