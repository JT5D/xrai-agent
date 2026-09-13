import test from 'node:test';
import assert from 'node:assert/strict';
import { browserRepoSupport,buildChangeReport,buildFailureContext,parseGitHubRepo,selectRepoFiles } from '../web/browser-workspace.js';

test('repo parser finds GitHub URLs and defaults to XRAI itself',()=>{
  assert.equal(parseGitHubRepo('inspect https://github.com/openai/openai and test it'),'openai/openai');
  assert.equal(parseGitHubRepo('inspect repo: JT5D/xrai-agent and verify'),'JT5D/xrai-agent');
  assert.equal(parseGitHubRepo('inspect repo, fix failing tests, verify, & explain'),'JT5D/xrai-agent');
});

test('zero-install repo lane is explicit about browser compatibility',()=>{
  assert.equal(browserRepoSupport({userAgent:'Mozilla Chrome/140 Safari/537.36'}).supported,true);
  assert.equal(browserRepoSupport({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}).supported,true);
  assert.equal(browserRepoSupport({userAgent:'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36'}).supported,true);
  assert.equal(browserRepoSupport({userAgent:'Mozilla iPhone OS 16_3 Mobile Safari/605.1'}).supported,false);
  assert.equal(browserRepoSupport({userAgent:'Mozilla Firefox/145'}).supported,true);
  assert.equal(browserRepoSupport({userAgent:'Mozilla Chrome/140 Safari/537.36'},{document:{},crossOriginIsolated:false,SharedArrayBuffer}).supported,false);
});

test('repo selection prioritizes package metadata, lockfiles, tests, and source',()=>{
  const tree=[
    {type:'blob',path:'docs/huge.md',size:200000},
    {type:'blob',path:'src/app.js',size:1000},
    {type:'blob',path:'test/app.test.js',size:800},
    {type:'blob',path:'package-lock.json',size:500000},
    {type:'blob',path:'package.json',size:500}
  ];
  const {selected}=selectRepoFiles(tree);
  assert.deepEqual(selected.slice(0,2).map(x=>x.path),['package.json','package-lock.json']);
  assert.ok(selected.some(x=>x.path==='test/app.test.js'));
  assert.ok(selected.some(x=>x.path==='src/app.js'));
});

test('failure context prioritizes file paths present in real command output',()=>{
  const files=[
    {path:'src/a.js',text:'export const a = 1;'},
    {path:'src/b.js',text:'export const b = 2;'},
    {path:'test/a.test.js',text:'test("a",()=>{})'},
    {path:'package.json',text:'{}'}
  ];
  const context=buildFailureContext(files,[{output:'Assertion failed at src/b.js:12:4'}],5000);
  assert.ok(context.indexOf('--- src/b.js ---') < context.indexOf('--- test/a.test.js ---'));
});

test('change report exposes actual before and after evidence',()=>{
  const diff=buildChangeReport([{path:'src/a.js',before:'const x=1;\nexport {x};',after:'const x=2;\nexport {x};'}]);
  assert.match(diff,/--- "a\/src\/a\.js"/);
  assert.match(diff,/-const x=1/);
  assert.match(diff,/\+const x=2/);
});

test('patch export keeps unified hunks and missing-newline markers intact',()=>{
  const patch=buildChangeReport([{path:'src/a.js',before:'a',after:'b'}]);
  assert.match(patch, /@@ -1,1 \+1,1 @@/);
  assert.equal((patch.match(/No newline at end of file/g)||[]).length,2);
  assert.equal(buildChangeReport([{path:'src/a.js',before:'a',after:'a'}]),'');
  assert.throws(()=>buildChangeReport([{path:'a',before:'a'.repeat(30000),after:'b'.repeat(30000)}]),/no truncated patch/);
});
test('download control is inside the visible chat composer and releases its URL later',async()=>{
  const fs=await import('node:fs/promises');
  const html=await fs.readFile(new URL('../web/index.html',import.meta.url),'utf8');
  const form=html.slice(html.indexOf('<form id="chatForm"'),html.indexOf('</form>'));
  assert.match(form,/id="downloadPatch"/);assert.equal((html.match(/id="downloadPatch"/g)||[]).length,1);
  const app=await fs.readFile(new URL('../web/app.js',import.meta.url),'utf8');
  assert.ok(!app.includes('a.click();URL.revokeObjectURL(url);'));
});
