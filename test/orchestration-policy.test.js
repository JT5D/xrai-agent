import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeOrchestration,ingestPolicyOutcomes,policyStore,shouldContinueImproving } from '../web/orchestration-policy.js';

const storage=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};

test('simple browser tasks stay single-worker and avoid wasteful retries',()=>{
  const p=analyzeOrchestration('explain photosynthesis',{maxChildren:2,maxRetries:2,storage:null});
  assert.equal(p.mode,'fast');assert.equal(p.workers,1);assert.equal(p.retries,0);
});

test('complex separable verified tasks earn bounded parallel workers and retries',()=>{
  const p=analyzeOrchestration('research current agent architectures, compare multiple approaches, improve the repo and verify with tests end to end',{maxChildren:3,maxRetries:2,storage:null});
  assert.equal(p.parallelWorkers,true);assert.equal(p.workers,2);assert.equal(p.retries,2);assert.equal(p.evidenceCritical,true);assert.equal(p.fresh,true);
});

test('constrained devices stay bounded even for complex work',()=>{
  const p=analyzeOrchestration('deeply research, compare, implement, test and verify multiple improvements',{constrained:true,maxChildren:3,maxRetries:2,storage:null});
  assert.equal(p.workers,1);assert.equal(p.retries,0);
});

test('policy challengers promote only after comparable evidence beats incumbent',()=>{
  const s=storage(),events=[],bucket='deep:sep:evidence:fresh';let t=0;
  const run=(id,key,score,path,duration)=>{const start=new Date(1700000000000+(t+=100000)).toISOString(),end=new Date(new Date(start).getTime()+duration).toISOString();events.push({id:`${id}-s`,runId:id,type:'run:start',ts:start},{id:`${id}-p`,runId:id,type:'orchestration:policy',ts:start,data:{policyKey:key,bucket,workers:key==='breadth-v2'?2:1,retries:1}},{id:`${id}-d`,runId:id,type:'run:done',ts:end,data:{score,pathScore:path}})};
  for(let i=0;i<4;i++)run(`a${i}`,'adaptive-v1',.82,.82,70000);
  for(let i=0;i<4;i++)run(`b${i}`,'breadth-v2',.95,.94,50000);
  s.setItem('xrai-ui-v4',JSON.stringify({events}));const decisions=ingestPolicyOutcomes(s),store=policyStore(s);
  assert.equal(store.incumbentByBucket[bucket],'breadth-v2');assert.ok(decisions.some(d=>d.type==='policy:promoted'&&d.challenger==='breadth-v2'));
});

test('policy evidence is bucketed so incomparable tasks cannot promote each other',()=>{
  const s=storage(),events=[];for(let i=0;i<4;i++){const ts=new Date(1700000000000+i*1000).toISOString();events.push({id:`a${i}s`,runId:`a${i}`,type:'run:start',ts},{id:`a${i}p`,runId:`a${i}`,type:'orchestration:policy',ts,data:{policyKey:'adaptive-v1',bucket:'fast:single:ordinary:stable',workers:1,retries:0}},{id:`a${i}d`,runId:`a${i}`,type:'run:done',ts:new Date(new Date(ts).getTime()+1000).toISOString(),data:{score:.6,pathScore:.6}})}for(let i=0;i<4;i++){const ts=new Date(1700000100000+i*1000).toISOString();events.push({id:`b${i}s`,runId:`b${i}`,type:'run:start',ts},{id:`b${i}p`,runId:`b${i}`,type:'orchestration:policy',ts,data:{policyKey:'breadth-v2',bucket:'deep:sep:evidence:fresh',workers:2,retries:1}},{id:`b${i}d`,runId:`b${i}`,type:'run:done',ts:new Date(new Date(ts).getTime()+1000).toISOString(),data:{score:1,pathScore:1}})}s.setItem('xrai-ui-v4',JSON.stringify({events}));ingestPolicyOutcomes(s);assert.equal(policyStore(s).incumbentByBucket['fast:single:ordinary:stable'],undefined);assert.equal(policyStore(s).incumbentByBucket['deep:sep:evidence:fresh'],undefined);
});

test('improvement loop stops on target, no gain, or budget and continues only for fixable gaps',()=>{
  assert.equal(shouldContinueImproving({score:.9,pathScore:.86,minScore:.82,attempt:1,maxAttempts:3}).reason,'target-met');assert.equal(shouldContinueImproving({score:.7,previousScore:.71,minScore:.82,attempt:2,maxAttempts:3}).reason,'no-gain');assert.equal(shouldContinueImproving({score:.7,minScore:.82,attempt:3,maxAttempts:3}).reason,'budget-exhausted');assert.equal(shouldContinueImproving({score:.7,minScore:.82,attempt:1,maxAttempts:3}).continue,true);
});
