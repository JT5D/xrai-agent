from pathlib import Path
import json
p=Path('web/browser-workspace.js');s=p.read_text()
a=s.index('function changePreview(');b=s.index('\nexport async function runBrowserRepoTask',a)
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
test('download control is inside the visible chat composer and releases its URL later',async()=>{
  const fs=await import('node:fs/promises');
  const html=await fs.readFile(new URL('../web/index.html',import.meta.url),'utf8');
  const form=html.slice(html.indexOf('<form id="chatForm"'),html.indexOf('</form>'));
  assert.match(form,/id="downloadPatch"/);assert.equal((html.match(/id="downloadPatch"/g)||[]).length,1);
  const app=await fs.readFile(new URL('../web/app.js',import.meta.url),'utf8');
  assert.ok(!app.includes('a.click();URL.revokeObjectURL(url);'));
});
'''
p.write_text(s)
p=Path('web/index.html');s=p.read_text()
button='<button id="downloadPatch" class="subtle" type="button" hidden style="margin-top:9px">Download patch</button>'
assert s.count(button)==1
s=s.replace('            '+button+'\n','')
needle='<span id="status">ready</span>'
assert needle in s
s=s.replace(needle,needle+'<button id="downloadPatch" class="subtle" type="button" hidden>Download patch</button>')
p.write_text(s)
p=Path('web/app.js');s=p.read_text();old='a.click();URL.revokeObjectURL(url);setTimeout'
assert old in s
p.write_text(s.replace(old,'a.click();setTimeout'))
p=Path('package.json');data=json.loads(p.read_text());old=data['version'];parts=old.split('.');parts[-1]=str(int(parts[-1])+1);new='.'.join(parts);data['version']=new;p.write_text(json.dumps(data,indent=2)+'\n')
for name in ['web/index.html','README.md']:
    p=Path(name);p.write_text(p.read_text().replace(old,new))
p=Path('docs/STABILIZATION_2026-09-13.md')
p.write_text(p.read_text()+'''\n## Portable patch export follow-up\n\nThe patch exporter now writes a complete unified diff instead of a truncated display preview. Exports beyond the existing 50,000-character storage limit fail explicitly rather than producing corrupt patches. The download control is in the chat composer so mobile layouts do not hide it, and its object URL is released after the click rather than immediately.\n\n`test/patch-export.e2e.mjs` checks eight real `git apply` round trips and rendered downloads at 1440 and 390 pixels. It seeds a UI result deliberately: it does not claim model-generated repair. Run it with Playwright installed: `node test/patch-export.e2e.mjs`; pass the public app URL to verify deployment. The public default model remains an inference-quality blocker; no failed alternative model is promoted by this change.\n''')
