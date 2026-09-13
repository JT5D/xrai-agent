import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeTrace } from '../src/kernel.js';
import { normalizeEvent } from '../web/event-model.js';

test('trace summary exposes execution quality signals to evaluator',()=>{
  const trace=summarizeTrace([
    {type:'tool:start',name:'bash'},
    {type:'tool:done',name:'bash',data:{ok:true}},
    {type:'agent:delegate'},
    {type:'knowledge:hit'},
    {type:'skill:hit'},
    {type:'tool:start',name:'bash'},
    {type:'tool:done',name:'bash',data:{ok:false},summary:'ERROR: test failed'}
  ]);
  assert.deepEqual(trace,{toolCalls:2,toolErrors:1,delegations:1,knowledgeHits:1,skillHits:1,events:7});
});

test('improvement events are first-class inspectable evidence',()=>{
  const event=normalizeEvent({type:'improvement:accept',summary:'Improved to 91%',data:{score:.91,previousScore:.84,attempt:2}});
  assert.equal(event.kind,'improvement');
  assert.equal(event.status,'completed');
  assert.equal(event.evidence.score,.91);
  assert.equal(event.evidence.previousScore,.84);
  assert.equal(event.evidence.attempt,2);
});
