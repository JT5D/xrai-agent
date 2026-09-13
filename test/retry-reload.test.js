import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('retry reload cannot overwrite visible retry text with stale UI state',async()=>{
  const app=await fs.readFile(new URL('../web/app.js',import.meta.url),'utf8');
  assert.match(app,/RETRY_PENDING_KEY='xrai-retry-pending-v1'/);
  assert.match(app,/sessionStorage\.getItem\(CHAT_SWITCH_KEY\)\|\|sessionStorage\.getItem\(RETRY_PENDING_KEY\)/);
  assert.match(app,/import \{ isRetryFollowup \} from '\.\/input-guard\.js'/);
  assert.match(app,/resume:Boolean\(latestUser&&isRetryFollowup\(latestUser\.text\)\)/);
});
