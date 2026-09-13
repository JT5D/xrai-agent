export const CHATS_KEY='xrai-chats-v1';
export const ACTIVE_CHAT_KEY='xrai-active-chat-v1';
export const UI_STATE_KEY='xrai-ui-v4';
export const CHAT_SWITCH_KEY='xrai-chat-switch-v1';
const MAX_CHATS=24;
const MAX_CHAT_STORE_CHARS=3500000;

const id=()=>globalThis.crypto?.randomUUID?.()||`chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const rawValue=(storage,key)=>{try{return storage?.getItem(key)||''}catch{return''}};
const parse=(storage,key,fallback)=>{try{const raw=rawValue(storage,key);return raw?JSON.parse(raw):fallback}catch{return fallback}};
const chatStoreOversized=storage=>rawValue(storage,CHATS_KEY).length>MAX_CHAT_STORE_CHARS;
const trimString=(value,max)=>String(value??'').slice(0,max);
function trimValue(value,depth=0){
  if(value==null||typeof value==='boolean'||typeof value==='number')return value;
  if(typeof value==='string')return trimString(value,4000);
  if(depth>=2)return trimString(typeof value==='object'?JSON.stringify(value):value,4000);
  if(Array.isArray(value))return value.slice(0,32).map(v=>trimValue(v,depth+1));
  if(typeof value==='object')return Object.fromEntries(Object.entries(value).slice(0,32).map(([k,v])=>[k,trimValue(v,depth+1)]));
  return trimString(value,4000);
}
function trimMessage(message={}){const out={...message};if('text'in out)out.text=trimString(out.text,12000);return out}
function trimEvent(event={}){const out={...event};for(const [key,max] of [['summary',2000],['inputSummary',4000],['outputSummary',4000],['error',2000]])if(key in out&&out[key]!=null)out[key]=trimString(out[key],max);if('data'in out)out.data=trimValue(out.data);if('evidence'in out)out.evidence=trimValue(out.evidence);return out}
function trimResult(result){if(!result||typeof result!=='object')return result??null;const out={...result};if('output'in out)out.output=trimString(out.output,20000);if('diff'in out)out.diff=trimString(out.diff,50000);if(Array.isArray(out.changedFiles))out.changedFiles=out.changedFiles.slice(0,100).map(v=>trimString(v,500));return out}
const titleFor=state=>{
  const first=(state?.messages||[]).find(m=>m?.role==='user'&&String(m.text||'').trim());
  const text=String(first?.text||state?.lastTask||'New chat').replace(/\s+/g,' ').trim();
  return (text||'New chat').slice(0,58);
};
function beginTransition(transitionStorage,chatId){try{transitionStorage?.setItem(CHAT_SWITCH_KEY,chatId);return true}catch{return false}}
export function isChatTransitioning(transitionStorage=globalThis.sessionStorage){try{return Boolean(transitionStorage?.getItem(CHAT_SWITCH_KEY))}catch{return false}}
export function finishChatTransition(transitionStorage=globalThis.sessionStorage){try{transitionStorage?.removeItem(CHAT_SWITCH_KEY)}catch{}}
export function compactState(state={}){
  return {...state,lastTask:'lastTask'in state?trimString(state.lastTask,12000):state.lastTask,statusText:'statusText'in state?trimString(state.statusText,1000):state.statusText,messages:Array.isArray(state.messages)?state.messages.slice(-100).map(trimMessage):[],events:Array.isArray(state.events)?state.events.slice(-220).map(trimEvent):[],result:trimResult(state.result),options:state.options&&typeof state.options==='object'?trimValue(state.options):state.options,updatedAt:Date.now()};
}
export function listChats(storage=globalThis.localStorage){
  if(chatStoreOversized(storage))return[];
  const rows=parse(storage,CHATS_KEY,[]);
  return Array.isArray(rows)?rows.filter(x=>x&&x.id&&x.state).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).slice(0,MAX_CHATS):[];
}
function writeChats(storage,rows){
  const ordered=rows.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).slice(0,MAX_CHATS);
  try{storage?.setItem(CHATS_KEY,JSON.stringify(ordered));return ordered}catch{}
  const smaller=ordered.slice(0,12).map(x=>({...x,state:{...x.state,events:(x.state.events||[]).slice(-80),messages:(x.state.messages||[]).slice(-60),result:x.state.result?{...x.state.result,diff:''}:null}}));
  try{storage?.setItem(CHATS_KEY,JSON.stringify(smaller));return smaller}catch{return ordered.slice(0,6)}
}
export function ensureActiveChat(storage=globalThis.localStorage,state=null){
  let active=storage?.getItem(ACTIVE_CHAT_KEY)||'';
  if(chatStoreOversized(storage))return active||null;
  const rows=listChats(storage);
  if(active&&rows.some(x=>x.id===active))return active;
  active=id();try{storage?.setItem(ACTIVE_CHAT_KEY,active)}catch{}
  if(state)snapshotChat(storage,state,active);
  return active;
}
export function snapshotChat(storage=globalThis.localStorage,state=null,chatId=null){
  if(!state||typeof state!=='object'||chatStoreOversized(storage))return null;
  const active=chatId||ensureActiveChat(storage);if(!active)return null;
  const rows=listChats(storage),previous=rows.find(x=>x.id===active),compact=compactState(state);
  const row={id:active,title:titleFor(compact),createdAt:previous?.createdAt||Date.now(),updatedAt:Date.now(),state:compact,parentId:previous?.parentId||null,rootId:previous?.rootId||active,forkedAt:previous?.forkedAt||null};
  writeChats(storage,[row,...rows.filter(x=>x.id!==active)]);return row;
}
export function snapshotCurrentChat(storage=globalThis.localStorage){
  if(chatStoreOversized(storage))return null;
  const state=parse(storage,UI_STATE_KEY,null);if(!state)return null;
  return snapshotChat(storage,state,ensureActiveChat(storage,state));
}
export function newChat(storage=globalThis.localStorage,transitionStorage=globalThis.sessionStorage){
  snapshotCurrentChat(storage);
  const next=id();
  if(!beginTransition(transitionStorage,next))return null;
  try{storage?.setItem(ACTIVE_CHAT_KEY,next);storage?.removeItem(UI_STATE_KEY);return next}catch{finishChatTransition(transitionStorage);return null}
}
export function restoreChat(storage=globalThis.localStorage,chatId,transitionStorage=globalThis.sessionStorage){
  const row=listChats(storage).find(x=>x.id===chatId);if(!row)return false;
  snapshotCurrentChat(storage);
  if(!beginTransition(transitionStorage,row.id))return false;
  try{
    storage?.setItem(ACTIVE_CHAT_KEY,row.id);
    storage?.setItem(UI_STATE_KEY,JSON.stringify(compactState(row.state)));
    return true;
  }catch{finishChatTransition(transitionStorage);return false}
}
export function forkChat(storage=globalThis.localStorage,chatId,transitionStorage=globalThis.sessionStorage){
  snapshotCurrentChat(storage);
  const rows=listChats(storage),source=rows.find(x=>x.id===chatId);if(!source)return null;
  const next=id(),forkedAt=Date.now(),state=compactState(source.state),rootId=source.rootId||source.id;
  state.branch={parentChatId:source.id,rootChatId:rootId,forkedAt};
  const branch={id:next,title:`${source.title} · branch`,createdAt:forkedAt,updatedAt:forkedAt,state,parentId:source.id,rootId,forkedAt};
  writeChats(storage,[branch,...rows]);
  if(!beginTransition(transitionStorage,next))return null;
  try{storage?.setItem(ACTIVE_CHAT_KEY,next);storage?.setItem(UI_STATE_KEY,JSON.stringify(state));return branch}catch{finishChatTransition(transitionStorage);return null}
}
const metric=row=>({
  id:row?.id||null,title:row?.title||'',score:row?.state?.result?.score??null,attempts:row?.state?.result?.attempts??null,provider:row?.state?.result?.provider||null,
  messages:Array.isArray(row?.state?.messages)?row.state.messages.length:0,events:Array.isArray(row?.state?.events)?row.state.events.length:0,
  changedFiles:Array.isArray(row?.state?.result?.changedFiles)?row.state.result.changedFiles:[],output:String(row?.state?.result?.output||'').slice(0,500)
});
export function compareChats(storage=globalThis.localStorage,leftId,rightId){
  const rows=listChats(storage),left=rows.find(x=>x.id===leftId),right=rows.find(x=>x.id===rightId);if(!left||!right)return null;
  const a=metric(left),b=metric(right);
  return {left:a,right:b,scoreDelta:a.score!=null&&b.score!=null?a.score-b.score:null,attemptDelta:a.attempts!=null&&b.attempts!=null?a.attempts-b.attempts:null,eventDelta:a.events-b.events};
}
export function branchTree(rows=[]){
  const clean=(Array.isArray(rows)?rows:[]).filter(x=>x?.id&&x?.state),byId=new Map(clean.map(x=>[x.id,x])),children=new Map();
  for(const row of clean){const parent=byId.has(row.parentId)?row.parentId:null;if(!children.has(parent))children.set(parent,[]);children.get(parent).push(row)}
  const order=(a,b)=>(a.forkedAt||a.createdAt||0)-(b.forkedAt||b.createdAt||0)||String(a.id).localeCompare(String(b.id));for(const group of children.values())group.sort(order);
  const out=[],walk=(row,depth=0)=>{out.push({...metric(row),parentId:row.parentId||null,rootId:row.rootId||row.id,forkedAt:row.forkedAt||null,createdAt:row.createdAt||0,updatedAt:row.updatedAt||0,depth});for(const child of children.get(row.id)||[])walk(child,depth+1)};
  for(const root of children.get(null)||[])walk(root,0);return out;
}
export function branchLineage(rows=[],chatId){
  const tree=branchTree(rows),byId=new Map(tree.map(x=>[x.id,x])),selected=byId.get(chatId);if(!selected)return{ancestors:[],descendants:[]};
  const ancestors=[];let parent=selected.parentId,guard=0;while(parent&&guard++<MAX_CHATS){ancestors.push(parent);parent=byId.get(parent)?.parentId||null}
  const descendants=[];let changed=true,seen=new Set([chatId]);while(changed){changed=false;for(const row of tree)if(row.parentId&&seen.has(row.parentId)&&!seen.has(row.id)){seen.add(row.id);descendants.push(row.id);changed=true}}
  return{ancestors,descendants};
}
export function deleteChat(storage=globalThis.localStorage,chatId){
  if(chatStoreOversized(storage))return[];
  const rows=listChats(storage).filter(x=>x.id!==chatId);writeChats(storage,rows);
  if(storage?.getItem(ACTIVE_CHAT_KEY)===chatId){try{storage.removeItem(ACTIVE_CHAT_KEY)}catch{}}
  return rows;
}
