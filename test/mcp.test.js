import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRpc } from '../src/mcp.js';

test('MCP initializes and lists execution, knowledge, and skill tools',async()=>{
  const init=await handleRpc({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25'}});
  assert.equal(init.result.serverInfo.name,'xrai-agent');assert.equal(init.result.serverInfo.version,'0.2.0');
  const list=await handleRpc({jsonrpc:'2.0',id:2,method:'tools/list',params:{}}),names=list.result.tools.map(t=>t.name);
  assert.ok(names.includes('xrai_shell'));assert.ok(names.includes('xrai_knowledge'));assert.ok(names.includes('xrai_skills'));assert.ok(names.includes('xrai_run'));
});
