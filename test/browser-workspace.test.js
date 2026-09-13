import test from 'node:test';
import assert from 'node:assert/strict';
import { browserRepoSupport,parseGitHubRepo } from '../web/browser-workspace.js';

test('repo parser finds GitHub URLs and defaults to XRAI itself',()=>{
  assert.equal(parseGitHubRepo('inspect https://github.com/openai/openai and test it'),'openai/openai');
  assert.equal(parseGitHubRepo('inspect repo: JT5D/xrai-agent and verify'),'JT5D/xrai-agent');
  assert.equal(parseGitHubRepo('inspect repo, fix failing tests, verify, & explain'),'JT5D/xrai-agent');
});

test('zero-install repo lane is explicit about browser compatibility',()=>{
  assert.equal(browserRepoSupport({userAgent:'Mozilla Chrome/140 Safari/537.36'}).supported,true);
  assert.equal(browserRepoSupport({userAgent:'Mozilla iPhone Mobile Safari/605.1'}).supported,false);
  assert.equal(browserRepoSupport({userAgent:'Mozilla Firefox/145'}).supported,false);
});
