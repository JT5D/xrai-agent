import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationContext,executionIntent,isContinuation} from '../web/conversation-context.js';
const context={goal:'root cause fix chat context and memory',repo:'JT5D/xrai-agent'};
test('retry selects the preceding request, not an older execution goal',()=>{
  const c=conversationContext({context,messages:[{role:'user',text:'what are all agent capabilities?'},{role:'agent',text:'Inventory'},{role:'user',text:'try again'}]},'try again');
  assert.equal(c.lastTask,'what are all agent capabilities?');
  assert.equal(executionIntent('try again',c),false);
});
test('retry after a repo task still executes, including after reload',()=>{
  const state=JSON.parse(JSON.stringify({context,messages:[{role:'user',text:'review repo, fix failing tests'},{role:'agent',text:'Checks'},{role:'user',text:'try again'}]}));
  const c=conversationContext(state,'try again');
  assert.equal(executionIntent('try again',c),true);
  assert.equal(isContinuation('do it'),true);
});
