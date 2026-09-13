const WC_CDN='https://cdn.jsdelivr.net/npm/@webcontainer/api@1.6.4/+esm';
const DEFAULT_REPO='JT5D/xrai-agent';
const MAX_FILES=320,MAX_FILE_BYTES=260_000,MAX_LOCK_BYTES=1_200_000,MAX_TOTAL_BYTES=4_000_000;
const INSTALL_TIMEOUT_MS=120_000,VERIFY_TIMEOUT_MS=90_000;
const SKIP_EXT=/\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|woff2?|ttf|otf|mp[34]|mov|avi|wasm|bin|lockb)$/i;
const SKIP_PATH=/(^|\/)(node_modules|\.git|dist|build|coverage|\.next|vendor|target)(\/|$)/;
const LOCK_FILE=/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i;
const uid=()=>globalThis.crypto?.randomUUID?.()||`xrai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;

export function parseGitHubRepo(task='',fallback=DEFAULT_REPO){
  const text=String(task);
  const url=text.match(/https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:[\s/#?]|$)/i);
  if(url)return `${url[1]}/${url[2].replace(/\.git$/,'')}`;
  const explicit=text.match(/\b(?:repo(?:sitory)?\s*[:=]?\s*)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\b/);
  if(explicit&&!['http','https'].includes(explicit[1].toLowerCase()))return `${explicit[1]}/${explicit[2].replace(/[.,;:)]+$/,'')}`;
  return fallback;
}

export function browserRepoSupport(nav=globalThis.navigator||{},runtime=globalThis){
  const ua=String(nav.userAgent||'');
  const chromium=/Chrome|Chromium|Edg\//i.test(ua)&&!/CriOS/i.test(ua);
  const mobile=/iPhone|iPad|iPod|Android|Mobile/i.test(ua);
  const ios=/iPhone|iPad|iPod/i.test(ua),iosVersion=ua.match(/OS (\d+)[._](\d+)/i),iosSupported=ios&&iosVersion&&(Number(iosVersion[1])>16||(Number(iosVersion[1])===16&&Number(iosVersion[2])>=4));
  const androidSupported=/Android/i.test(ua)&&/Chrome|Chromium|Firefox|FxiOS/i.test(ua);
  const safariVersion=ua.match(/Version\/(\d+)\.(\d+)/i),desktopSafari=!mobile&&/Safari/i.test(ua)&&!/Chrome|Chromium|Edg/i.test(ua)&&safariVersion&&(Number(safariVersion[1])>16||(Number(safariVersion[1])===16&&Number(safariVersion[2])>=4));
  const firefox=!mobile&&/Firefox\/(\d+)/i.test(ua),browserSupported=chromium||iosSupported||androidSupported||desktopSafari||firefox;
  const isolationReady=runtime?.crossOriginIsolated===true&&typeof runtime?.SharedArrayBuffer==='function';
  const supported=Boolean(browserSupported&&(!runtime?.document||isolationReady));
  const reason=!browserSupported?'This browser does not meet the WebContainer runtime requirements. Use Safari 16.4+, recent Android Chrome/Firefox, or a current desktop browser.':runtime?.document&&!isolationReady?'Secure browser isolation is unavailable. Reload once; if it remains unavailable, check private-browsing or content-blocking settings.':'';
  return {supported,chromium,mobile,mobileBeta:mobile&&Boolean(browserSupported),isolationReady,reason};
}

function fileRank(file){
  const p=file.path;
  if(p==='package.json'||LOCK_FILE.test(p))return 0;
  if(/(^|\/)(test|tests|__tests__|spec|specs)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/i.test(p))return 1;
  if(/(^|\/)src\//i.test(p))return 2;
  if(/\.(m?[jt]sx?|json|md|css|html|ya?ml)$/i.test(p))return 3;
  return 4;
}

export function selectRepoFiles(tree=[]){
  const candidates=tree.filter(x=>x.type==='blob'&&!SKIP_PATH.test(x.path)&&!SKIP_EXT.test(x.path));
  candidates.sort((a,b)=>fileRank(a)-fileRank(b)||(a.size||0)-(b.size||0));
  let bytes=0;const selected=[];
  for(const f of candidates){
    const limit=LOCK_FILE.test(f.path)?MAX_LOCK_BYTES:MAX_FILE_BYTES;
    if((f.size||0)>limit)continue;
    if(selected.length>=MAX_FILES||bytes+(f.size||0)>MAX_TOTAL_BYTES)break;
    selected.push(f);bytes+=f.size||0;
  }
  return{selected,bytes};
}

async function fetchJson(url){const r=await fetch(url,{headers:{accept:'application/vnd.github+json'}});if(!r.ok)throw new Error(`GitHub request failed (${r.status}) for ${url}`);return r.json()}
export async function inspectPublicRepo(repo,progress=()=>{}){
  progress(`Inspecting public repo ${repo}…`);
  const meta=await fetchJson(`https://api.github.com/repos/${repo}`);
  if(meta.private)throw new Error('This browser path supports public repositories without login. Connect GitHub for private repositories.');
  const branch=meta.default_branch||'main';
  const commit=await fetchJson(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(branch)}`),sha=commit.sha;
  const tree=await fetchJson(`https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(sha)}?recursive=1`);
  if(tree.truncated)throw new Error('Repository tree is too large for the zero-install browser lane. Use the hosted execution lane for large repos.');
  const{selected,bytes}=selectRepoFiles(tree.tree||[]);
  progress(`Importing ${selected.length} source files (${Math.round(bytes/1024)} KB) from ${sha.slice(0,8)}…`);
  const rows=[];let index=0;
  const worker=async()=>{while(index<selected.length){const f=selected[index++],raw=`https://raw.githubusercontent.com/${repo}/${sha}/${f.path.split('/').map(encodeURIComponent).join('/')}`;const r=await fetch(raw);if(!r.ok)continue;const text=await r.text();if(/\u0000/.test(text))continue;rows.push({path:f.path,text})}};
  await Promise.all(Array.from({length:Math.min(8,selected.length)},worker));
  return{repo,branch,sha,meta:{name:meta.name,fullName:meta.full_name,htmlUrl:meta.html_url},files:rows};
}

