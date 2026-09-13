import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeOrchestration,shouldContinueImproving } from '../web/orchestration-policy.js';

test('simple browser tasks stay single-worker and avoid wasteful retries',()=>{
  const p=analyzeOrchestration('explain photosynthesis',{maxChildren:2,maxRetries:2});
  assert.equal(p.mode,'fast');
  assert.equal(p.workers,1);
  assert.equal(p.retries,0);
});

test('complex separable verified tasks earn bounded parallel workers and retries',()=>{
  const p=analyzeOrchestration('research current agent architectures, compare multiple approaches, improve the repo and verify with tests end to end',{maxChildren:3,maxRetries:2});
  assert.equal(p.parallelWorkers,true);
  assert.equal(p.workers,2);
  assert.equal(p.retries,2);
  assert.equal(p.evidenceCritical,true);
  assert.equal(p.fresh,true);
});

test('constrained devices stay bounded even for complex work',()=>{
  const p=analyzeOrchestration('deeply research, compare, implement, test and verify multiple improvements',{constrained:true,maxChildren:3,maxRetries:2});
  assert.equal(p.workers,1);
  assert.equal(p.retries,0);
});

test('improvement loop stops on target, no gain, or budget and continues only for fixable gaps',()=>{
  assert.equal(shouldContinueImproving({score:.9,pathScore:.86,minScore:.82,attempt:1,maxAttempts:3}).reason,'target-met');
  assert.equal(shouldContinueImproving({score:.7,previousScore:.71,minScore:.82,attempt:2,maxAttempts:3}).reason,'no-gain');
  assert.equal(shouldContinueImproving({score:.7,minScore:.82,attempt:3,maxAttempts:3}).reason,'budget-exhausted');
  assert.equal(shouldContinueImproving({score:.7,minScore:.82,attempt:1,maxAttempts:3}).continue,true);
});
