import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('deployed browser E2E separates deterministic chat semantics from real model readiness',async()=>{
  const e2e=await fs.readFile(new URL('./live-pages.e2e.mjs',import.meta.url),'utf8');
  const workflow=await fs.readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
  assert.match(e2e,/deterministicChatModel=flow==='chat-retry'/);
  assert.match(e2e,/softwareWebGpu=flow==='model-runtime'/);
  assert.match(e2e,/globalThis\.LanguageModel=/);
  assert.match(e2e,/model-runtime:ready/);
  assert.match(e2e,/model_q4/);
  assert.match(e2e,/--enable-unsafe-webgpu/);
  assert.match(e2e,/--use-vulkan=swiftshader/);
  assert.match(e2e,/--use-webgpu-adapter=swiftshader/);
  assert.match(e2e,/webgpuAdapter/);
  assert.match(workflow,/flow: \[chat-retry, model-runtime, web, repo\]/);
  assert.match(workflow,/\[ "\$\{\{ matrix\.flow \}\}" = "repo" \] \|\| \[ "\$\{\{ matrix\.flow \}\}" = "model-runtime" \]/);
  assert.match(workflow,/xvfb-run -a node test\/live-pages\.e2e\.mjs/);
});
