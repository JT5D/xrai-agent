import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationContext,isContinuation,executionIntent,requestsChanges,resolvedTask,contextualResearchQuery} from '../web/conversation-context.js';
import {classifyBuiltinTask} from '../web/capability-tools.js';
test('full transcript routes current research before interpreting execution style words',()=>{
  let state={context:{repo:'JT5D/xrai-agent',goal:'review repo, fix failed tests, verify'},messages:[{role:'user',text:'review xrai-agent repo'}]};
  const turns=[
    ['research similar popular repos. recommend improvements. plan carefully, execute efficiently','web-search',false,true],
    ['do the recommendations',null,true,true],
    ['prove self improvement is happening by making 3 improvements now',null,true,true],
    ['did self improvements happen?','self-improvement-proof',false,true],
    ['make 5 more improvements based on priority',null,true,true],
    ['research online & suggest areas for imrovements','web-search',false,false],
    ['those are not related to xrai-agent improvements. root cause fix this type of confusion',null,true,true],
    ['execute this',null,true,true],
    ['see chat history to understand where your confusion was. also are chat replies delayed & out of order? root cause fix this',null,true,true],
    ['ok verify then fix those issues',null,true,true],
    ['you keep forgettng chat history & context. root cause fix this issue first, then other priority isssues',null,true,true]
  ];
  for(const [task,kind,exec,change] of turns){
    const context=conversationContext(state,task);
    assert.equal(classifyBuiltinTask(resolvedTask(task,context)),kind,task);
    assert.equal(executionIntent(task,context),exec,task);
    assert.equal(requestsChanges(task,context),change,task);
    if(kind==='web-search')assert.match(contextualResearchQuery(task,context),/AI agent/);
    state.context={repo:context.repo,goal:isContinuation(task)?context.goal:task};state.messages.push({role:'user',text:task});
  }
});
test('research retry preserves research but a requested fix is not replaced by it',()=>{
  const context={goal:'research similar popular repos',projectScoped:true};
  assert.equal(classifyBuiltinTask(resolvedTask('try again',context)),'web-search');
  assert.equal(classifyBuiltinTask(resolvedTask('execute this',context)),null);
  assert.equal(requestsChanges('fix duplicate replies',context),true);
  assert.equal(requestsChanges('review repo, fix failed tests, verify',context),false);
  assert.equal(executionIntent('improve my cake recipe',{}),false);
});
