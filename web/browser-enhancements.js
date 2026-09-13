import { classifyBuiltinTask,isEvaluatorArtifact,runBuiltinTask } from './capability-tools.js';
import { ACTIVE_CHAT_KEY,branchLineage,branchTree,compareChats,ensureActiveChat,forkChat,isChatTransitioning,listChats,newChat,restoreChat,snapshotChat,snapshotCurrentChat } from './conversation-store.js';
import { isRetryFollowup,lastMeaningfulUserTask,visibleTask } from './input-guard.js';
import { loadUiState,saveUiState } from './state.js';

const $=s=>document.querySelector(s);
const uid=()=>globalThis.crypto?.randomUUID?.()||`xrai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
const RETRY_PENDING_KEY='xrai-retry-pending-v1';
const readState=()=>loadUiState(localStorage);
const writeState=state=>{saveUiState(localStorage,state);return true};
const runWhenIdle=fn=>{if(typeof requestIdleCallback==='function')requestIdleCallback(fn,{timeout:1200});else setTimeout(fn,0)};

function appendMessage(state,role,text,runId=null){
  const rows=Array.isArray(state.messages)?state.messages:[];
  rows.push({id:uid(),role,text:String(text),ts:Date.now(),runId});state.messages=rows.slice(-100);
}
function setBusy(text){const b=$('#runButton'),s=$('#status');if(b)b.disabled=true;if(s)s.textContent=text||'working';}
function currentState(){return readState()}
async function executeBuiltin(task){
  let state=currentState();
  state.lastTask=task;state.result=null;state.events=[];state.activeRunId=null;state.runStatus='running';state.statusText='starting built-in tool';
  appendMessage(state,'user',task,null);writeState(state);setBusy('starting built-in tool');snapshotChat(localStorage,state,ensureActiveChat(localStorage,state));
  const emitted=[];
  try{
    const data=await runBuiltinTask(task,{emit:event=>{emitted.push(event);setBusy(event.name==='web_search'?'searching web':event.summary)},progress:setBusy});
    if(!data)return false;
    state=currentState();state.activeRunId=data.runId;state.events=emitted.slice(-500);state.result={runId:data.runId,output:data.output||'',score:data.score??null,attempts:data.attempts??1,learning:data.learning??null,provider:data.provider||'browser-tools',diff:'',repo:null,sha:null,changedFiles:[]};
    state.runStatus='completed';state.statusText='done · browser-tools';appendMessage(state,'agent',data.output||'Completed.',data.runId);writeState(state);snapshotChat(localStorage,state);location.reload();return true;
  }catch(error){
    state=currentState();const message=error instanceof Error?error.message:String(error);state.events=emitted.slice(-500);state.runStatus='error';state.statusText=message;state.result={runId:state.activeRunId,output:`Web/tool execution failed: ${message}`,score:0,attempts:1,learning:'none',provider:'browser-tools'};appendMessage(state,'agent',`Web/tool execution failed: ${message}`,state.activeRunId);writeState(state);snapshotChat(localStorage,state);location.reload();return true;
  }
}

function queueRetry(task){
  const state=currentState(),prior=lastMeaningfulUserTask(state);
  if(!prior)return false;
  appendMessage(state,'user',visibleTask(task),null);
  state.lastTask=prior;
  state.runStatus='idle';
  state.statusText='retrying previous task';
  writeState(state);
  snapshotChat(localStorage,state,ensureActiveChat(localStorage,state));
  sessionStorage.setItem(RETRY_PENDING_KEY,'1');
  location.reload();
  return true;
}

function installPendingRetry(){
  window.addEventListener('DOMContentLoaded',()=>{
    if(sessionStorage.getItem(RETRY_PENDING_KEY)!=='1')return;
    const deadline=performance.now()+5000;
    const tryStart=()=>{
      const button=$('#rerun');
      if(button&&!button.disabled){sessionStorage.removeItem(RETRY_PENDING_KEY);button.click();return}
      if(performance.now()<deadline){setTimeout(tryStart,50);return}
      sessionStorage.removeItem(RETRY_PENDING_KEY);
      const state=currentState();state.runStatus='error';state.statusText='retry could not start after app initialization';writeState(state);
    };
    tryStart();
  });
}

function installBuiltinRouter(){
  document.addEventListener('submit',event=>{
    const form=event.target;if(!(form instanceof HTMLFormElement)||form.id!=='chatForm')return;
    const task=visibleTask($('#task')?.value||'');if(!task)return;
    if(isRetryFollowup(task)){
      const prior=lastMeaningfulUserTask(currentState());
      if(!prior)return;
      event.preventDefault();event.stopImmediatePropagation();if($('#task'))$('#task').value='';queueRetry(task);return;
    }
    if(!classifyBuiltinTask(task))return;
    event.preventDefault();event.stopImmediatePropagation();if($('#task'))$('#task').value='';executeBuiltin(task);
  },true);
}

function installLeakGuard(){
  let repairing=false;
  const check=()=>{
    if(repairing)return;
    const bubbles=document.querySelectorAll('#messages .msg.agent .bubble p');
    const latest=bubbles[bubbles.length-1];if(!latest||!isEvaluatorArtifact(latest.textContent||''))return;
    const state=readState();if(!state?.messages?.length)return;
    const last=[...state.messages].reverse().find(m=>m?.role==='agent');if(!last||!isEvaluatorArtifact(last.text))return;
    repairing=true;last.text='Internal evaluator output was blocked because it is not a valid user-facing answer. The run was marked incomplete rather than exposing internal evaluation data.';state.runStatus='error';state.statusText='internal evaluator artifact blocked';if(state.result)state.result={...state.result,output:last.text,score:0};writeState(state);snapshotChat(localStorage,state);setTimeout(()=>location.reload(),0);
  };
  const messages=$('#messages');if(messages)new MutationObserver(check).observe(messages,{childList:true,subtree:true});queueMicrotask(check);
}

function injectChatHistory(){
  const sidebar=document.querySelector('.sidebar');if(!sidebar||document.querySelector('#chatHistory'))return;
  const style=document.createElement('style');style.textContent=`
    .chat-history{border-top:1px solid rgba(116,153,190,.18);padding:12px 9px 8px;margin-top:8px;min-height:0}.chat-history-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.chat-history-head strong{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#8ea7c3}.chat-history-actions{display:flex;gap:4px}.chat-new,.chat-compare,.chat-fork,.branch-mode{border:1px solid #274766;background:#0b1e32;color:#d7e9fb;border-radius:7px;padding:5px 7px;cursor:pointer;font-size:10px}.chat-history-list{display:grid;gap:4px;max-height:210px;overflow:auto}.chat-history-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px;align-items:center}.chat-history-item{display:block;width:100%;text-align:left;border:0;background:transparent;color:#9fb5cc;border-radius:6px;padding:7px 8px;cursor:pointer;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.chat-history-item:hover,.chat-history-item.active{background:#112b47;color:#fff}.chat-history-time{display:block;font-size:9px;color:#617b95;margin-top:2px}.chat-branch{color:#76b9ef}.chat-compare-panel{margin-top:8px;padding:8px;border:1px solid rgba(116,153,190,.18);border-radius:7px;background:rgba(10,29,48,.65);font-size:9px;color:#8ea7c3;line-height:1.45}.chat-compare-panel b{color:#d7e9fb}.chat-compare-panel[hidden]{display:none}
    .branch-mode.active{background:#173b5f;color:#fff}.branch-graph{position:relative;height:100%;min-height:360px;overflow:auto;background:radial-gradient(circle at 35% 35%,rgba(34,83,126,.12),transparent 44%)}.branch-graph[hidden]{display:none}.branch-canvas{position:relative;min-width:720px;min-height:390px}.branch-node{position:absolute;width:180px;min-height:62px;border:1px solid #284a69;border-radius:10px;background:#0a1c2e;color:#d7e9fb;padding:9px 10px;text-align:left;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.18);z-index:2}.branch-node:hover,.branch-node.selected{border-color:#79c2ff;box-shadow:0 0 0 1px rgba(121,194,255,.45),0 10px 28px rgba(0,0,0,.28)}.branch-node.current{border-color:#65d7a3}.branch-node.path{opacity:1}.branch-canvas.has-selection .branch-node:not(.path):not(.selected){opacity:.3}.branch-node b{display:block;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.branch-node small{display:block;margin-top:4px;color:#809bb4;font-size:9px;line-height:1.35}.branch-edge{position:absolute;height:1px;background:#315979;transform-origin:0 0;z-index:1}.branch-detail{position:sticky;left:10px;bottom:10px;z-index:5;width:min(430px,calc(100% - 20px));margin:10px;padding:10px;border:1px solid #2b5272;border-radius:9px;background:rgba(7,20,33,.96);font-size:10px;color:#93abc1;line-height:1.45}.branch-detail b{color:#e2eef8}.branch-detail-actions{display:flex;gap:6px;margin-top:8px}.branch-detail-actions button{border:1px solid #315979;background:#0e2942;color:#d7e9fb;border-radius:6px;padding:5px 8px;cursor:pointer;font-size:10px}.branch-empty{padding:32px;color:#7895b2;font-size:12px}@media(max-width:760px){.branch-node{width:160px}.branch-canvas{min-width:680px}.branch-graph{touch-action:pan-x pan-y}}
  `;document.head.append(style);
  const wrap=document.createElement('section');wrap.id='chatHistory';wrap.className='chat-history';wrap.innerHTML='<div class="chat-history-head"><strong>Time Travel</strong><div class="chat-history-actions"><button class="chat-compare" type="button" hidden>Compare parent</button><button class="chat-new" type="button">+ New</button></div></div><div class="chat-history-list"></div><div class="chat-compare-panel" hidden></div>';
  const agent=sidebar.querySelector('.agent-card');sidebar.insertBefore(wrap,agent||null);
  wrap.querySelector('.chat-new').addEventListener('click',()=>{if(newChat(localStorage,sessionStorage))location.reload()});
  wrap.querySelector('.chat-compare').addEventListener('click',()=>renderBranchComparison());
  renderChatHistory();installBranchView();
}
function renderBranchComparison(){
  const panel=document.querySelector('.chat-compare-panel'),active=localStorage.getItem(ACTIVE_CHAT_KEY),rows=listChats(localStorage),row=rows.find(x=>x.id===active);if(!panel||!row?.parentId)return;
  const c=compareChats(localStorage,row.id,row.parentId);if(!c)return;
  const pct=v=>v==null?'—':`${Math.round(v*100)}%`,delta=v=>v==null?'—':`${v>=0?'+':''}${Math.round(v*100)}%`;
  panel.innerHTML=`<b>Branch vs parent</b><br>score ${pct(c.left.score)} vs ${pct(c.right.score)} (${delta(c.scoreDelta)})<br>attempts ${c.left.attempts??'—'} vs ${c.right.attempts??'—'} · events ${c.left.events} vs ${c.right.events}<br>provider ${c.left.provider||'—'} vs ${c.right.provider||'—'}<br>changed files ${c.left.changedFiles.length} vs ${c.right.changedFiles.length}<br><br><b>Branch result</b><br>${String(c.left.output||'No result yet').replace(/[<>]/g,'').slice(0,220)}<br><br><b>Parent result</b><br>${String(c.right.output||'No result yet').replace(/[<>]/g,'').slice(0,220)}`;panel.hidden=false;
}
function renderChatHistory(){
  const list=document.querySelector('.chat-history-list'),compare=document.querySelector('.chat-compare'),panel=document.querySelector('.chat-compare-panel');if(!list)return;list.innerHTML='';if(panel)panel.hidden=true;const active=localStorage.getItem(ACTIVE_CHAT_KEY),rows=listChats(localStorage),activeRow=rows.find(x=>x.id===active);if(compare)compare.hidden=!activeRow?.parentId;
  for(const row of rows.slice(0,10)){
    const wrap=document.createElement('div');wrap.className='chat-history-row';
    const button=document.createElement('button');button.type='button';button.className=`chat-history-item${row.id===active?' active':''}`;button.title=`Resume ${row.title} from ${new Date(row.updatedAt||Date.now()).toLocaleString()}`;button.textContent=`${row.parentId?'↳ ':''}${row.title}`;if(row.parentId)button.classList.add('chat-branch');const time=document.createElement('span');time.className='chat-history-time';time.textContent=new Date(row.updatedAt||Date.now()).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});button.append(time);button.addEventListener('click',()=>{if(row.id===active)return;if(restoreChat(localStorage,row.id,sessionStorage))location.reload()});
    const fork=document.createElement('button');fork.type='button';fork.className='chat-fork';fork.textContent='Fork';fork.title='Branch from this exact point';fork.addEventListener('click',()=>{if(forkChat(localStorage,row.id,sessionStorage))location.reload()});
    wrap.append(button,fork);list.append(wrap);
  }
  if(!rows.length){const empty=document.createElement('span');empty.className='chat-history-item';empty.textContent='Current chat';list.append(empty)}
  if(!document.querySelector('#branchGraph')?.hidden)renderBranchGraph();
}
function installBranchView(){
  const toolbar=document.querySelector('.graph-toolbar'),graph=document.querySelector('#graph');if(!toolbar||!graph||document.querySelector('#branchMode'))return;
  const button=document.createElement('button');button.id='branchMode';button.type='button';button.className='branch-mode';button.textContent='Branches';button.title='View Time Travel branches in the X-ray surface';toolbar.insertBefore(button,document.querySelector('#runMeta'));
  const branch=document.createElement('div');branch.id='branchGraph';branch.className='branch-graph';branch.hidden=true;graph.insertAdjacentElement('afterend',branch);
  button.addEventListener('click',()=>{const opening=branch.hidden;branch.hidden=!opening;graph.hidden=opening;button.classList.toggle('active',opening);button.textContent=opening?'Run':'Branches';document.querySelector('.graph-controls')?.toggleAttribute('hidden',opening);if(opening)renderBranchGraph()});
}
function renderBranchGraph(selectedId=localStorage.getItem(ACTIVE_CHAT_KEY)){
  const host=document.querySelector('#branchGraph');if(!host)return;const rows=listChats(localStorage),tree=branchTree(rows),active=localStorage.getItem(ACTIVE_CHAT_KEY);host.innerHTML='';if(!tree.length){host.innerHTML='<div class="branch-empty">No saved Time Travel branches yet. Fork a conversation to create an alternate future.</div>';return}
  const canvas=document.createElement('div');canvas.className='branch-canvas';host.append(canvas);const byDepth=new Map();for(const node of tree){if(!byDepth.has(node.depth))byDepth.set(node.depth,[]);byDepth.get(node.depth).push(node)}
  const pos=new Map(),colW=220,rowH=94;for(const [depth,group] of byDepth){group.forEach((node,i)=>pos.set(node.id,{x:24+depth*colW,y:26+i*rowH}))}
  for(const node of tree){if(!node.parentId||!pos.has(node.parentId))continue;const a=pos.get(node.parentId),b=pos.get(node.id),x1=a.x+180,y1=a.y+31,x2=b.x,y2=b.y+31,dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy);const edge=document.createElement('div');edge.className='branch-edge';edge.style.left=`${x1}px`;edge.style.top=`${y1}px`;edge.style.width=`${len}px`;edge.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;canvas.append(edge)}
  for(const node of tree){const p=pos.get(node.id),el=document.createElement('button');el.type='button';el.className=`branch-node${node.id===active?' current':''}`;el.dataset.chatId=node.id;el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;const score=node.score==null?'—':`${Math.round(node.score*100)}%`,when=new Date(node.forkedAt||node.updatedAt||node.createdAt||Date.now()).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});el.innerHTML=`<b>${String(node.title).replace(/[<>]/g,'')}</b><small>${node.parentId?'branch':'root'} · ${when}<br>score ${score} · ${node.attempts??'—'} attempt${node.attempts===1?'':'s'} · ${node.events} events</small>`;el.title=`${node.title}\n${node.parentId?'Forked branch':'Root timeline'}\nScore ${score}`;el.addEventListener('click',()=>selectBranch(node.id));canvas.append(el)}
  selectBranch(selectedId,false);
}
function selectBranch(chatId,scroll=true){
  const host=document.querySelector('#branchGraph'),canvas=host?.querySelector('.branch-canvas'),rows=listChats(localStorage),tree=branchTree(rows),node=tree.find(x=>x.id===chatId);if(!canvas||!node)return;const lineage=branchLineage(rows,chatId),path=new Set([chatId,...lineage.ancestors,...lineage.descendants]);canvas.classList.add('has-selection');canvas.querySelectorAll('.branch-node').forEach(el=>{const id=el.dataset.chatId;el.classList.toggle('selected',id===chatId);el.classList.toggle('path',path.has(id))});
  host.querySelector('.branch-detail')?.remove();const detail=document.createElement('div');detail.className='branch-detail';const score=node.score==null?'—':`${Math.round(node.score*100)}%`;detail.innerHTML=`<b>${String(node.title).replace(/[<>]/g,'')}</b><br>${node.parentId?'Forked from parent':'Root timeline'} · score ${score} · ${node.attempts??'—'} attempts · ${node.events} events · ${node.provider||'—'}<div class="branch-detail-actions"><button data-act="resume">Resume</button><button data-act="fork">Fork</button>${node.parentId?'<button data-act="compare">Compare parent</button>':''}</div>`;detail.addEventListener('click',event=>{const act=event.target.closest('button')?.dataset.act;if(act==='resume'){if(restoreChat(localStorage,node.id,sessionStorage))location.reload()}else if(act==='fork'){if(forkChat(localStorage,node.id,sessionStorage))location.reload()}else if(act==='compare'){const c=compareChats(localStorage,node.id,node.parentId);if(c){const delta=c.scoreDelta==null?'—':`${c.scoreDelta>=0?'+':''}${Math.round(c.scoreDelta*100)}%`;detail.insertAdjacentHTML('beforeend',`<div style="margin-top:8px"><b>Compared with parent</b><br>score Δ ${delta} · attempts Δ ${c.attemptDelta??'—'} · events Δ ${c.eventDelta>=0?'+':''}${c.eventDelta}</div>`)}}});host.append(detail);if(scroll)canvas.querySelector(`[data-chat-id="${CSS.escape(chatId)}"]`)?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'})
}
function installHistoryJournal(){
  runWhenIdle(()=>{const initial=readState();ensureActiveChat(localStorage,null);if(initial&&!isChatTransitioning(sessionStorage))snapshotChat(localStorage,initial);injectChatHistory()});
  const flush=()=>{if(!isChatTransitioning(sessionStorage))snapshotCurrentChat(localStorage)};
  window.addEventListener('pagehide',flush);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush()});
}

installPendingRetry();installBuiltinRouter();installLeakGuard();installHistoryJournal();