import test from 'node:test';
import assert from 'node:assert/strict';
import { eventInspectorRows,normalizeEvent } from '../web/event-model.js';
import { normalizeUiState } from '../web/state.js';

test('canonical event model normalizes tool evidence without hidden reasoning',()=>{
  const event=normalizeEvent({id:'e1',runId:'r1',type:'tool:done',name:'Test verifier',summary:'PASS · npm test',data:{exitCode:0,timedOut:false,repo:'JT5D/xrai-agent'}});
  assert.equal(event.kind,'tool');
  assert.equal(event.status,'completed');
  assert.equal(event.evidence.exitCode,0);
  assert.equal(event.evidence.repo,'JT5D/xrai-agent');
  assert.equal(event.parentId,null);
});

test('state boundary canonicalizes every persisted event',()=>{
  const state=normalizeUiState({version:4,messages:[],events:[{id:'e1',runId:'r1',type:'eval',summary:'verified',data:{score:.95}}],options:{}});
  assert.equal(state.events[0].kind,'verification');
  assert.equal(state.events[0].status,'completed');
  assert.equal(state.events[0].evidence.score,.95);
});

test('inspector exposes concise safe execution evidence',()=>{
  const rows=eventInspectorRows({type:'tool:done',name:'Dependency install',summary:'PASS',data:{exitCode:0,timedOut:false,fileCount:120}});
  const text=rows.map(([k,v])=>`${k}:${v}`).join('\n');
  assert.match(text,/Status:completed/);
  assert.match(text,/exitCode:0/);
  assert.match(text,/fileCount:120/);
  assert.doesNotMatch(text,/chain[- ]of[- ]thought|reasoning/i);
});