function toMountTree(files){const root={};for(const {path,text} of files){const parts=path.split('/');let node=root;for(let i=0;i<parts.length-1;i++)node=node[parts[i]]||(node[parts[i]]={directory:{}}),node=node.directory;node[parts.at(-1)]={file:{contents:text}}}return root}
async function bootWebContainer(progress=()=>{}){progress('Booting fresh zero-install Node sandbox…');const{WebContainer}=await import(WC_CDN);return WebContainer.boot({coep:'require-corp',workdirName:'xrai-workspace'})}

async function runProcess(wc,cmd,args=[],progress=()=>{},timeoutMs=VERIFY_TIMEOUT_MS,cwd){
  progress(`$ ${cmd} ${args.join(' ')}`.trim());const p=await wc.spawn(cmd,args,cwd?{cwd}:undefined);let out='',timedOut=false;
  const reader=p.output.getReader();const pump=(async()=>{while(true){const{value,done}=await reader.read();if(done)break;out+=value;const line=String(value).trim();if(line)progress(line.slice(-500));if(out.length>100_000)out=out.slice(-100_000)}})();
  let timer;const timeout=new Promise(resolve=>{timer=setTimeout(()=>{timedOut=true;try{p.kill()}catch{}resolve(124)},timeoutMs)});
  const code=await Promise.race([p.exit,timeout]);clearTimeout(timer);await pump.catch(()=>{});
  if(timedOut)out+=`\nXRAI: command timed out after ${Math.round(timeoutMs/1000)}s.`;
  return{code,timedOut,output:out};
}
function packageJson(files){try{return JSON.parse(files.find(f=>f.path==='package.json')?.text||'{}')}catch{return{}}}
function scriptsFrom(files){return packageJson(files).scripts||{}}
function installCommand(files){
  const pm=String(packageJson(files).packageManager||'').split('@')[0];
  if(pm==='pnpm'||files.some(f=>f.path==='pnpm-lock.yaml'))return['pnpm',['install','--frozen-lockfile']];
  if(pm==='yarn'||files.some(f=>f.path==='yarn.lock'))return['yarn',['install','--immutable']];
  if(files.some(f=>f.path==='package-lock.json'))return['npm',['ci','--no-audit','--no-fund']];
  return['npm',['install','--no-audit','--no-fund']];
}
function verificationCommands(files){const s=scriptsFrom(files),cmds=[];if(s.test)cmds.push(['npm',['test']]);if(s.check)cmds.push(['npm',['run','check']]);else{if(s.lint)cmds.push(['npm',['run','lint']]);if(s.build)cmds.push(['npm',['run','build']])}return cmds.length?cmds:[['npm',['test']]]}
function filePathHints(output=''){const hits=new Set();for(const m of String(output).matchAll(/(?:^|[\s("'`])((?:\.\.?\/)?[A-Za-z0-9_.@/-]+\.(?:m?[jt]sx?|json|css|html|md))(?::\d+(?::\d+)?)?/gm)){const p=m[1].replace(/^\.\//,'');if(!p.includes('node_modules/'))hits.add(p)}return hits}
export function buildFailureContext(files,evidence=[],limit=46_000){
  const hinted=new Set(evidence.flatMap(x=>[...filePathHints(x.output)]));
  const ranked=files.filter(f=>/\.(m?[jt]sx?|json|md|css|html)$/.test(f.path)&&!/lock\.json$/.test(f.path)).sort((a,b)=>{
    const rank=f=>hinted.has(f.path)?0:(/(^|\/)(test|tests|__tests__|spec|specs)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/i.test(f.path)?1:(f.path==='package.json'?2:(/(^|\/)src\//.test(f.path)?3:4)));
    return rank(a)-rank(b)||(a.path>b.path?1:-1);
  });
  let out='';for(const f of ranked){const chunk=`\n--- ${f.path} ---\n${f.text.slice(0,10_000)}\n`;if(out.length+chunk.length>limit)continue;out+=chunk}return out;
}
function parsePatch(text){const m=String(text).match(/\{[\s\S]*\}/);if(!m)return null;try{const x=JSON.parse(m[0]);if(!Array.isArray(x.edits))x.edits=[];return x}catch{return null}}
async function applyEdits(wc,files,edits,progress=()=>{}){let applied=0;const changed=[];for(const e of edits.slice(0,8)){if(!e?.path||typeof e.search!=='string'||typeof e.replace!=='string'||e.search===e.replace||!e.search||!files.some(f=>f.path===e.path))continue;let cur;try{cur=await wc.fs.readFile(e.path,'utf8')}catch{continue}if(!cur.includes(e.search)||cur.indexOf(e.search)!==cur.lastIndexOf(e.search)){progress(`Skipped ${e.path}: search text not found`);continue}const next=cur.replace(e.search,e.replace);await wc.fs.writeFile(e.path,next);const row=files.find(f=>f.path===e.path);if(row)row.text=next;else files.push({path:e.path,text:next});progress(`Edited ${e.path}`);changed.push({path:e.path,before:cur,after:next});applied++}return{applied,changed}}
function changePreview({path,before,after}){
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

export async function runBrowserRepoTask(task,opts={},emit=()=>{},progress=()=>{}){
  const support=browserRepoSupport();if(!support.supported)throw new Error(support.reason);
  const repo=parseGitHubRepo(task,opts.defaultRepo||DEFAULT_REPO),runId=opts.runId||uid(),event=(type,summary,meta={})=>emit({id:uid(),runId,ts:new Date().toISOString(),type,summary,...meta});
  let wc=null;
  try{
    event('run:start',task,{data:{provider:'browser-webcontainer',repo}});event('tool:start',`Inspecting ${repo}`,{name:'GitHub public repo'});
    const snapshot=await inspectPublicRepo(repo,progress);const original=new Map(snapshot.files.map(f=>[f.path,f.text]));event('tool:done',`Imported ${snapshot.files.length} files from ${repo}@${snapshot.sha.slice(0,8)}`,{name:'GitHub public repo',data:{repo,branch:snapshot.branch,sha:snapshot.sha,fileCount:snapshot.files.length}});
    if(!snapshot.files.some(f=>f.path==='package.json'))throw new Error('The zero-install browser execution lane currently supports Node/JS/TS repositories with a package.json.');
    wc=await bootWebContainer(progress);await wc.mount(toMountTree(snapshot.files));event('tool:start','Installing repository dependencies',{name:'Dependency install'});
    const [im,ia]=installCommand(snapshot.files),installed=await runProcess(wc,im,ia,progress,INSTALL_TIMEOUT_MS);event('tool:done',`Dependency install ${installed.code===0?'PASS':installed.timedOut?'TIMEOUT':'FAIL'} · exit ${installed.code}`,{name:'Dependency install',data:{exitCode:installed.code,timedOut:installed.timedOut}});if(installed.code!==0)throw new Error(`Dependency installation failed.\n${installed.output.slice(-3000)}`);
    const commands=verificationCommands(snapshot.files);let evidence=[];for(const [cmd,args] of commands){event('tool:start',`$ ${cmd} ${args.join(' ')}`,{name:'Test verifier'});const r=await runProcess(wc,cmd,args,progress,VERIFY_TIMEOUT_MS);evidence.push({cmd:[cmd,...args].join(' '),...r});event('tool:done',`${r.code===0?'PASS':r.timedOut?'TIMEOUT':'FAIL'} · ${cmd} ${args.join(' ')}`,{name:'Test verifier',data:{exitCode:r.code,timedOut:r.timedOut}})}
    let failing=evidence.filter(x=>x.code!==0),edits=0,modelName='deterministic verifier',diagnosis='',changes=[];
    const requestedChange=opts.requestedChange??/\b(?:improve|improvements?|implement|install|integrate|refactor|modify|add)\b/i.test(task);
    const baseline=evidence.map(x=>({cmd:x.cmd,exitCode:x.code}));
    if(failing.length||requestedChange){
      const{getLocalModel}=await import('./local-agent.js');const model=await getLocalModel(progress);modelName=model.name;event('agent:start','Diagnosing failing tests from real repository evidence',{agentId:'repo-fixer',name:'Repo fixer'});
      for(let round=1;round<=2&&(failing.length||(requestedChange&&round===1));round++){
        const context=buildFailureContext(snapshot.files,[...failing,{output:task}]),prompt=`TASK:\n${task}\n\nREPO: ${repo}@${snapshot.sha}\n\nREAL BASELINE COMMAND OUTPUT (may be passing; implement requested improvements anyway):\n${evidence.map(x=>`$ ${x.cmd}\n${x.output.slice(-10_000)}`).join('\n\n')}\n\nERROR-DIRECTED FILE CONTEXT:\n${context}\n\nReturn JSON only: {"summary":"short diagnosis grounded in the failures","edits":[{"path":"relative/path","search":"exact existing text","replace":"replacement text"}]}. Make the smallest correct edits. Only edit files shown above. Do not invent files or test results.`;
        const answer=await model.prompt([{role:'system',content:'You are XRAI Repo Fixer. Use only supplied real files and command evidence. Return JSON only. Never claim success until re-verification passes.'},{role:'user',content:prompt}]),patch=parsePatch(answer);if(!patch){diagnosis='The local fixer did not return a valid bounded patch.';break}diagnosis=patch.summary||diagnosis;event('agent:done',patch.summary||`Patch round ${round}`,{agentId:'repo-fixer',name:'Repo fixer'});const applied=await applyEdits(wc,snapshot.files,patch.edits,progress);edits+=applied.applied;changes.push(...applied.changed);if(!applied.applied)break;evidence=[];for(const [cmd,args] of commands){event('tool:start',`Re-verify: $ ${cmd} ${args.join(' ')}`,{name:'Test verifier'});const r=await runProcess(wc,cmd,args,progress,VERIFY_TIMEOUT_MS);evidence.push({cmd:[cmd,...args].join(' '),...r});event('tool:done',`${r.code===0?'PASS':r.timedOut?'TIMEOUT':'FAIL'} · ${cmd} ${args.join(' ')}`,{name:'Test verifier',data:{exitCode:r.code,timedOut:r.timedOut}})}failing=evidence.filter(x=>x.code!==0)
      }
    }
    const finalChanges=[];for(const [path,before] of original){const row=snapshot.files.find(f=>f.path===path);if(row&&row.text!==before)finalChanges.push({path,before,after:row.text})}
    const diff=buildChangeReport(finalChanges),passed=failing.length===0,checks=evidence.map(x=>`${x.code===0?'PASS':x.timedOut?'TIMEOUT':'FAIL'} ${x.cmd}`).join(' · '),why=diagnosis?` ${diagnosis.trim()}`:'';
    const summary=`${repo}@${snapshot.sha.slice(0,8)}: ${passed?(requestedChange&&!finalChanges.length?'checks passed; requested changes incomplete':'verified successfully'):'verification still failing'}. ${checks}.${why}${edits?` ${finalChanges.length} file${finalChanges.length===1?'':'s'} changed in the browser sandbox.`:(requestedChange?' No requested code improvement was implemented; the task is incomplete.':edits?' No net code changes were retained.':' No code edits were necessary.')}`;
    if(passed&&finalChanges.length)event('improvement:verified','Sandbox patch verified; not deployed',{data:{scope:'sandbox',repo,sha:snapshot.sha,changedFiles:finalChanges.map(x=>x.path),baseline,commands:evidence.map(x=>({cmd:x.cmd,exitCode:x.code}))}});
    event('eval',`${passed?'Verified':'Not verified'} from real command exit codes`,{name:'Evidence gate',data:{score:passed?1:0,commands:evidence.map(x=>({cmd:x.cmd,exitCode:x.code,timedOut:x.timedOut}))}});event('run:done',summary,{data:{score:passed?1:0,attempts:edits?2:1,provider:`WebContainer + ${modelName}`,learning:'evidence',status:!passed||(requestedChange&&!finalChanges.length)?'incomplete':'completed',sha:snapshot.sha,changedFiles:finalChanges.map(x=>x.path)}});
    return{runId,status:!passed||(requestedChange&&!finalChanges.length)?'incomplete':'completed',output:summary,score:passed?1:0,attempts:edits?2:1,provider:`WebContainer + ${modelName}`,learning:{status:passed?'verified':'rejected'},evidence,repo,branch:snapshot.branch,sha:snapshot.sha,edits:finalChanges.length,diff,changedFiles:finalChanges.map(x=>x.path)};
  }finally{
    if(wc)try{wc.teardown()}catch{}
  }
}
