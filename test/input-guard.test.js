import test from 'node:test';
import assert from 'node:assert/strict';
import {contextualizeFollowup,migrateLegacyUiState,sanitizeTask,stateLooksStale} from '../web/input-guard.js';

class MemoryStorage{
  constructor(seed={}){this.map=new Map(Object.entries(seed))}
  getItem(k){return this.map.get(k)??null}
  setItem(k,v){this.map.set(k,String(v))}
  removeItem(k){this.map.delete(k)}
}

test('sanitizer neutralizes bogus repo targets from pasted runtime errors',()=>{
  const a=sanitizeTask('fix this error: filesystem/repository');
  const b=sanitizeTask('XRAI Agent Error: GitHub request failed (404) for https://api.github.com/repos/filesystem/repository');
  const c=sanitizeTask('Error https://api.github.com/repos/api.github.com/repos');
  assert.doesNotMatch(a,/filesystem\/repository/);
  assert.doesNotMatch(b,/api\.github\.com\/repos\/filesystem\/repository/);
  assert.doesNotMatch(c,/api\.github\.com\/repos\/api\.github\.com\/repos/);
});

test('sanitizer preserves legitimate GitHub repo targets',()=>{
  assert.equal(sanitizeTask('inspect https://github.com/openai/openai and run tests'),'inspect https://github.com/openai/openai and run tests');
  assert.equal(sanitizeTask('fix JT5D/xrai-agent failing tests'),'fix JT5D/xrai-agent failing tests');
});

test('legacy stale browser state is detected and cleared once',()=>{
  const stale={messages:[{text:'This task requires filesystem/repository and test execution. Open Runtime and use the local execution host.'}]};
  assert.equal(stateLooksStale(stale),true);
  const storage=new MemoryStorage({'xrai-ui-v3':JSON.stringify(stale)});
  assert.equal(migrateLegacyUiState(storage),true);
  assert.equal(storage.getItem('xrai-ui-v3'),null);
});

test('vague follow-up gets previous run evidence instead of losing context',()=>{
  const state={lastTask:'review repo, fix failed tests, verify & explain',result:{output:'Verification passed: 27/27 tests.'}};
  const storage=new MemoryStorage({'xrai-ui-v4':JSON.stringify(state)});
  const text=contextualizeFollowup('is it fixed?',storage);
  assert.match(text,/Previous XRAI context/);
  assert.match(text,/27\/27 tests/);
});
