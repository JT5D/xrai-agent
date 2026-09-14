import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const workflow=fs.readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
test('deployment is gated on source checks and multi-case real model qualification',()=>{
  const preflight=workflow.split('  preflight:')[1]?.split('\n  deploy:')[0];
  assert.ok(preflight);
  assert.match(preflight,/npm run check/);
  assert.match(preflight,/node test\/model-qualification\.e2e\.mjs http:\/\/127\.0\.0\.1:8765\//);
  assert.doesNotMatch(preflight,/continue-on-error|LanguageModel\s*=/);
  assert.match(workflow,/\n  deploy:\n    needs: preflight\n/);
});
