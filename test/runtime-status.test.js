import test from 'node:test';
import assert from 'node:assert/strict';
import {isRuntimeStatusQuestion,latestRepoEvidence,inspectRuntimeStatus} from '../web/runtime-status.js';
const sha='a'.repeat(40),runId=12;
const state=(code=0)=>({context:{repo:'JT5D/xrai-agent'},events:[
  {type:'tool:done',name:'GitHub public repo',runId:'repo1',data:{repo:'JT5D/xrai-agent',sha}},
  {type:'eval',runId:'repo1',data:{commands:[{cmd:'npm test',exitCode:code,timedOut:false}]}},
  {type:'run:done',runId:'repo1',data:{changedFiles:[]}}
]});
const jobs=['deploy','conversation','chat-retry','mobile-chat','mobile-repo','model-runtime','web','repo'].map(n=>({name:n==='deploy'?n:`live-e2e (${n})`,head_sha:sha,run_id:runId,status:'completed',conclusion:'success'}));
const fetcher=(rows=jobs,version='0.3.49')=>async url=>({ok:true,json:async()=>String(url).includes('build-info')?{repo:'JT5D/xrai-agent',sha,runId,version}:{jobs:rows}});
for(const text of ['are we fixed & working now?','Are we fixed and working now?','is it fixed?','did that work?','did you fix it?','are the tests passing?','what is our status?','show the current status'])test(`status intent: ${text}`,()=>assert.equal(isRuntimeStatusQuestion(text),true));
for(const text of ['is my car working?','what are trees?','fix the app now','research status code 500','is it fixed? if not fix it','are we ready? run tests now'])test(`not status-only: ${text}`,()=>assert.equal(isRuntimeStatusQuestion(text),false));
test('local receipts do not claim code changes or blanket success',async()=>{
  const r=await inspectRuntimeStatus({state:state(),tabVersion:'0.3.49',fetchFn:fetcher()});
  assert.equal(r.status,'completed');assert.equal(r.score,null);assert.match(r.output,/PASS npm test/);assert.match(r.output,/No code edits/);assert.match(r.output,/not a blanket all-clear/);
});
test('newer failed run wins over an older passing run',async()=>{
  const s=state();s.events.push(...state(1).events.map(e=>({...e,runId:'repo2'})));
  const r=await inspectRuntimeStatus({state:s,tabVersion:'0.3.49',fetchFn:fetcher()});
  assert.equal(r.status,'incomplete');assert.match(r.output,/FAIL npm test/);
});
test('compacted command receipts survive reload without prose parsing',()=>{
  const s=state();s.events[1].data.commands=s.events[1].data.commands.map(JSON.stringify);
  assert.equal(latestRepoEvidence(s).commands[0].code,0);
});
test('incomplete edits remain incomplete despite passing tests',async()=>{
  const s=state();s.events[2].data.status='incomplete';
  assert.equal((await inspectRuntimeStatus({state:s,tabVersion:'0.3.49',fetchFn:fetcher()})).status,'incomplete');
});
test('model success claims and scores alone are not evidence',async()=>{
  const r=await inspectRuntimeStatus({state:{messages:[{role:'agent',text:'All tests passed. I fixed everything.'}],result:{score:1}},fetchFn:async()=>{throw Error('offline')},tabVersion:'0.3.49'});
  assert.equal(r.status,'incomplete');assert.match(r.output,/No repository verification/);assert.doesNotMatch(r.output,/PASS npm/);
});
test('wrong repo evidence is not reused',()=>assert.equal(latestRepoEvidence(state(),'someone/else'),null));
test('cancelled or missing deployment flows cannot be green',async()=>{
  for(const rows of [jobs.slice(0,1),jobs.map(j=>({...j,conclusion:'cancelled'})),jobs.map(j=>({...j,head_sha:'b'.repeat(40)}))]){
    assert.equal((await inspectRuntimeStatus({tabVersion:'0.3.49',fetchFn:fetcher(rows)})).status,'incomplete');
  }
});
test('stale tab is not verified by a newer deployment',async()=>assert.equal((await inspectRuntimeStatus({tabVersion:'0.3.48',fetchFn:fetcher()})).status,'incomplete'));
test('empty exit codes are unverified, never passing',async()=>{
  const s=state(null);const r=await inspectRuntimeStatus({state:s,tabVersion:'0.3.49',fetchFn:fetcher()});assert.equal(r.status,'incomplete');assert.match(r.output,/UNVERIFIED npm test/);
});
test('network hangs terminate within a bounded timeout',async()=>{
  const r=await inspectRuntimeStatus({fetchFn:()=>new Promise(()=>{}),tabVersion:'0.3.49',timeoutMs:10});
  assert.equal(r.status,'incomplete');assert.match(r.output,/timed out/);
});
