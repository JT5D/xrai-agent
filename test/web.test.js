import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('web UI ships reference-style orchestration, chat, status, activity, skills, and runtime views',async()=>{
  const h=await fs.readFile(new URL('../web/index.html',import.meta.url),'utf8');
  assert.match(h,/Agent Orchestration/);
  assert.match(h,/Chat with XRAI Agent/);
  assert.match(h,/Agent Status/);
  assert.match(h,/Recent activity/);
  assert.match(h,/Evidence-gated skills/);
  assert.match(h,/Local execution host/);
  assert.match(h,/never hidden chain-of-thought/);
});

test('web UI exposes durable recovery, zero-install repo execution, and patch download',async()=>{
  const app=await fs.readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const html=await fs.readFile(new URL('../web/index.html',import.meta.url),'utf8');
  assert.match(app,/loadUiState/);
  assert.match(app,/taskNeedsExecutionHost/);
  assert.match(app,/runBrowserRepoTask/);
  assert.match(app,/downloadPatch/);
  assert.match(html,/Run recovered after a page reload/);
  assert.match(html,/verified patch output/i);
  assert.match(html,/browser-enhancements\.js\?v=0\.3\.7/);
  assert.doesNotMatch(html,/repo-runtime\.js/);
});
