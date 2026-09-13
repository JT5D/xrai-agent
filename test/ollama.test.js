import test from 'node:test';import assert from 'node:assert/strict';import {detectOllama} from '../src/ollama.js';
test('Ollama detection is bounded and returns a capability object',async()=>{const r=await detectOllama();assert.equal(typeof r.available,'boolean');if(r.available)assert.ok(r.model);else assert.ok(r.reason)});
