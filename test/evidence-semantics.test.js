import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('browser chat cannot self-promote from model scores',async()=>{
  const source=await fs.readFile(new URL('../web/local-agent.js',import.meta.url),'utf8');
  assert.match(source,/transferVerified===true/);
  assert.match(source,/learning:'none'/);
  assert.match(source,/RETRIEVED EVIDENCE/);
  assert.doesNotMatch(source,/skill:promoted|directPromoteScore|supportNeeded/);
});

test('browser repo verification is not mislabeled as retained learning',async()=>{
  const source=await fs.readFile(new URL('../web/browser-workspace.js',import.meta.url),'utf8');
  assert.match(source,/verification:passed\?'sandbox-passed':'sandbox-failed'/);
  assert.match(source,/learning:'none'/);
  assert.match(source,/no reusable learning was retained/i);
  assert.doesNotMatch(source,/learning:\{status:passed\?'verified':'rejected'\}/);
  assert.doesNotMatch(source,/learning:'evidence'/);
});

test('unqualified browser fallback remains unchanged behind the model quality gate',async()=>{
  const source=await fs.readFile(new URL('../web/local-agent.js',import.meta.url),'utf8');
  assert.match(source,/resolveBrowserModelProfile\(navigator,true\)/);
  assert.match(source,/passes the explicit quality gate/);
});

test('public UI distinguishes verified evidence from aspirational self-improvement',async()=>{
  const html=await fs.readFile(new URL('../web/index.html',import.meta.url),'utf8');
  assert.match(html,/Evidence-driven/);
  assert.match(html,/transfer-verified skills only/);
  assert.match(html,/host transfer-gated/);
  assert.match(html,/does not promote learning from model scores/);
  assert.doesNotMatch(html,/Browser-only learning remains on this device/);
  assert.doesNotMatch(html,/Same XRAI kernel/);
});
