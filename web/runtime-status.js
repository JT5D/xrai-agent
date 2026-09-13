// Read-only runtime introspection. Model prose and scores are never test evidence.
export function isRuntimeStatusQuestion(task=''){
  const text=String(task).trim();
  if(/(?:[?!.]|\bthen\b|\bif not\b)\s*,?\s*(?:please\s+)?(?:fix|repair|run|execute|implement|verify)\b/i.test(text))return false;
  return /^(?:are|is|was|were)\s+(?:we|you|it|this|that|everything|(?:the |our )?(?:app|agent|system|runtime|tests?)|xrai(?: agent)?)\b[\s\S]*\b(?:fixed|working|ready|passing|verified|done|finished|healthy|operational)\b/i.test(text)
    ||/^(?:did|have|has)\s+(?:we|you|it|this|that|xrai)\b[\s\S]*\b(?:work|worked|fix|fixed|pass|passed|finish|finished|verify|verified)\b/i.test(text)
    ||/^(?:what(?:'s| is)|show|check|report)\s+(?:me\s+)?(?:our|your|the|xrai(?: agent)?)\s+(?:current\s+)?(?:status|progress|test results|verification results)\b/i.test(text);
}
const decode=value=>{if(typeof value!=='string')return value;try{return JSON.parse(value)}catch{return null}};
function commands(value){
  if(!Array.isArray(value)||!value.length)return [];
  return value.slice(0,10).map(raw=>{
    const row=decode(raw)||{},code=row.exitCode??row.code;
    return {cmd:String(row.cmd||'unknown command').slice(0,300),code:Number.isInteger(code)?code:null,timedOut:row.timedOut===true};
  });
}
export function latestRepoEvidence(state={},repo=state.context?.repo||'JT5D/xrai-agent'){
  const events=Array.isArray(state.events)?state.events:[];
  const imported=[...events].reverse().find(e=>e.type==='tool:done'&&e.name==='GitHub public repo'&&e.data?.repo===repo&&/^[a-f0-9]{40}$/i.test(e.data?.sha||''));
  if(!imported)return null;
  const rows=events.filter(e=>e.runId===imported.runId);
  const evaluation=[...rows].reverse().find(e=>e.type==='eval'&&Array.isArray(e.data?.commands));
  const done=[...rows].reverse().find(e=>e.type==='run:done');
  const changed=done?.data?.changedFiles;
  return {repo,sha:imported.data.sha,runId:imported.runId,ts:done?.ts||imported.ts,commands:commands(evaluation?.data?.commands),finished:Boolean(done),status:done?.data?.status||null,changedFiles:Array.isArray(changed)?changed:null};
}
async function readJson(fetchFn,url,timeoutMs){
  const controller=new AbortController();let timer;
  try{
    return await Promise.race([(async()=>{
      const response=await fetchFn(url,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      return response.json();
    })(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('request timed out'))},timeoutMs)})]);
  }finally{clearTimeout(timer)}
}
export async function inspectRuntimeStatus({state={},fetchFn=globalThis.fetch,tabVersion=null,timeoutMs=2500}={}){
  tabVersion??=[...(globalThis.document?.querySelectorAll('dt')||[])].find(el=>el.textContent==='Version')?.nextElementSibling?.textContent?.trim()||'unknown';
  const evidence=latestRepoEvidence(state),lines=[`This tab: XRAI ${tabVersion}.`];
  let verified=false,unresolved=false,build=null,jobs=[];
  if(evidence){
    lines.push(`Latest recorded repository run: ${evidence.repo}@${evidence.sha.slice(0,8)} (${String(evidence.ts||'time unknown')}).`);
    for(const row of evidence.commands)lines.push(`${row.timedOut?'TIMEOUT':row.code===0?'PASS':row.code===null?'UNVERIFIED':'FAIL'} ${row.cmd}${row.code===null?'':` (exit ${row.code})`}`);
    verified=evidence.finished&&evidence.commands.length>0&&evidence.commands.every(c=>c.code===0&&!c.timedOut);
    unresolved=!verified||evidence.status==='incomplete';
    if(!evidence.commands.length)lines.push('No completed verification commands were recorded for this run.');
    if(evidence.changedFiles?.length)lines.push(`Sandbox edits: ${evidence.changedFiles.join(', ')}. They were not committed or deployed by this run.`);
    else if(evidence.changedFiles)lines.push('No code edits were recorded. Passing checks are not proof that requested improvements were implemented.');
  }else lines.push('No repository verification is recorded in this chat. I will check the deployed build instead of guessing.');
  try{
    build=await readJson(fetchFn,'./build-info.json',timeoutMs);
    if(build?.repo!=='JT5D/xrai-agent'||!/^[a-f0-9]{40}$/i.test(build.sha||'')||!Number.isSafeInteger(build.runId)||build.runId<1)throw new Error('build provenance unavailable');
    lines.push(`Deployed build: ${build.version}@${build.sha.slice(0,8)}.`);
    if(build.version!==tabVersion){unresolved=true;lines.push('This tab does not match the deployed version. Reload to use the current build.');}
    const report=await readJson(fetchFn,`https://api.github.com/repos/JT5D/xrai-agent/actions/runs/${build.runId}/jobs?per_page=100`,timeoutMs);
    jobs=(report.jobs||[]).filter(j=>j.head_sha===build.sha&&j.run_id===build.runId&&(j.name==='deploy'||/^live-e2e \(/.test(j.name)));
    if(!jobs.length)throw new Error('no matching deployment checks returned');
    for(const job of jobs)lines.push(`${job.status==='completed'?(job.conclusion||'unknown').toUpperCase():job.status.toUpperCase()} ${job.name}`);
    const required=['deploy','conversation','chat-retry','mobile-chat','mobile-repo','model-runtime','web','repo'];
    const complete=required.every(name=>jobs.some(j=>j.name===(name==='deploy'?name:`live-e2e (${name})`)&&j.status==='completed'&&j.conclusion==='success'));
    if(complete&&build.version===tabVersion)verified=true;else unresolved=true;
    lines.push(`Deployment evidence: https://github.com/JT5D/xrai-agent/actions/runs/${build.runId}`);
  }catch(error){unresolved=true;lines.push(`Deployment checks unavailable: ${error.message}. Unavailable is not a pass.`);}
  const headline=verified&&!unresolved?'The recorded checks passed, but this is not a blanket all-clear.':'Not a verified all-clear yet.';
  lines.push('These results cover only the listed checks. Mobile-width Chromium is not an actual iPhone/Safari test. This status request inspected evidence; it did not run tests, edit code, or install improvements.');
  return {status:verified&&!unresolved?'completed':'incomplete',output:[headline,'',...lines].join('\n'),provider:'runtime-evidence',score:null,attempts:1,learning:{status:'none'},inspection:{build,jobs:jobs.map(j=>({name:j.name,status:j.status,conclusion:j.conclusion})),repository:evidence}};
}
