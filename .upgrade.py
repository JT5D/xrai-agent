from pathlib import Path
p=Path('web/browser-workspace.js')
s=p.read_text();s="import { repairWorkspace,unifiedPatch } from './verified-repair.js';\nimport { searchWeb,formatWebResults } from './web-search.js';\n"+s
s=s.replace("const r=await fetch(url,{headers:{accept:'application/vnd.github+json'}})","const r=await fetch(url,{headers:{accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)})")
s=s.replace("const r=await fetch(raw);if(!r.ok)continue;","const r=await fetch(raw,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`Source import failed: ${f.path} (${r.status})`);")
s=s.replace("clearTimeout(timer);await pump.catch(()=>{});","clearTimeout(timer);if(timedOut)try{await reader.cancel()}catch{};await Promise.race([pump.catch(()=>{}),new Promise(r=>setTimeout(r,500))]);")
start=s.index('function parsePatch(text)');end=s.index('function changePreview(',start);s=s[:start]+s[end:]
start=s.index('export async function runBrowserRepoTask')
s=s[:start]+'''export async function runBrowserRepoTask(task,opts={},emit=()=>{},progress=()=>{}){
  const support=browserRepoSupport();if(!support.supported)throw new Error(support.reason);
  const repo=parseGitHubRepo(task,opts.defaultRepo||DEFAULT_REPO),runId=opts.runId||uid();
  const event=(type,summary,meta={})=>emit({id:uid(),runId,ts:new Date().toISOString(),type,summary,...meta});
  let wc;
  try{
    event('run:start',task,{data:{provider:'browser-webcontainer',repo}});
    const snapshot=await inspectPublicRepo(repo,progress);
    event('tool:done',`Imported ${snapshot.files.length} real files from ${repo}@${snapshot.sha.slice(0,8)}`,{name:'GitHub public repo',data:{repo,sha:snapshot.sha,fileCount:snapshot.files.length}});
    if(!snapshot.files.some(f=>f.path==='package.json'))throw new Error('The browser lane requires a Node/JS/TS repository with package.json.');
    wc=await bootWebContainer(progress);await wc.mount(toMountTree(snapshot.files));
    const [im,ia]=installCommand(snapshot.files),installed=await runProcess(wc,im,ia,progress,INSTALL_TIMEOUT_MS);
    if(installed.code!==0)throw new Error(`Dependency installation failed.\\n${installed.output.slice(-3000)}`);
    const commands=verificationCommands(snapshot.files),baseline=[];
    for(const [cmd,args] of commands){event('tool:start',`$ ${cmd} ${args.join(' ')}`,{name:'Test verifier'});const r=await runProcess(wc,cmd,args,progress);baseline.push({cmd:[cmd,...args].join(' '),...r});event('tool:done',`${r.code===0?'PASS':'FAIL'} ${cmd} ${args.join(' ')}`,{name:'Test verifier',data:{exitCode:r.code,timedOut:r.timedOut}})}
    const requestedChange=opts.requestedChange??/\\b(?:improve|improvements?|implement|install|integrate|refactor|modify|add)\\b/i.test(task);
    const result=await repairWorkspace({task,repo,sha:snapshot.sha,files:snapshot.files,baseline,commands,requestedChange,event,
      getModel:async()=>{const{getLocalModel}=await import('./local-agent.js');return getLocalModel(progress,{purpose:'code'})},
      host:{run:(cmd,args)=>runProcess(wc,cmd,args,progress),
        write:async(path,text)=>{const parent=path.slice(0,path.lastIndexOf('/'));if(path.includes('/'))await wc.fs.mkdir(parent,{recursive:true});await wc.fs.writeFile(path,text)},
        remove:path=>wc.fs.rm(path),search:async query=>formatWebResults(await searchWeb(query))}
    });
    const {evidence,changes,learning,improved,modelName,diagnosis,completed}=result;
    const checks=evidence.map(x=>`${x.code===0?'PASS':x.timedOut?'TIMEOUT':'FAIL'} ${x.cmd}`).join(' · ');
    const diff=unifiedPatch(changes),changedFiles=changes.map(c=>c.path);
    const summary=`${repo}@${snapshot.sha.slice(0,8)}: ${completed?'verified successfully':'incomplete'}. ${checks}. ${changes.length?`${changes.length} sandbox file(s) changed; not committed or deployed.`:requestedChange?'No verified requested improvement was retained.':'No code edits were necessary.'} ${diagnosis}\\nLearning: ${learning.status}${learning.id?` (${learning.id})`:''}.`;
    if(improved)event('improvement:verified','Failing-to-passing sandbox patch; not deployed',{data:{scope:'sandbox',repo,sha:snapshot.sha,changedFiles,baseline:baseline.map(x=>({cmd:x.cmd,exitCode:x.code})),commands:evidence.map(x=>({cmd:x.cmd,exitCode:x.code})),regression:result.regression}});
    event('run:done',summary,{data:{score:completed?1:0,provider:`WebContainer + ${modelName}`,learning:learning.status,sha:snapshot.sha,changedFiles}});
    return{runId,status:completed?'completed':'incomplete',output:summary,score:completed?1:0,attempts:result.steps||1,provider:`WebContainer + ${modelName}`,learning,evidence,repo,branch:snapshot.branch,sha:snapshot.sha,diff,changedFiles,edits:changes.length};
  }finally{if(wc)try{wc.teardown()}catch{}}
}
'''
p.write_text(s)
p=Path('web/local-agent.js');s=p.read_text()
s=s.replace('let modelPromise,knowledgePromise;','let modelPromise,codeModelPromise,knowledgePromise;')
s=s.replace('async function transformersModel(onProgress){const preferred=await resolveBrowserModelProfile(navigator,true)',"async function transformersModel(onProgress,purpose='chat'){const preferred=await resolveBrowserModelProfile(navigator,purpose!=='code')")
s=s.replace('max_new_tokens:profile.maxNewTokens',"max_new_tokens:purpose==='code'?1400:profile.maxNewTokens")
s=s.replace('export async function getLocalModel(onProgress=()=>{}){',"export async function getLocalModel(onProgress=()=>{},{purpose='chat'}={}){if(purpose==='code'){if(!codeModelPromise)codeModelPromise=(async()=>{try{const m=await chromeModel(onProgress);if(m)return m}catch{}return transformersModel(onProgress,'code')})().catch(error=>{codeModelPromise=null;throw error});return codeModelPromise}")
s=s.replace('evidenceGate=state.supports.length>=m.supportNeeded&&avg>=m.directPromoteScore','evidenceGate=false /* Model scores are not execution receipts. */')
s=s.replace('Browser mode cannot execute a workspace verifier; another distinct successful observation may promote this skill.','Reasoning-only candidate; promotion requires a real execution receipt.')
p.write_text(s)
p=Path('web/capability-tools.js');s=p.read_text();s="import { formatLearningSummary } from './verified-repair.js';\n"+s
s=s.replace("return formatVerifiedImprovementReport(verifiedImprovementsForRun(loadUiState(storage)),10);","return formatVerifiedImprovementReport(verifiedImprovementsForRun(loadUiState(storage)),10)+'\\n\\n'+formatLearningSummary(storage);")
s=s.replace("['Bounded repair + patch','Makes constrained sandbox edits, re-verifies, and produces a downloadable patch.'],","['Execution tools','Read/search repository files, research the web, edit/create source files, add a failing regression test, run verifiers, and produce an applicable patch.'],")
s=s.replace("['Evidence-gated learning','Candidate skills require concrete evidence or repeated independent successful support; bad versions can roll back.'],","['Verified procedural learning','Retains actual failing-to-passing repairs in this browser; replays only exact matching source snapshots, tests every reuse, and quarantines failed replays. No model-score promotion.'],")
p.write_text(s)
p=Path('web/app.js');s=p.read_text();s="import { learningSummary } from './verified-repair.js';\n"+s
s=s.replace("  box.innerHTML='<div class=\"runtime-grid\"><article><strong>Browser-local learning</strong><p>Promoted skills live in browser storage and are retrieved only after evidence gates pass.</p></article><article><strong>Fail closed</strong><p>Low-confidence candidates stay quarantined; they do not automatically become memory.</p></article></div>';", "  const learned=learningSummary();box.innerHTML=`<div class=\"runtime-grid\"><article><strong>${learned.retained} verified procedures</strong><p>Retained in this browser after a real failing-to-passing repair.</p></article><article><strong>${learned.reuses} verified reuses</strong><p>Exact matching source only; every reuse is tested again.</p></article><article><strong>${learned.quarantined} quarantined</strong><p>Failed replays are rolled back. No automatic production deployment.</p></article></div>`;")
s=s.replace("updatePatchButton();setRunStatus(","updatePatchButton();renderSkills();setRunStatus(")
s=s.replace("URL.revokeObjectURL(url);setTimeout(()=>URL.revokeObjectURL(url),1000)","setTimeout(()=>URL.revokeObjectURL(url),1000)")
s=s.replace('let pollingRunId=null;',"let pollingRunId=null;\nlet livePatch=null;\nconst patchText=()=>livePatch?.runId===ui.result?.runId?livePatch.diff:(ui.result?.diff||'');")
s=s.replace('button.hidden=!ui.result?.diff;','button.hidden=!patchText();')
s=s.replace('function applyResult(result,runId=ui.activeRunId){',"function applyResult(result,runId=ui.activeRunId){\n  livePatch={runId,diff:result.diff||''};")
s=s.replace('if(!ui.result?.diff)return;const blob=new Blob([ui.result.diff]','if(!patchText())return;const blob=new Blob([patchText()]')
p.write_text(s)
p=Path('web/state.js');s=p.read_text().replace('diff:cut(result.diff,50000)',"diff:String(result.diff??'').length>50000?'':cut(result.diff,50000)");p.write_text(s)
p=Path('package.json');p.write_text(p.read_text().replace('0.3.47','0.3.48'))
p=Path('README.md');p.write_text(p.read_text()+'''\n## Verified repair learning\n\nBrowser repository tasks have file read/search, web research, bounded source edits/new files, baseline-failing regression tests, and real verifier commands. Existing tests and verifier configuration cannot be edited by this loop. Passing unchanged tests never count as improvement; failed candidates roll back. Exact-source repair procedures are retained in this browser only after failing-to-passing verification. Replay bypasses the model but reruns verification; a failed replay is quarantined. Memory is browser-local, not model training or deployment. The code model has a larger output budget, but a weak model can still fail to produce a fix.\n\n`npm run check` covers real Node subprocess repair/reuse/rollback cases. `test/learning.e2e.mjs` exercises real WebContainer commands and browser persistence with a scripted model and repository fixture. These tests do not establish live model quality.\n''')
