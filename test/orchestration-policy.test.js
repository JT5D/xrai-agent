import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeOrchestration,ingestPolicyOutcomes,parsePlannerDecision,policyStore,shouldContinueImproving } from '../web/orchestration-policy.js';

const storage=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};

test('browser orchestration exposes ceilings without semantic task classification',()=>{
  const simple=analyzeOrchestration('explain photosynthesis',{maxChildren:3,maxRetries:2});
  const complex=analyzeOrchestration('research current agent architectures, compare approaches, improve code and verify end to end',{maxChildren:3,maxRetries:2});
  assert.equal(simple.mode,'model-led');assert.equal(complex.mode,'model-led');
  assert.equal(simple.workerCap,3);assert.equal(complex.workerCap,3);assert.equal(simple.retryCap,2);assert.equal(complex.retryCap,2);
  assert.equal(simple.policyKey,'model-led-v1');assert.equal(complex.policyKey,'model-led-v1');
  assert.equal(simple.bucket,complex.bucket);
});

test('constrained browser ceilings stay hard regardless of task wording',()=>{
  const p=analyzeOrchestration('deeply research, compare, implement, test and verify multiple improvements',{constrained:true,maxChildren:3,maxRetries:2});
  assert.equal(p.workerCap,1);assert.equal(p.retryCap,0);assert.equal(p.workers,1);
});

test('planner chooses execution shape and runtime only clamps it',()=>{
  const one=parsePlannerDecision('{"plan":"Answer directly.","workers":1,"parallel":false}',{workerCap:3});
  assert.deepEqual(one,{plan:'Answer directly.',workers:1,parallel:false});
  const many=parsePlannerDecision('{"plan":"Compare independently, then synthesize.","workers":9,"parallel":true}',{workerCap:2});
  assert.equal(many.workers,2);assert.equal(many.parallel,true);assert.match(many.plan,/Compare independently/);
});

test('invalid planner structure fails safely to one worker while preserving public plan text',()=>{
  const p=parsePlannerDecision('Inspect the evidence, then answer.',{workerCap:3});
  assert.equal(p.workers,1);assert.equal(p.parallel,false);assert.equal(p.plan,'Inspect the evidence, then answer.');
});

test('browser policy outcomes record actual model choices without promoting keyword policies',()=>{
  const s=storage(),start=new Date(1700000000000).toISOString(),end=new Date(1700000005000).toISOString();
  s.setItem('xrai-ui-v4',JSON.stringify({events:[
    {id:'s',runId:'r1',type:'run:start',ts:start},
    {id:'p',runId:'r1',type:'orchestration:policy',ts:start,data:{policyKey:'model-led-v1',bucket:'runtime:standard:workers-2:retries-1',workerCap:2,retryCap:1}},
    {id:'d',runId:'r1',type:'orchestration:decision',ts:start,data:{workers:2,parallel:true}},
    {id:'e',runId:'r1',type:'run:done',ts:end,data:{score:.9,pathScore:.88,attempts:1}}
  ]}));
  assert.deepEqual(ingestPolicyOutcomes(s),[]);const store=policyStore(s);assert.equal(store.outcomes.length,1);assert.equal(store.outcomes[0].workers,2);assert.equal(store.outcomes[0].retries,0);assert.equal(store.incumbentByBucket['runtime:standard:workers-2:retries-1'],undefined);
});

test('improvement loop stops on target, no gain, or budget and continues only for fixable gaps',()=>{
  assert.equal(shouldContinueImproving({score:.9,pathScore:.86,minScore:.82,attempt:1,maxAttempts:3}).reason,'target-met');assert.equal(shouldContinueImproving({score:.7,previousScore:.71,minScore:.82,attempt:2,maxAttempts:3}).reason,'no-gain');assert.equal(shouldContinueImproving({score:.7,minScore:.82,attempt:3,maxAttempts:3}).reason,'budget-exhausted');assert.equal(shouldContinueImproving({score:.7,minScore:.82,attempt:1,maxAttempts:3}).continue,true);
});
