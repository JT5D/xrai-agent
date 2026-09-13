import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('web UI ships X-ray provenance, chat, status, timeline, skills, and runtime views',async()=>{
  const h=await fs.readFile(new URL('../web/index.html',import.meta.url),'utf8');
  assert.match(h,/X-ray View/);
  assert.match(h,/God's-eye view/);
  assert.match(h,/Chat with XRAI Agent/);
  assert.match(h,/Agent Status/);
  assert.match(h,/Recent activity/);
  assert.match(h,/Timeline/);
  assert.match(h,/Evidence-gated skills/);
  assert.match(h,/Local execution host/);
  assert.match(h,/X-ray provenance/);
});

test('web UI exposes durable recovery, zero-install repo execution, and patch download',async()=>{
  const app=await fs.readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const html=await fs.readFile(new URL('../web/index.html',import.meta.url),'utf8');
  const bootstrap=await fs.readFile(new URL('../web/coi-bootstrap.js',import.meta.url),'utf8');
  assert.match(app,/loadUiState/);
  assert.match(app,/taskNeedsExecutionHost/);
  assert.match(app,/runBrowserRepoTask/);
  assert.match(app,/downloadPatch/);
  assert.match(html,/Run recovered after a page reload/);
  assert.match(html,/verified patch output/i);
  assert.match(bootstrap,/browser-enhancements\.js/);
  assert.match(bootstrap,/app\.js/);
  assert.doesNotMatch(html,/type="module"/);
  assert.doesNotMatch(html,/repo-runtime\.js/);
});

test('public composer stays inert until app initialization owns form submission',async()=>{
  const html=await fs.readFile(new URL('../web/index.html',import.meta.url),'utf8');
  const app=await fs.readFile(new URL('../web/app.js',import.meta.url),'utf8');
  assert.match(html,/<button id="runButton" type="submit" disabled>/);
  assert.match(app,/#chatForm'\)\.addEventListener\('submit'/);
  assert.match(app,/\$\('#runButton'\)\.disabled=ui\.runStatus==='running'/);
});

test('browser run state crosses a paint boundary before heavyweight execution starts',async()=>{
  const app=await fs.readFile(new URL('../web/app.js',import.meta.url),'utf8');
  assert.match(app,/const yieldToBrowser=.*requestAnimationFrame/);
  assert.match(app,/requestAnimationFrame\(\(\)=>setTimeout\(resolve,0\)\)/);
  assert.match(app,/acceptEvent\(startEvent\);ui\.activeRunId=startEvent\.runId;persist\(\);await yieldToBrowser\(\);/);
  assert.match(app,/try\{if\(mode==='server'\)await runServer\(cleaned\);else await runBrowser\(cleaned\)\}/);
});

test('X-ray observer decoration is idempotent and cannot recursively rewrite its observed subtree',async()=>{
  const inspector=await fs.readFile(new URL('../web/event-inspector.js',import.meta.url),'utf8');
  assert.match(inspector,/new MutationObserver/);
  assert.match(inspector,/const next=\[event\.type,event\.status,evidence\.join\('\\n'\)\]/);
  assert.match(inspector,/if\(more\.textContent!==next\)more\.textContent=next/);
  assert.doesNotMatch(inspector,/more\.textContent=\[event\.type,event\.status,evidence\.join\('\\n'\)\]/);
});

test('built-in browser tools publish persisted results without reloading them away',async()=>{
  const enhancements=await fs.readFile(new URL('../web/browser-enhancements.js',import.meta.url),'utf8');
  const app=await fs.readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const start=enhancements.indexOf('async function executeBuiltin');
  const end=enhancements.indexOf('function queueRetry');
  const block=enhancements.slice(start,end);
  assert.ok(start>=0&&end>start,'executeBuiltin block missing');
  assert.doesNotMatch(block,/location\.reload/);
  assert.match(block,/dispatchEvent\(new Event\('xrai:state-updated'\)\)/);
  assert.match(app,/addEventListener\('xrai:state-updated'/);
  assert.match(app,/ui=loadUiState\(localStorage\);renderAll\(\)/);
});

test('retry memory never rewrites the visible chat input',async()=>{
  const guard=await fs.readFile(new URL('../web/input-guard.js',import.meta.url),'utf8');
  const enhancements=await fs.readFile(new URL('../web/browser-enhancements.js',import.meta.url),'utf8');
  assert.doesNotMatch(guard,/addEventListener\(['"]submit['"]/);
  assert.doesNotMatch(guard,/input\.value\s*=\s*contextualizeFollowup/);
  assert.match(enhancements,/isRetryFollowup/);
  assert.match(enhancements,/lastMeaningfulUserTask/);
  assert.match(enhancements,/appendMessage\(state,'user',visibleTask\(task\)/);
  assert.match(enhancements,/sessionStorage\.setItem\(RETRY_PENDING_KEY/);
});

test('pending retry starts even when browser modules load after DOMContentLoaded',async()=>{
  const enhancements=await fs.readFile(new URL('../web/browser-enhancements.js',import.meta.url),'utf8');
  assert.match(enhancements,/document\.readyState==='loading'/);
  assert.match(enhancements,/addEventListener\('DOMContentLoaded',start,\{once:true\}\)/);
  assert.match(enhancements,/else start\(\)/);
});