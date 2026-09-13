import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
test('only literal retries inherit prior routing, not status questions',()=>{assert.ok(app.includes('const inherited=isRetryFollowup(task)'));assert.ok(!app.includes('const inherited=isContinuation(task)'))});
test('legacy retry state is cleared and cannot block persistence',()=>{assert.ok(app.includes('sessionStorage.removeItem(RETRY_PENDING_KEY)'));assert.ok(!app.includes('||sessionStorage.getItem(RETRY_PENDING_KEY)'))});
