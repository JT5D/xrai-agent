import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyBuiltinTask} from '../web/capability-tools.js';

test('ordinary questions are not replaced with the XRAI capability inventory',()=>{
  for(const task of ['What are trees?','What are the next steps?','What tools should this project use?'])assert.equal(classifyBuiltinTask(task),null,task);
  assert.equal(classifyBuiltinTask('What are your capabilities?'),'capabilities');
  assert.equal(classifyBuiltinTask('What can you do?'),'capabilities');
  assert.equal(classifyBuiltinTask('Research AI agent tools on GitHub'),'web-search');
});
