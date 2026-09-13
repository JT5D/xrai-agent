import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

test('static Pages runtime falls back to jsDelivr when anonymous GitHub REST is rate-limited',async()=>{
  const source=await fs.readFile(new URL('../web/static-runtime.js',import.meta.url),'utf8');
  const requests=[];
  const nativeFetch=async input=>{
    const url=typeof input==='string'?input:input.url;requests.push(url);
    if(url==='https://api.github.com/repos/JT5D/xrai-agent')return new Response('rate limited',{status:403});
    if(url.includes('data.jsdelivr.com/v1/package/gh/JT5D/xrai-agent@main/flat'))return new Response(JSON.stringify({files:[{name:'/package.json',type:'file',size:10,hash:'h'}]}),{status:200,headers:{'content-type':'application/json'}});
    return new Response('missing',{status:404});
  };
  const context={location:{hostname:'jt5d.github.io'},fetch:nativeFetch,Response,URL,console};context.globalThis=context;
  vm.runInNewContext(source,context);
  const res=await context.fetch('https://api.github.com/repos/JT5D/xrai-agent');
  assert.equal(res.status,200);const data=await res.json();
  assert.equal(data.full_name,'JT5D/xrai-agent');assert.equal(data.default_branch,'main');assert.equal(data.xrai_mirror,'jsdelivr');
  assert.ok(requests.some(x=>x.includes('data.jsdelivr.com')));
});
