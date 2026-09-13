import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVE_CHAT_KEY,CHAT_SWITCH_KEY,UI_STATE_KEY,finishChatTransition,isChatTransitioning,listChats,newChat,restoreChat,snapshotChat } from '../web/conversation-store.js';

function storage(){const m=new Map();return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),dump:()=>m}}
const state=(text,result='',run='r')=>({version:4,view:'chat',activeRunId:run,lastTask:text,runStatus:'completed',statusText:'done',messages:[{role:'user',text,runId:null},{role:'agent',text:result||`answer ${text}`,runId:run}],events:[{id:`e-${run}`,runId:run,type:'run:done',summary:`done ${text}`}],result:{runId:run,output:result||`answer ${text}`,diff:''},options:{workspace:'.',maxDepth:2,maxChildren:2,retries:1}});

test('conversation store restores exact old progress behind one atomic transition',()=>{
  const s=storage(),session=storage();s.setItem(ACTIVE_CHAT_KEY,'chat-a');s.setItem(UI_STATE_KEY,JSON.stringify(state('first task','first result','run-a')));snapshotChat(s,state('first task','first result','run-a'),'chat-a');
  const second=newChat(s,session);assert.notEqual(second,'chat-a');assert.equal(isChatTransitioning(session),true);finishChatTransition(session);
  s.setItem(UI_STATE_KEY,JSON.stringify(state('second task','second result','run-b')));snapshotChat(s,state('second task','second result','run-b'),second);
  assert.equal(listChats(s).length,2);assert.ok(listChats(s).some(x=>x.title.includes('first task')));
  assert.equal(restoreChat(s,'chat-a',session),true);const restored=JSON.parse(s.getItem(UI_STATE_KEY));assert.equal(restored.lastTask,'first task');assert.equal(restored.result.output,'first result');assert.equal(restored.activeRunId,'run-a');assert.equal(restored.events[0].runId,'run-a');assert.equal(s.getItem(ACTIVE_CHAT_KEY),'chat-a');assert.equal(session.getItem(CHAT_SWITCH_KEY),'chat-a');
});

test('new chat snapshots current chat then clears shared UI state without allowing stale persistence',()=>{
  const s=storage(),session=storage(),current=state('current','current answer','current-run');s.setItem(ACTIVE_CHAT_KEY,'current');s.setItem(UI_STATE_KEY,JSON.stringify(current));snapshotChat(s,current,'current');
  const next=newChat(s,session);assert.ok(next&&next!=='current');assert.equal(isChatTransitioning(session),true);assert.equal(s.getItem(UI_STATE_KEY),null);assert.equal(s.getItem(ACTIVE_CHAT_KEY),next);assert.equal(listChats(s).find(x=>x.id==='current').state.result.output,'current answer');
});

test('switching back and forth preserves each chats messages events and result without leakage',()=>{
  const s=storage(),session=storage();
  snapshotChat(s,state('alpha','alpha answer','alpha-run'),'alpha');snapshotChat(s,state('beta','beta answer','beta-run'),'beta');
  s.setItem(ACTIVE_CHAT_KEY,'beta');s.setItem(UI_STATE_KEY,JSON.stringify(state('beta','beta answer','beta-run')));
  assert.equal(restoreChat(s,'alpha',session),true);let restored=JSON.parse(s.getItem(UI_STATE_KEY));assert.deepEqual(restored.messages.map(x=>x.text),['alpha','alpha answer']);assert.equal(restored.events[0].runId,'alpha-run');
  finishChatTransition(session);assert.equal(restoreChat(s,'beta',session),true);restored=JSON.parse(s.getItem(UI_STATE_KEY));assert.deepEqual(restored.messages.map(x=>x.text),['beta','beta answer']);assert.equal(restored.events[0].runId,'beta-run');assert.doesNotMatch(JSON.stringify(restored),/alpha answer/);
});

test('missing chat does not disturb current state or arm a transition',()=>{
  const s=storage(),session=storage(),current=state('current','current answer','current-run');s.setItem(ACTIVE_CHAT_KEY,'current');s.setItem(UI_STATE_KEY,JSON.stringify(current));snapshotChat(s,current,'current');
  assert.equal(restoreChat(s,'does-not-exist',session),false);assert.equal(JSON.parse(s.getItem(UI_STATE_KEY)).lastTask,'current');assert.equal(isChatTransitioning(session),false);
});

test('conversation store remains bounded and preserves recent messages/events',()=>{
  const s=storage();for(let i=0;i<30;i++)snapshotChat(s,state(`task ${i}`),`chat-${i}`);assert.ok(listChats(s).length<=24);
  const latest=listChats(s)[0];assert.ok(Array.isArray(latest.state.messages));assert.ok(Array.isArray(latest.state.events));
});
