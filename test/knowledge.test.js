import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { searchKnowledge } from '../src/knowledge.js';

test('knowledge retrieval favors relevant chunk',async()=>{
  const d=await fs.mkdtemp(path.join(os.tmpdir(),'xrai-kb-'));
  await fs.writeFile(path.join(d,'a.md'),'# Minimal agents\nUse a tiny shell loop and test-gated evaluation.');
  await fs.writeFile(path.join(d,'b.md'),'# Cooking\nBake bread.');
  const h=await searchKnowledge('tiny agent shell evaluation',[d],3);
  assert.equal(path.basename(h[0].source),'a.md');
  assert.ok(h[0].score>0);
});
