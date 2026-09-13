import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunManager } from '../src/server.js';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('server run manager starts work in background so a browser refresh cannot cancel the run',async()=>{
  const manager=createRunManager(async(task,opts)=>{await sleep(25);return{runId:opts.runId,output:`done:${task}`,score:.91,attempts:1,learning:{status:'none'}}});
  const started=manager.start('survive refresh',{workspace:'.'});
  assert.equal(started.status,'running');assert.ok(started.runId);
  await sleep(45);
  const recovered=manager.get(started.runId);
  assert.equal(recovered.status,'completed');assert.equal(recovered.result.output,'done:survive refresh');assert.equal(recovered.result.runId,started.runId);
});

test('HTTP run API returns immediately and the same run can be recovered after the client disconnects',async()=>{
  const {server,url}=await (await import('../src/server.js')).startWebServer(0,'127.0.0.1',{runner:async(task,opts)=>{await sleep(30);return{runId:opts.runId,output:`verified:${task}`,score:.95,attempts:1,learning:{status:'none'}}}});
  try{
    const started=await fetch(`${url}/api/run`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({task:'http persistence check'})});
    assert.equal(started.status,202);const first=await started.json();assert.equal(first.status,'running');
    await sleep(55);
    const recovered=await fetch(`${url}/api/runs/${first.runId}`);assert.equal(recovered.status,200);const state=await recovered.json();
    assert.equal(state.status,'completed');assert.equal(state.result.output,'verified:http persistence check');assert.equal(state.result.runId,first.runId);
  }finally{await new Promise(resolve=>server.close(resolve))}
});
