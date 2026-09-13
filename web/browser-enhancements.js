import { classifyBuiltinTask,isEvaluatorArtifact,runBuiltinTask } from './capability-tools.js';
import { ACTIVE_CHAT_KEY,UI_STATE_KEY,ensureActiveChat,listChats,newChat,restoreChat,snapshotChat,snapshotCurrentChat } from './conversation-store.js';
import { isRetryFollowup,lastMeaningfulUserTask,visibleTask } from './input-guard.js';

const $=s=>document.querySelector(s);
const uid=()=>globalThis.crypto?.randomUUID?.()||`xrai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
const RETRY_PENDING_KEY='xrai-retry-pending-v1';
const readState=()=>{try{return JSON.parse(localStorage.getItem(UI_STATE_KEY)||'null')}catch{return null}};
const writeState=state=>{try{localStorage.setItem(UI_STATE_KEY,JSON.stringify({...state,updatedAt:Date.now()}));return true}catch{return false}};

function appendMessage(state,role,text,runId=null){
  const rows=Array.isArray(state.messages)?state.messages:[];
  rows.push({id:uid(),role,text:String(text),ts:Date.now(),runId});state.messages=rows.slice(-100);
}
function setBusy(text){const b=$('#runButton'),s=$('#status');if(b)b.disabled=true;if(s)s.textContent=text||'working';}
function currentState(){
  const s=readState();
  return s&&typeof s==='object'?s:{version:4,view:'workspace',activeRunId:null,lastTask:'',runStatus:'idle',statusText:'ready',messages:[],events:[],result:null,options:{workspace:'.',maxDepth:2,maxChildren:2,retries:1},updatedAt:Date.now()};
}
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
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      const button=$('#rerun');
      if(button&&!button.disabled){
        clearInterval(timer);
        sessionStorage.removeItem(RETRY_PENDING_KEY);
        button.click();
        return;
      }
      if(attempts>=100){
        clearInterval(timer);
        sessionStorage.removeItem(RETRY_PENDING_KEY);
        const state=currentState();
        state.runStatus='error';state.statusText='retry could not start after app initialization';
        writeState(state);
      }
    },50);
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
    const state=readState();if(!state?.messages?.length)return;
    const last=[...state.messages].reverse().find(m=>m?.role==='agent');if(!last||!isEvaluatorArtifact(last.text))return;
    repairing=true;last.text='Internal evaluator output was blocked because it is not a valid user-facing answer. The run was marked incomplete rather than exposing internal evaluation data.';state.runStatus='error';state.statusText='internal evaluator artifact blocked';if(state.result)state.result={...state.result,output:last.text,score:0};writeState(state);snapshotChat(localStorage,state);setTimeout(()=>location.reload(),0);
  };
  new MutationObserver(check).observe(document.body,{childList:true,subtree:true});setInterval(check,1200);
}

function injectChatHistory(){
  const sidebar=document.querySelector('.sidebar');if(!sidebar||document.querySelector('#chatHistory'))return;
  const style=document.createElement('style');style.textContent=`
    .chat-history{border-top:1px solid rgba(116,153,190,.18);padding:12px 9px 8px;margin-top:8px;min-height:0}.chat-history-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.chat-history-head strong{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#8ea7c3}.chat-new{border:1px solid #274766;background:#0b1e32;color:#d7e9fb;border-radius:7px;padding:5px 8px;cursor:pointer;font-size:11px}.chat-history-list{display:grid;gap:4px;max-height:180px;overflow:auto}.chat-history-item{display:block;width:100%;text-align:left;border:0;background:transparent;color:#9fb5cc;border-radius:6px;padding:7px 8px;cursor:pointer;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.chat-history-item:hover,.chat-history-item.active{background:#112b47;color:#fff}.chat-history-time{display:block;font-size:9px;color:#617b95;margin-top:2px}
  `;document.head.append(style);
  const wrap=document.createElement('section');wrap.id='chatHistory';wrap.className='chat-history';wrap.innerHTML='<div class="chat-history-head"><strong>Chats</strong><button class="chat-new" type="button">+ New</button></div><div class="chat-history-list"></div>';
  const agent=sidebar.querySelector('.agent-card');sidebar.insertBefore(wrap,agent||null);
  wrap.querySelector('.chat-new').addEventListener('click',()=>{newChat(localStorage);location.reload()});
  renderChatHistory();
}
function renderChatHistory(){
  const list=document.querySelector('.chat-history-list');if(!list)return;list.innerHTML='';const active=localStorage.getItem(ACTIVE_CHAT_KEY),rows=listChats(localStorage);
  for(const row of rows.slice(0,10)){const button=document.createElement('button');button.type='button';button.className=`chat-history-item${row.id===active?' active':''}`;button.title=row.title;button.textContent=row.title;const time=document.createElement('span');time.className='chat-history-time';time.textContent=new Date(row.updatedAt||Date.now()).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});button.append(time);button.addEventListener('click',()=>{if(row.id===active)return;if(restoreChat(localStorage,row.id))location.reload()});list.append(button)}
  if(!rows.length){const empty=document.createElement('span');empty.className='chat-history-item';empty.textContent='Current chat';list.append(empty)}
}
function installHistoryJournal(){
  const initial=readState();ensureActiveChat(localStorage,initial);if(initial)snapshotChat(localStorage,initial);injectChatHistory();
  let lastStamp=initial?.updatedAt||0;
  setInterval(()=>{const state=readState();if(!state||state.updatedAt===lastStamp)return;lastStamp=state.updatedAt;snapshotChat(localStorage,state);renderChatHistory()},800);
  window.addEventListener('pagehide',()=>snapshotCurrentChat(localStorage));
}

installPendingRetry();installBuiltinRouter();installLeakGuard();installHistoryJournal();
