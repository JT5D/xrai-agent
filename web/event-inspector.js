import { eventInspectorRows,normalizeEvents } from './event-model.js';
import { UI_STATE_KEY } from './state.js';

const readState=()=>{try{return JSON.parse(localStorage.getItem(UI_STATE_KEY)||'null')}catch{return null}};
const esc=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function ensureInspector(){
  if(document.querySelector('#eventInspector'))return document.querySelector('#eventInspector');
  const style=document.createElement('style');
  style.textContent=`.event-inspector{position:fixed;right:18px;bottom:18px;z-index:40;width:min(420px,calc(100vw - 36px));max-height:62vh;overflow:auto;background:#0a1727;border:1px solid #274766;border-radius:12px;box-shadow:0 18px 60px rgba(0,0,0,.45);padding:14px;color:#d7e9fb}.event-inspector[hidden]{display:none}.event-inspector-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}.event-inspector-head strong{font-size:13px}.event-inspector-close{border:0;background:transparent;color:#9fb5cc;font-size:18px;cursor:pointer}.event-inspector dl{margin:0;display:grid;gap:8px}.event-inspector dl div{display:grid;grid-template-columns:92px 1fr;gap:10px;border-top:1px solid rgba(116,153,190,.12);padding-top:8px}.event-inspector dt{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#6f89a4}.event-inspector dd{margin:0;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}.graph .node{cursor:pointer}.graph .node:hover{outline:1px solid rgba(127,195,255,.55)}`;
  document.head.append(style);
  const panel=document.createElement('aside');panel.id='eventInspector';panel.className='event-inspector';panel.hidden=true;panel.innerHTML='<div class="event-inspector-head"><strong>Execution evidence</strong><button type="button" class="event-inspector-close" aria-label="Close">×</button></div><dl></dl>';
  document.body.append(panel);panel.querySelector('button').addEventListener('click',()=>panel.hidden=true);return panel;
}

function bestEventForNode(node,events){
  const title=node.querySelector('.title')?.textContent?.trim().toLowerCase()||'';
  const summary=node.querySelector('.summary')?.textContent?.trim()||'';
  const matches=events.filter(event=>{
    const name=String(event.name||'').toLowerCase(),type=String(event.type||'').toLowerCase();
    if(summary&&event.summary===summary)return true;
    if(title.includes('evaluator'))return event.kind==='verification';
    if(title.includes('knowledge'))return event.kind==='retrieval';
    if(title.includes('learning'))return event.kind==='learning';
    if(title.includes('runtime'))return event.kind==='model';
    if(title.includes('user goal'))return event.type==='run:start';
    return name===title||name.includes(title)||type.includes(title.replace(/\s+/g,':'));
  });
  return matches.at(-1)||events.at(-1)||null;
}

function showEvent(event){
  if(!event)return;const panel=ensureInspector(),dl=panel.querySelector('dl');dl.innerHTML='';
  for(const [label,value] of eventInspectorRows(event)){
    const row=document.createElement('div');row.innerHTML=`<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`;dl.append(row);
  }
  panel.hidden=false;
}

function install(){
  ensureInspector();
  document.addEventListener('click',event=>{
    const node=event.target.closest?.('.graph .node');if(!node)return;
    const state=readState(),events=normalizeEvents(state?.events||[]);showEvent(bestEventForNode(node,events));
  });
}

install();
