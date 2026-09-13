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
  const rows=listChats(storage).filter(x=>x.id!==active);
  const compact=compactState(state),row={id:active,title:titleFor(compact),createdAt:Date.now(),updatedAt:Date.now(),state:compact};
  const previous=listChats(storage).find(x=>x.id===active);if(previous)row.createdAt=previous.createdAt||row.createdAt;
  writeChats(storage,[row,...rows]);return row;
}
export function snapshotCurrentChat(storage=globalThis.localStorage){
  const state=parse(storage,UI_STATE_KEY,null);if(!state)return null;
  return snapshotChat(storage,state,ensureActiveChat(storage,state));
}
export function newChat(storage=globalThis.localStorage){
  snapshotCurrentChat(storage);
  const next=id();try{storage?.setItem(ACTIVE_CHAT_KEY,next);storage?.removeItem(UI_STATE_KEY)}catch{}
  return next;
}
export function restoreChat(storage=globalThis.localStorage,chatId,transitionStorage=globalThis.sessionStorage){
  const row=listChats(storage).find(x=>x.id===chatId);if(!row)return false;
  snapshotCurrentChat(storage);
  try{
    transitionStorage?.setItem(CHAT_SWITCH_KEY,row.id);
    storage?.setItem(ACTIVE_CHAT_KEY,row.id);
    storage?.setItem(UI_STATE_KEY,JSON.stringify(compactState(row.state)));
    return true;
  }catch{
    try{transitionStorage?.removeItem(CHAT_SWITCH_KEY)}catch{}
    return false;
  }
}
export function deleteChat(storage=globalThis.localStorage,chatId){
  const rows=listChats(storage).filter(x=>x.id!==chatId);writeChats(storage,rows);
  if(storage?.getItem(ACTIVE_CHAT_KEY)===chatId){try{storage.removeItem(ACTIVE_CHAT_KEY)}catch{}}
  return rows;
}
