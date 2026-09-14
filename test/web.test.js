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
  assert.match(h,/Transfer-verified skills/);
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

test('mobile composer is not covered by the desktop runtime dock',async()=>{
  const css=await fs.readFile(new URL('../web/styles.css',import.meta.url),'utf8');
  const mobile=css.match(/@media\(max-width:760px\)\{[^\n]+/i)?.[0]||'';
  assert.match(mobile,/\.mode-dock\{display:none\}/);
  assert.match(mobile,/\.composer\{position:sticky;bottom:0;z-index:25/);
});

test('browser run state crosses a paint boundary before heavyweight execution starts',async()=>{
  const app=await fs.readFile(new URL('../web/app.js',import.meta.url),'utf8');
  assert.match(app,/const yieldToBrowser=.*requestAnimationFrame/);
  assert.match(app,/requestAnimationFrame\(\(\)=>setTimeout\(resolve,0\)\)/);
  assert.match(app,/acceptEvent\(makeEvent[\s\S]*?await yieldToBrowser\(\)/);
  assert.match(app,/await runBrowser\(cleaned,context,live\)/);
});

test('X-ray observer decoration is idempotent and cannot recursively rewrite its observed subtree',async()=>{
  const inspector=await fs.readFile(new URL('../web/event-inspector.js',import.meta.url),'utf8');
  assert.match(inspector,/new MutationObserver/);
  assert.match(inspector,/const next=\[event\.type,event\.status,evidence\.join\('\\n'\)\]/);
  assert.match(inspector,/if\(more\.textContent!==next\)more\.textContent=next/);
  assert.doesNotMatch(inspector,/more\.textContent=\[event\.type,event\.status,evidence\.join\('\\n'\)\]/);
});

test('only the app owns submission and result writes',async()=>{
  const app=await fs.readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const extra=await fs.readFile(new URL('../web/browser-enhancements.js',import.meta.url),'utf8');
  assert.doesNotMatch(extra,/addEventListener\(['"]submit|executeBuiltin|queueRetry/);
  assert.match(app,/await runBuiltinTask/);assert.match(app,/activeSubmission===token/);
  assert.match(app,/conversationContext\(ui,cleaned\)/);
});