import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationContext,isContinuation,executionIntent,requestsChanges} from '../web/conversation-context.js';
test('status questions preserve the prior actionable plan for the next execution follow-up',()=>{
 const goal='Research XRAI agent repositories and recommend improvements';
 const state={context:{repo:'JT5D/xrai-agent',goal},messages:[]};
 for(const task of ['did self improvements happen?','what was the plan?','are the changes verified?']){
  assert.equal(isContinuation(task),true,task);assert.equal(executionIntent(task,state.context),false);
  const context=conversationContext(state,task);
  state.context={repo:context.repo,goal:isContinuation(task)?context.goal:task};
 }
 assert.equal(state.context.goal,goal);assert.equal(executionIntent('do the recommendations',state.context),true);
});
test('polite explicit repairs execute, and passing baselines do not satisfy requested bug fixes',()=>{
 assert.equal(executionIntent('can you fix the XRAI chat bug?',{}),true);
 assert.equal(requestsChanges('fix the XRAI chat bug'),true);
 assert.equal(requestsChanges('review repo, fix any failed tests, verify and explain'),false);
 assert.equal(executionIntent('can it search the web?',{}),false);
});
