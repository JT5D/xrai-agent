from pathlib import Path
p=Path('web/browser-workspace.js')
s=p.read_text()
a=s.index('function changePreview(')
b=s.index('\nexport async function runBrowserRepoTask',a)
replacement=r'''function changePreview({path,before,after}){
  if(before===after)return '';
  const lines=text=>String(text).match(/[^\n]*\n|[^\n]+$/g)||[];
  const a=lines(before),b=lines(after);let prefix=0,suffix=0;
  while(prefix<a.length&&prefix<b.length&&a[prefix]===b[prefix])prefix++;
  while(suffix<a.length-prefix&&suffix<b.length-prefix&&a[a.length-1-suffix]===b[b.length-1-suffix])suffix++;
  const from=Math.max(0,prefix-3),endA=Math.min(a.length,a.length-suffix+3),endB=Math.min(b.length,b.length-suffix+3);
  const name=prefix=>JSON.stringify(`${prefix}/${path}`);
  const line=(mark,text)=>mark+text+(text.endsWith('\n')?'':'\n\\ No newline at end of file\n');
  const countA=endA-from,countB=endB-from;
  return `diff --git ${name('a')} ${name('b')}\n--- ${name('a')}\n+++ ${name('b')}\n@@ -${countA?from+1:from},${countA} +${countB?from+1:from},${countB} @@\n`
    +a.slice(from,prefix).map(x=>line(' ',x)).join('')
    +a.slice(prefix,a.length-suffix).map(x=>line('-',x)).join('')
    +b.slice(prefix,b.length-suffix).map(x=>line('+',x)).join('')
    +a.slice(a.length-suffix,endA).map(x=>line(' ',x)).join('');
}
export function buildChangeReport(changes=[]){
  const patch=changes.map(changePreview).join('');
  if(patch.length>50000)throw new Error('Patch exceeds the 50,000-character browser export limit; no truncated patch was exported.');
  return patch;
}
'''
p.write_text(s[:a]+replacement+s[b:])
p=Path('test/browser-workspace.test.js');s=p.read_text()
s=s.replace(r'/--- src\/a\.js/',r'/--- "a\/src\/a\.js"/').replace('/- const x=1/','/-const x=1/').replace(r'/\+ const x=2/',r'/\+const x=2/')
s+=r'''
test('patch export keeps unified hunks and missing-newline markers intact',()=>{
  const patch=buildChangeReport([{path:'src/a.js',before:'a',after:'b'}]);
  assert.match(patch, /@@ -1,1 \+1,1 @@/);
  assert.equal((patch.match(/No newline at end of file/g)||[]).length,2);
  assert.equal(buildChangeReport([{path:'src/a.js',before:'a',after:'a'}]),'');
  assert.throws(()=>buildChangeReport([{path:'a',before:'a'.repeat(30000),after:'b'.repeat(30000)}]),/no truncated patch/);
});
'''
p.write_text(s)
