import test from 'node:test';
import assert from 'node:assert/strict';
import { startWebServer } from '../src/server.js';

const post = (url, route, value) => fetch(`${url}${route}`, {
  method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(value)
});

// Real HTTP transport, controlled runner. This is not a model-quality evaluation.
test('the UI run-creation endpoint starts work, validates input, and preserves the legacy alias', async () => {
  const calls=[];
  const {server,url}=await startWebServer(0,'127.0.0.1',{
    runner: async (task,opts) => {
      calls.push({task,runId:opts.runId});
      return {runId:opts.runId,output:`received:${task}`,status:'incomplete',learning:{status:'none'}};
    }
  });
  try {
    const response=await post(url,'/api/runs',{task:'canonical endpoint'});
    assert.equal(response.status,202,'POST /api/runs must create a run, not return the run list');
    const started=await response.json();
    assert.equal(typeof started.runId,'string');
    assert.equal(started.status,'running');
    await new Promise(resolve=>setImmediate(resolve));
    const recovered=await (await fetch(`${url}/api/runs/${started.runId}`)).json();
    assert.equal(recovered.runId,started.runId);
    assert.equal(recovered.result.output,'received:canonical endpoint');
    assert.equal(recovered.result.status,'incomplete','Transport completion must retain the runner outcome');
    assert.equal(calls.length,1,'The submitted task must execute exactly once');

    assert.equal((await post(url,'/api/runs',{})).status,400);
    assert.equal(calls.length,1,'Invalid input must not execute');
    const legacy=await post(url,'/api/run',{task:'legacy endpoint'});
    assert.equal(legacy.status,202);
    await legacy.json();
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls.length,2);
    const listed=await (await fetch(`${url}/api/runs`)).json();
    assert.ok(Array.isArray(listed));
    assert.equal(listed.length,2);
  } finally {
    await new Promise(resolve=>server.close(resolve));
  }
});
