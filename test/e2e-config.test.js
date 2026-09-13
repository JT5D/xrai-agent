import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('deployed chat E2E uses bounded software WebGPU under Xvfb',async()=>{
  const e2e=await fs.readFile(new URL('./live-pages.e2e.mjs',import.meta.url),'utf8');
  const workflow=await fs.readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
  assert.match(e2e,/softwareWebGpu=flow==='chat-retry'/);
  assert.match(e2e,/--enable-unsafe-webgpu/);
  assert.match(e2e,/--use-vulkan=swiftshader/);
  assert.match(e2e,/--use-webgpu-adapter=swiftshader/);
  assert.match(e2e,/webgpuAdapter/);
  assert.match(workflow,/\[ "\$\{\{ matrix\.flow \}\}" = "repo" \] \|\| \[ "\$\{\{ matrix\.flow \}\}" = "chat-retry" \]/);
  assert.match(workflow,/xvfb-run -a node test\/live-pages\.e2e\.mjs/);
});
