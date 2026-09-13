import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
test('web UI ships chat and observable control room',async()=>{const h=await fs.readFile(new URL('../web/index.html',import.meta.url),'utf8');assert.match(h,/Chat/);assert.match(h,/Control Room/);assert.match(h,/Live execution graph/);assert.match(h,/not hidden chain-of-thought/)});
