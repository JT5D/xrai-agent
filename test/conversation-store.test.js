import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVE_CHAT_KEY,CHATS_KEY,UI_STATE_KEY,listChats,newChat,restoreChat,snapshotChat } from '../web/conversation-store.js';

function storage(){const m=new Map();return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),dump:()=>m}}
const state=(text,result='')=>({version:4,view:'chat',activeRunId:null,lastTask:text,runStatus:'completed',statusText:'done',messages:[{role:'user',text},{role:'agent',text:result||`answer ${text}`}],events:[{id:'e',runId:'r',type:'run:done',summary:'done'}],result:{output:result||`answer ${text}`,diff:''},options:{workspace:'.',maxDepth:2,maxChildren:2,retries:1}});

test('conversation store snapshots multiple chats and restores old progress',()=>{
  const s=storage();s.setItem(ACTIVE_CHAT_KEY,'chat-a');s.setItem(UI_STATE_KEY,JSON.stringify(state('first task','first result')));snapshotChat(s,state('first task','first result'),'chat-a');
  const second=newChat(s);assert.notEqual(second,'chat-a');s.setItem(UI_STATE_KEY,JSON.stringify(state('second task','second result')));snapshotChat(s,state('second task','second result'),second);
  assert.equal(listChats(s).length,2);assert.ok(listChats(s).some(x=>x.title.includes('first task')));
  assert.equal(restoreChat(s,'chat-a'),true);const restored=JSON.parse(s.getItem(UI_STATE_KEY));assert.equal(restored.lastTask,'first task');assert.equal(restored.result.output,'first result');assert.equal(s.getItem(ACTIVE_CHAT_KEY),'chat-a');
});

test('conversation store remains bounded and preserves recent messages/events',()=>{
  const s=storage();for(let i=0;i<30;i++)snapshotChat(s,state(`task ${i}`),`chat-${i}`);assert.ok(listChats(s).length<=24);
  const latest=listChats(s)[0];assert.ok(Array.isArray(latest.state.messages));assert.ok(Array.isArray(latest.state.events));
});
