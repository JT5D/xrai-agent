import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { extractEval,selectBrowserModelProfile } from '../web/local-agent.js';

test('static Pages build has no-key local inference and v2 skill learning',async()=>{
  const app=await fs.readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const local=await fs.readFile(new URL('../web/local-agent.js',import.meta.url),'utf8');
  const html=await fs.readFile(new URL('../web/index.html',import.meta.url),'utf8');
  assert.match(app,/runLocalTask/);assert.match(local,/LanguageModel/);assert.match(local,/LFM2\.5-350M-ONNX/);assert.match(local,/SmolLM2-135M-Instruct-ONNX-MHA/);assert.match(local,/xrai-skills-v2/);assert.match(local,/supportNeeded/);assert.match(html,/\.\/app\.js/);assert.doesNotMatch(html,/src="\/app\.js"/);
});

test('browser evaluator parse failure is fail-closed and cannot promote learning',()=>{
  const ev=extractEval('not valid evaluator json');assert.equal(ev.score,0);assert.equal(ev.skill.title,'');
});

test('browser chooses a smaller quantized model on mobile and a full model on capable desktop',()=>{
  const mobile=selectBrowserModelProfile({userAgent:'iPhone',gpu:{}});assert.equal(mobile.constrained,true);assert.match(mobile.modelId,/135M/);assert.equal(mobile.maxNewTokens,220);
  const desktop=selectBrowserModelProfile({userAgent:'Desktop',deviceMemory:16,gpu:{}});assert.equal(desktop.constrained,false);assert.match(desktop.modelId,/350M/);assert.equal(desktop.maxNewTokens,420);
});

test('public build links the canonical public XRAI Agent repository',async()=>{
  const html=await fs.readFile(new URL('../web/index.html',import.meta.url),'utf8');
  const readme=await fs.readFile(new URL('../README.md',import.meta.url),'utf8');
  assert.match(html,/https:\/\/github\.com\/JT5D\/xrai-agent/);
  assert.match(readme,/git clone https:\/\/github\.com\/JT5D\/xrai-agent\.git/);
  assert.doesNotMatch(html,/private preview repo/i);
  assert.doesNotMatch(readme,/JT5D\/unrepo/);
});

test('public browser version and cache-busted runtime assets stay synchronized',async()=>{
  const html=await fs.readFile(new URL('../web/index.html',import.meta.url),'utf8');
  const pkg=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url),'utf8'));
  const version=String(pkg.version).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  assert.match(html,new RegExp(`<dt>Version<\\/dt><dd>${version}<\\/dd>`));
  for(const asset of ['coi-bootstrap.js','static-runtime.js','input-guard.js','browser-enhancements.js','app.js'])assert.match(html,new RegExp(`${asset.replace('.','\\.')}\\?v=${version}`));
});

test('public browser has integrated zero-install repo execution',async()=>{
  const app=await fs.readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const workspace=await fs.readFile(new URL('../web/browser-workspace.js',import.meta.url),'utf8');
  const html=await fs.readFile(new URL('../web/index.html',import.meta.url),'utf8');
  const bootstrap=await fs.readFile(new URL('../web/coi-bootstrap.js',import.meta.url),'utf8');
  const sw=await fs.readFile(new URL('../web/coi-sw.js',import.meta.url),'utf8');
  assert.match(app,/runBrowserRepoTask/);
  assert.match(app,/taskNeedsExecutionHost/);
  assert.match(app,/downloadPatch/);
  assert.match(workspace,/@webcontainer\/api@1\.6\.4/);
  assert.match(workspace,/coep:'credentialless'/);
  assert.match(workspace,/\.teardown\(\)/);
  assert.match(workspace,/command timed out/);
  assert.match(workspace,/raw\.githubusercontent\.com/);
  assert.match(workspace,/Dependency install/);
  assert.match(workspace,/Test verifier/);
  assert.match(html,/coi-bootstrap\.js/);
  assert.doesNotMatch(html,/repo-runtime\.js/);
  assert.match(bootstrap,/serviceWorker\.register/);
  assert.match(sw,/Cross-Origin-Opener-Policy/);
  assert.match(sw,/Cross-Origin-Embedder-Policy/);
});
