import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {repairWorkspace,learningSummary,procedureRecords,safePath,unifiedPatch} from '../web/verified-repair.js';
const exec=promisify(execFile);
const childEnv={...process.env};delete childEnv.NODE_TEST_CONTEXT;
const storage=()=>{const data=new Map();return{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),data}};
const command=['node',['--test','test/add.test.mjs']];
const edit={path:'src/add.js',search:'a-b',replace:'a+b'};
async function fixture(t,{working=false}={}){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'xrai-real-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const files=[{path:'package.json',text:'{"type":"module"}'},{path:'src/add.js',text:`export const add=(a,b)=>${working?'a+b':'a-b'};\n`},{path:'test/add.test.mjs',text:"import {strict as assert} from 'node:assert';import {add} from '../src/add.js';assert.equal(add(2,3),5);\n"}];
  const host={write:async(p,text)=>{const file=path.join(root,p);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,text)},remove:p=>fs.rm(path.join(root,p)),run:async(cmd,args)=>{try{const r=await exec(cmd,args,{cwd:root,timeout:5000,env:childEnv});return{code:0,output:r.stdout+r.stderr,timedOut:false}}catch(e){return{code:typeof e.code==='number'?e.code:1,output:(e.stdout||'')+(e.stderr||''),timedOut:!!e.killed}}}};
  for(const f of files)await host.write(f.path,f.text);
  const baseline=[{cmd:command.flat().join(' '),...await host.run(...command)}];return{root,files,host,baseline,commands:[command],repo:'example/repo',sha:'abc12345',task:'Fix the addition bug'};
}
function model(actions){let calls=0;return{get calls(){return calls},getModel:async()=>({name:'scripted test model (not live AI)',prompt:async()=>{const a=actions[calls++]||{tool:'finish'};return JSON.stringify(a)}})}}
const fixedModel=()=>model([{tool:'read_file',path:'src/add.js'},{tool:'patch',edits:[edit]},{tool:'verify'},{tool:'finish',summary:'Corrected addition.'}]);

test('real failed Node test -> repair -> retained procedure -> fresh instance replay without model',async t=>{
  const mem=storage(),f=await fixture(t),m=fixedModel();assert.equal(f.baseline[0].code,1);
  const r=await repairWorkspace({...f,storage:mem,getModel:m.getModel});
  assert.equal(r.completed,true);assert.equal(r.improved,true);assert.equal(r.evidence[0].code,0);assert.equal(r.learning.status,'retained');assert.equal(learningSummary(mem).retained,1);
  const fresh=await fixture(t);let calls=0;
  const reused=await repairWorkspace({...fresh,storage:{getItem:mem.getItem,setItem:mem.setItem},getModel:async()=>{calls++;throw new Error('must not load a model')}});
  assert.equal(reused.learning.status,'reused');assert.equal(reused.evidence[0].code,0);assert.equal(calls,0);assert.equal(learningSummary(mem).reuses,1);
});

test('failed stored procedure replay is rolled back and quarantined, never counted as reuse',async t=>{
  const mem=storage();await repairWorkspace({...await fixture(t),storage:mem,getModel:fixedModel().getModel});
  const [key,value]=[...mem.data][0],rows=JSON.parse(value);rows[0].edits[0].replace='a*b';mem.setItem(key,JSON.stringify(rows));
  const f=await fixture(t),m=model([{tool:'finish'}]);const r=await repairWorkspace({...f,storage:mem,getModel:m.getModel});
  assert.equal(r.completed,false);assert.equal(r.changes.length,0);assert.match(await fs.readFile(path.join(f.root,'src/add.js'),'utf8'),/a-b/);assert.equal(learningSummary(mem).quarantined,1);assert.equal(learningSummary(mem).reuses,0);
});

