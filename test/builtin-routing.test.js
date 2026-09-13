import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {isRetryFollowup} from '../web/input-guard.js';
import {executionIntent,requestsChanges,contextualResearchQuery} from '../web/conversation-context.js';
import {classifyBuiltinTask} from '../web/capability-tools.js';
const source=await fs.readFile(new URL('../web/app.js',import.meta.url),'utf8');
const body=source.slice(source.indexOf('async function runBrowser('),source.indexOf('async function run(task'));
const make=new Function('isRetryFollowup','classifyBuiltinTask','executionIntent','runBuiltinTask','applyResult','activeSubmission','taskNeedsExecutionHost','runBrowserRepoTask','requestsChanges','contextualResearchQuery',body+'; return runBrowser');
test('actual browser dispatcher answers status questions without replaying prior research',async()=>{
 const calls=[];let result;
 const run=make(isRetryFollowup,classifyBuiltinTask,executionIntent,async task=>{calls.push(task);return {output:'0 verified improvements'}},r=>{result=r},{runId:'r'},()=>false,()=>{throw Error('Unexpected execution')},requestsChanges,contextualResearchQuery);
 await run('did self improvements happen?',{goal:'research similar popular repos and recommend improvements',messages:[]},()=>true);
 assert.deepEqual(calls,['did self improvements happen?']);assert.equal(result.output,'0 verified improvements');
});
test('actual browser dispatcher executes recommendations rather than replaying a capability answer',async()=>{
 const calls=[];let result;
 const run=make(isRetryFollowup,classifyBuiltinTask,executionIntent,()=>{throw Error('Unexpected capability replay')},r=>{result=r},{runId:'r'},()=>false,async task=>{calls.push(task);return {output:'actual sandbox result'}},requestsChanges,contextualResearchQuery);
 await run('do the recommendations',{repo:'JT5D/xrai-agent',goal:'what are the XRAI capabilities?',messages:[{role:'assistant',content:'Fix chat history.'}]},()=>true);
 assert.equal(calls.length,1);assert.match(calls[0],/Fix chat history/);assert.equal(result.output,'actual sandbox result');
});
