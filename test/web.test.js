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

test('web UI exposes durable refresh recovery and truthful capability messaging',async()=>{
  const app=await fs.readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const html=await fs.readFile(new URL('../web/index.html',import.meta.url),'utf8');
  assert.match(app,/xrai-ui-v3|loadUiState/);
  assert.match(app,/taskNeedsExecutionHost/);
  assert.match(app,/Repo\/filesystem\/test execution requires a connected execution host/);
  assert.match(html,/Run recovered after a page reload/);
  assert.match(html,/No filesystem, shell, or private repo access/);
});
