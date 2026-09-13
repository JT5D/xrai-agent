import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { resolveBrowserModelProfile } from '../web/local-agent.js';

test('WebGPU profile uses q4 when adapter lacks shader-f16 and q4f16 when supported',async()=>{
  const basic=await resolveBrowserModelProfile({userAgent:'Desktop',deviceMemory:16,gpu:{requestAdapter:async()=>({features:new Set()})}},true);
  assert.equal(basic.device,'webgpu');
  assert.equal(basic.dtype,'q4');
  const f16=await resolveBrowserModelProfile({userAgent:'Desktop',deviceMemory:16,gpu:{requestAdapter:async()=>({features:new Set(['shader-f16'])})}},true);
  assert.equal(f16.device,'webgpu');
  assert.equal(f16.dtype,'q4f16');
  const none=await resolveBrowserModelProfile({userAgent:'Desktop',deviceMemory:16,gpu:{requestAdapter:async()=>null}},true);
  assert.equal(none.device,'wasm');
  assert.equal(none.dtype,'q4');
});

test('COI bootstrap does not initialize app before cross-origin isolation gets a controlled retry',async()=>{
  const bootstrap=await fs.readFile(new URL('../web/coi-bootstrap.js',import.meta.url),'utf8');
  assert.match(bootstrap,/if\(!globalThis\.crossOriginIsolated\)\{if\(reloadForIsolation\(\)\)return\}/);
  assert.match(bootstrap,/count>=2/);
  assert.match(bootstrap,/updateViaCache:'none'/);
});
