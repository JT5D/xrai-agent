import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
test('retry runs in the same owner without an artificial page reload',async()=>{
  const app=await fs.readFile(new URL('../web/app.js',import.meta.url),'utf8');
  assert.match(app,/isContinuation\(cleaned\)\?context.goal:cleaned/);
  assert.doesNotMatch(app,/location\.reload/);
});