test('passing unchanged tests and passing-only edits cannot manufacture improvements',async t=>{
  const mem=storage(),f=await fixture(t,{working:true});
  const unchanged=await repairWorkspace({...f,storage:mem,getModel:async()=>{throw new Error('no model needed')}});assert.equal(unchanged.improved,false);
  const m=model([{tool:'patch',edits:[{path:'src/add.js',search:'a+b',replace:'(a+b)'}]},{tool:'finish'}]);
  const r=await repairWorkspace({...f,requestedChange:true,storage:mem,getModel:m.getModel});
  assert.equal(r.completed,false);assert.equal(r.changes.length,0);assert.equal(learningSummary(mem).retained,0);assert.equal(r.learning.status,'rejected');
});

test('feature improvement requires a failing baseline regression test and passing unchanged existing tests',async t=>{
  const f=await fixture(t,{working:true});
  const m=model([{tool:'add_test',content:"import {strict as assert} from 'node:assert';import {add} from './src/add.js';assert.equal(add('2',3),5);\n"},{tool:'patch',edits:[{path:'src/add.js',search:'a+b',replace:'Number(a)+Number(b)'}]},{tool:'verify'},{tool:'finish'}]);
  const r=await repairWorkspace({...f,requestedChange:true,storage:storage(),getModel:m.getModel});
  assert.equal(r.completed,true);assert.equal(r.improved,true);assert.equal(r.regression.baselineExitCode,1);assert.equal(r.evidence.length,2);assert.ok(r.evidence.every(x=>x.code===0));assert.equal(r.changes.length,2);
  await fs.writeFile(path.join(f.root,'fix.patch'),unifiedPatch(r.changes));
  for(const c of r.changes){if(c.before==null)await f.host.remove(c.path);else await f.host.write(c.path,c.before)}
  await exec('git',['apply','--check','fix.patch'],{cwd:f.root});await exec('git',['apply','fix.patch'],{cwd:f.root});assert.equal((await f.host.run('node',['--test','xrai-acceptance.test.mjs'])).code,0);
});

test('immutable verifier tests and unsafe paths reject edits without writes',async t=>{
  for(const p of ['../escape.js','/tmp/escape.js','a/../b.js','.git/config','a/__proto__/b.js','x\\y.js'])assert.equal(safePath(p),false,p);
  const f=await fixture(t),m=model([{tool:'patch',edits:[{path:'test/add.test.mjs',search:'assert.equal(add(2,3),5)',replace:'assert.ok(true)'}]},{tool:'create_file',path:'../escape.js',content:'bad'},{tool:'finish'}]);
  const r=await repairWorkspace({...f,storage:storage(),getModel:m.getModel});assert.equal(r.completed,false);assert.equal(r.changes.length,0);assert.equal((await f.host.run(...command)).code,1);
});

test('source fingerprint prevents unrelated reuse, and corrupt/full storage fails safely',async t=>{
  const mem=storage();await repairWorkspace({...await fixture(t),storage:mem,getModel:fixedModel().getModel});
  const f=await fixture(t);f.files.find(f=>f.path==='src/add.js').text+='// changed snapshot\n';await f.host.write('src/add.js',f.files.find(f=>f.path==='src/add.js').text);
  const m=model([{tool:'finish'}]);await repairWorkspace({...f,storage:mem,getModel:m.getModel});assert.equal(m.calls,1);assert.equal(learningSummary(mem).reuses,0);
  assert.deepEqual(procedureRecords({getItem:()=>'{bad'}),[]);
  const r=await repairWorkspace({...await fixture(t),storage:{getItem:()=>null,setItem:()=>{throw new Error('quota')}},getModel:fixedModel().getModel});assert.equal(r.learning.status,'verified-not-persisted');assert.equal(r.completed,true);
});

test('tool budget stops repeated unproductive actions',async t=>{
  const f=await fixture(t),m=model(Array(10).fill({tool:'read_file',path:'src/add.js'}));
  const r=await repairWorkspace({...f,storage:storage(),getModel:m.getModel,maxSteps:8});assert.equal(r.completed,false);assert.equal(m.calls,3);assert.match(r.diagnosis,/no progress/);
});
