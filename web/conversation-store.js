export const CHATS_KEY='xrai-chats-v1';
export const ACTIVE_CHAT_KEY='xrai-active-chat-v1';
export const UI_STATE_KEY='xrai-ui-v4';
export const CHAT_SWITCH_KEY='xrai-chat-switch-v1';
const MAX_CHATS=24;

const id=()=>globalThis.crypto?.randomUUID?.()||`chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const parse=(storage,key,fallback)=>{try{return JSON.parse(storage?.getItem(key)||'null')??fallback}catch{return fallback}};
const titleFor=state=>{
  const first=(state?.messages||[]).find(m=>m?.role==='user'&&String(m.text||'').trim());
  const text=String(first?.text||state?.lastTask||'New chat').replace(/\s+/g,' ').trim();
  return (text||'New chat').slice(0,58);
};
function beginTransition(transitionStorage,chatId){try{transitionStorage?.setItem(CHAT_SWITCH_KEY,chatId);return true}catch{return false}}
export function isChatTransitioning(transitionStorage=globalThis.sessionStorage){try{return Boolean(transitionStorage?.getItem(CHAT_SWITCH_KEY))}catch{return false}}
export function finishChatTransition(transitionStorage=globalThis.sessionStorage){try{transitionStorage?.removeItem(CHAT_SWITCH_KEY)}catch{}}
export function compactState(state={}){
  const result=state.result&&typeof state.result==='object'?{...state.result,diff:String(state.result.diff||'').slice(0,50000)}:null;
  return {...state,messages:Array.isArray(state.messages)?state.messages.slice(-100):[],events:Array.isArray(state.events)?state.events.slice(-220):[],result,updatedAt:Date.now()};
}
export function listChats(storage=globalThis.localStorage){
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
  const rows=listChats(storage);
  if(active&&rows.some(x=>x.id===active))return active;
  active=id();try{storage?.setItem(ACTIVE_CHAT_KEY,active)}catch{}
  if(state)snapshotChat(storage,state,active);
  return active;
}
export function snapshotChat(storage=globalThis.localStorage,state=null,chatId=null){
  if(!state||typeof state!=='object')return null;
  const active=chatId||ensureActiveChat(storage);
  const rows=listChats(storage),previous=rows.find(x=>x.id===active),compact=compactState(state);
  const row={id:active,title:titleFor(compact),createdAt:previous?.createdAt||Date.now(),updatedAt:Date.now(),state:compact,parentId:previous?.parentId||null,rootId:previous?.rootId||active,forkedAt:previous?.forkedAt||null};
  writeChats(storage,[row,...rows.filter(x=>x.id!==active)]);return row;
}
export function snapshotCurrentChat(storage=globalThis.localStorage){
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
export function deleteChat(storage=globalThis.localStorage,chatId){
  const rows=listChats(storage).filter(x=>x.id!==chatId);writeChats(storage,rows);
  if(storage?.getItem(ACTIVE_CHAT_KEY)===chatId){try{storage.removeItem(ACTIVE_CHAT_KEY)}catch{}}
  return rows;
}
