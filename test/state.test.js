import test from 'node:test';
import assert from 'node:assert/strict';
import { UI_STATE_KEY,UI_STATE_VERSION,defaultUiState,isConstrainedDevice,loadUiState,saveUiState,taskNeedsExecutionHost } from '../web/state.js';

class MemoryStorage{
  constructor(){this.map=new Map()}
  getItem(k){return this.map.get(k)??null}
  setItem(k,v){this.map.set(k,String(v))}
  removeItem(k){this.map.delete(k)}
}

test('repo and test tasks route to execution while ordinary chat does not',()=>{
  assert.equal(taskNeedsExecutionHost('review repo, fix any failed tests, verify & explain'),true);
  assert.equal(taskNeedsExecutionHost('Inspect this repo, fix failing tests, verify, and explain'),true);
  assert.equal(taskNeedsExecutionHost('Run npm test and patch the code'),true);
  assert.equal(taskNeedsExecutionHost('Explain evidence-gated skill learning simply'),false);
});

test('contextual followups never carry hidden execution context through the task classifier',()=>{
  assert.equal(taskNeedsExecutionHost('is it fixed?'),false);
  assert.equal(taskNeedsExecutionHost('try that again'),false);
  assert.equal(taskNeedsExecutionHost('retry'),false);
});

test('UI state v4 survives a reload with task, messages, canonical events, and running status intact',()=>{
  const storage=new MemoryStorage(),state=defaultUiState();
  assert.equal(UI_STATE_VERSION,4);
  state.lastTask='persistent task';state.runStatus='running';state.activeRunId='run-1';state.messages=[{id:'m1',role:'user',text:'persistent task'}];state.events=[{id:'e1',runId:'run-1',type:'run:start',summary:'persistent task'}];
  saveUiState(storage,state);
  const loaded=loadUiState(storage);
  assert.equal(loaded.lastTask,'persistent task');assert.equal(loaded.runStatus,'running');assert.equal(loaded.activeRunId,'run-1');assert.equal(loaded.messages.length,1);assert.equal(loaded.events.length,1);assert.equal(loaded.events[0].kind,'run');assert.ok(storage.getItem(UI_STATE_KEY));
});

test('old v3 state is intentionally ignored by the v4 state loader',()=>{
  const storage=new MemoryStorage();storage.setItem('xrai-ui-v3',JSON.stringify({version:3,lastTask:'stale'}));
  assert.equal(loadUiState(storage).lastTask,'');
});

test('mobile and low-memory devices select constrained behavior',()=>{
  assert.equal(isConstrainedDevice({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)'}),true);
  assert.equal(isConstrainedDevice({userAgent:'Desktop',deviceMemory:2}),true);
  assert.equal(isConstrainedDevice({userAgent:'Desktop',deviceMemory:16}),false);
});
