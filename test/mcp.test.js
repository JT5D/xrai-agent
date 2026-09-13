import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRpc } from '../src/mcp.js';
import pkg from '../package.json' with { type:'json' };

const MODERN_META={
  'io.modelcontextprotocol/protocolVersion':'2026-07-28',
  'io.modelcontextprotocol/clientCapabilities':{},
  'io.modelcontextprotocol/clientInfo':{name:'test-client',version:'1.0.0'}
};

test('MCP preserves legacy initialize flow and lists tools',async()=>{
  const init=await handleRpc({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25'}});
  assert.equal(init.result.protocolVersion,'2025-11-25');
  assert.equal(init.result.serverInfo.name,'xrai-agent');
  assert.equal(init.result.serverInfo.version,pkg.version);
  const list=await handleRpc({jsonrpc:'2.0',id:2,method:'tools/list',params:{}}),names=list.result.tools.map(t=>t.name);
  assert.ok(names.includes('xrai_shell'));assert.ok(names.includes('xrai_knowledge'));assert.ok(names.includes('xrai_skills'));assert.ok(names.includes('xrai_run'));
  assert.equal(list.result.resultType,undefined);assert.equal(list.result.ttlMs,undefined);assert.equal(list.result.cacheScope,undefined);
});

test('MCP supports stateless 2026 discovery and cacheable per-request tool metadata',async()=>{
  const discover=await handleRpc({jsonrpc:'2.0',id:'discover',method:'server/discover',params:{_meta:MODERN_META}});
  assert.equal(discover.result.resultType,'complete');
  assert.deepEqual(discover.result.supportedVersions,['2026-07-28']);
  assert.equal(discover.result._meta['io.modelcontextprotocol/serverInfo'].name,'xrai-agent');
  assert.equal(discover.result._meta['io.modelcontextprotocol/serverInfo'].version,pkg.version);
  const list=await handleRpc({jsonrpc:'2.0',id:3,method:'tools/list',params:{_meta:MODERN_META}});
  assert.equal(list.result.resultType,'complete');
  assert.ok(list.result.tools.some(t=>t.name==='xrai_run'));
  assert.equal(list.result.ttlMs,300_000);assert.equal(list.result.cacheScope,'public');
  assert.equal(list.result._meta['io.modelcontextprotocol/serverInfo'].name,'xrai-agent');
});
