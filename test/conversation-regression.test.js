import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationContext,isContinuation,executionIntent,requestsChanges,contextualResearchQuery,reasoningOutput} from '../web/conversation-context.js';
import {classifyBuiltinTask} from '../web/capability-tools.js';
import {saveUiState,loadUiState} from '../web/state.js';
import {verifiedImprovementsForRun} from '../web/improvement-guard.js';
import {searchWeb} from '../web/web-search.js';
const goal='research similar popular repos. recommend improvements. plan carefully, execute efficiently';
test('transcript followups retain the goal and recent assistant plan without leaking hidden input',()=>{
  const state={context:{repo:'JT5D/xrai-agent',goal},messages:[{role:'user',text:goal},{role:'agent',text:'Fix conversation state and test the actual UI.'}]};
  for(const task of ['do the recommendations','execute this','ok verify then fix those issues','do it now with previous plans from this chat','do it']){
    assert.equal(isContinuation(task),true,task);const c=conversationContext(state,task);
    assert.equal(c.goal,goal);assert.equal(c.messages.at(-1).role,'assistant');assert.equal(executionIntent(task,c),true,task);
  }
});
test('research retry repeats search; research alone does not become code execution',()=>{
  const c={goal:'research online & suggest areas for imrovements to xrai-agent'};
  assert.equal(executionIntent('try again',c),false);
  assert.equal(executionIntent('research similar popular repos. recommend improvements',{}),false);
  assert.equal(requestsChanges('review repo, fix failed tests, verify',c),false);
  assert.equal(classifyBuiltinTask('research skills and tools on github'),'web-search');
  assert.equal(classifyBuiltinTask('install tools in this repo'),null);
  assert.equal(classifyBuiltinTask('did self improvements happen?'),'self-improvement-proof');
});
test('research query uses relevant context and leaves explicit unrelated topics alone',()=>{
  assert.match(contextualResearchQuery('research online & suggest areas for imrovements',{goal:'review xrai-agent repo'}),/agent/);
  assert.equal(contextualResearchQuery('research improvements to garden drainage',{}),null);
  const c=conversationContext({context:{repo:'JT5D/xrai-agent',goal},messages:[]},'review https://github.com/example/other');
  assert.equal(c.repo,'example/other');
});
test('conversation history remains bounded and does not drop assistant roles',()=>{
  const c=conversationContext({messages:Array.from({length:100},(_,i)=>({role:i%2?'agent':'user',text:'x'.repeat(2000)}))},'continue');
  assert.ok(c.messages.length<=14);assert.ok(c.messages.reduce((n,m)=>n+m.content.length,0)<=8000);
});
test('execution receipts survive persistence and never prove a deployment',()=>{
  let raw;const storage={setItem:(_,v)=>raw=v,getItem:()=>raw};
  const event={id:'proof',runId:'r',type:'improvement:verified',data:{scope:'sandbox',repo:'JT5D/xrai-agent',sha:'abc12345',changedFiles:['web/app.js'],commands:[{cmd:'npm test',exitCode:0}]}};
  saveUiState(storage,{events:[event]});const restored=loadUiState(storage),rows=verifiedImprovementsForRun(restored);
  assert.equal(rows.length,1);assert.equal(rows[0].retained,false);
  event.data.commands[0].exitCode=1;assert.equal(verifiedImprovementsForRun({events:[event]}).length,0);
});
test('unsupported execution claims are rejected, not promoted to evidence',()=>{
  assert.match(reasoningOutput('I executed a Python addition calculation.'),/rejected/);
  assert.match(reasoningOutput('Context handling is implemented using Python.'),/rejected/);
  assert.equal(reasoningOutput('Here is a proposed design.'),'Here is a proposed design.');
});
test('unrelated provider results are not labeled relevant',async()=>{
  const result=await searchWeb('xrai agent orchestration',{fetchFn:async url=>({ok:true,status:200,text:async()=>'',json:async()=>String(url).includes('hn.algolia')?{hits:[{title:'A coffee shop loyalty program',url:'https://example.com/coffee'}]}:{}})});
  assert.equal(result.results.length,0);
});

test('ordinary questions are not capability inventories',()=>{assert.equal(classifyBuiltinTask('what are trees?'),null)});
