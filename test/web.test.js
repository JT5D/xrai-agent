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
  assert.match(app,/loadUiState/);
  assert.match(app,/taskNeedsExecutionHost/);
  assert.match(app,/runBrowserRepoTask/);
  assert.match(app,/downloadPatch/);
  assert.match(html,/Run recovered after a page reload/);
  assert.match(html,/verified patch output/i);
  assert.match(html,/browser-enhancements\.js\?v=\d+\.\d+\.\d+/);
  assert.doesNotMatch(html,/repo-runtime\.js/);
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
