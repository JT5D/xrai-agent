import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const STOP=new Set('the a an and or to of in on for with is are be as at by from it this that use uses using'.split(' '));
const DEFAULT_META={
  version:2,
  lastRunCount:0,
  minScore:.82,
  maintenanceEvery:10,
  retrieval:{relevance:.65,confidence:.15,utility:.15,recency:.05},
  guidance:[
    'Create narrow reusable skills, not task transcripts.',
    'Treat model scores as advisory only; they are never promotion evidence.',
    'Require a concrete source-task verifier before a candidate can enter transfer evaluation.',
    'Promote only after verified reuse on a different related task objectively beats a no-candidate baseline.',
    'Treat retrieved skills as hypotheses; independent evidence outranks memory.'
  ]
};

const tokens=s=>[...new Set((String(s).toLowerCase().match(/[a-z0-9_+-]{2,}/g)||[]).filter(x=>!STOP.has(x)))];
const clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
const mean=xs=>Array.isArray(xs)&&xs.length?xs.reduce((a,b)=>a+clamp(b),0)/xs.length:null;
const now=()=>new Date().toISOString();
const hash=s=>createHash('sha256').update(String(s)).digest('hex').slice(0,16);
const taskFingerprint=task=>hash(tokens(task).sort().join(' '));
const sensitive=s=>/(-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:api[_ -]?key|password|secret|token)\s*[:=]\s*[^\s,;]{6,}|\bsk-[a-z0-9_-]{12,}|\bgh[pousr]_[a-z0-9]{12,}|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i.test(String(s));
const skillText=s=>`${s.title||''}\n${s.trigger||''}\n${s.procedure||''}\n${s.verifier||''}\n${(s.tags||[]).join(' ')}`;
const jaccard=(a,b)=>{const A=new Set(tokens(a)),B=new Set(tokens(b));if(!A.size||!B.size)return 0;let i=0;for(const x of A)if(B.has(x))i++;return i/(A.size+B.size-i)};
const lexical=(query,text)=>{const q=tokens(query),c=new Set(tokens(text));if(!q.length)return 0;return q.filter(t=>c.has(t)).length/q.length};
const daysOld=ts=>Math.max(0,(Date.now()-new Date(ts||0).getTime())/86400000);
const ledgerPath=root=>path.join(path.resolve(root),'.xrai','skills.jsonl');

async function append(root,event){const file=ledgerPath(root);await fs.mkdir(path.dirname(file),{recursive:true});await fs.appendFile(file,JSON.stringify({...event,ts:event.ts||now()})+'\n');}
async function events(root){try{return (await fs.readFile(ledgerPath(root),'utf8')).split('\n').filter(Boolean).map(line=>{try{return JSON.parse(line)}catch{return null}}).filter(Boolean)}catch{return[]}}

function versionKey(id,version){return `${id}@${version}`}
function reduce(rows){
  const versions=new Map(),meta={...DEFAULT_META,guidance:[...DEFAULT_META.guidance],retrieval:{...DEFAULT_META.retrieval}};let runCount=0;
  for(const e of rows){
    if(e.type==='meta:update')Object.assign(meta,e.meta||{}, {guidance:[...(e.meta?.guidance||meta.guidance)],retrieval:{...meta.retrieval,...(e.meta?.retrieval||{})}});
    if(e.type==='run:outcome'){if(e.verified===true)runCount++;continue}
    if(!e.id||!e.version)continue;
    const key=versionKey(e.id,e.version);let s=versions.get(key);
    if(e.type==='skill:proposed'){
      s={...e.skill,id:e.id,version:e.version,status:'candidate',createdAt:e.ts,updatedAt:e.ts,sourceTaskFingerprint:e.taskFingerprint||null,supports:new Set([e.taskFingerprint].filter(Boolean)),scores:[clamp(e.score)],usageScores:[],uses:0,successes:0,failures:0,lastUsedAt:null,verification:null,transfers:[],transferVerified:false};
      versions.set(key,s);continue;
    }
    if(!s)continue;s.updatedAt=e.ts||s.updatedAt;
    if(e.type==='skill:supported'){
      if(e.taskFingerprint)s.supports.add(e.taskFingerprint);
      if(Number.isFinite(Number(e.score)))s.scores.push(clamp(e.score));
    }else if(e.type==='skill:verified'){
      s.verification={ok:true,command:e.command,summary:e.summary||'Verifier passed',ts:e.ts};
    }else if(e.type==='skill:verification_failed'){
      s.verification={ok:false,command:e.command,summary:e.summary||'Verifier failed',ts:e.ts};
    }else if(e.type==='skill:transfer_verified'){
      s.transferVerified=true;
      s.transfers.push({taskFingerprint:e.taskFingerprint,baseline:e.baseline,withSkill:e.withSkill,command:e.command,summary:e.summary,ts:e.ts});
    }else if(e.type==='skill:promoted'){
      s.status='promoted';s.promotedAt=e.ts;s.confidence=clamp(e.confidence||.9);
      // Legacy promotion events did not prove held-out transfer. They remain quarantined.
      if(e.transferVerified===true)s.transferVerified=true;
    }else if(e.type==='skill:superseded')s.status='superseded';
    else if(e.type==='skill:rejected')s.status='rejected';
    else if(e.type==='skill:retired')s.status='retired';
    else if(e.type==='skill:rollback')s.status=e.restore?'promoted':'rolled_back';
    else if(e.type==='skill:used'){
      if(e.verified!==true)continue;
      s.uses++;
      if(e.success)s.successes++;else s.failures++;
      if(Number.isFinite(Number(e.score)))s.usageScores.push(clamp(e.score));
      s.lastUsedAt=e.ts;
    }
  }
  return {rows,versions,meta,runCount};
}

export async function loadSkillStore(root){return reduce(await events(root))}
export async function getMetaPolicy(root){return (await loadSkillStore(root)).meta}

export function normalizeSkillCandidate(candidate={}){
  const title=String(candidate.title||'').trim().slice(0,120),trigger=String(candidate.trigger||'').trim().slice(0,500),procedure=String(candidate.procedure||'').trim().slice(0,1600),verifier=String(candidate.verifier||'').trim().slice(0,300),tags=[...new Set((Array.isArray(candidate.tags)?candidate.tags:[]).map(x=>String(x).trim().toLowerCase()).filter(Boolean))].slice(0,8);
  if(!title||!trigger||!procedure||sensitive(`${title}\n${trigger}\n${procedure}\n${verifier}`))return null;
  return{title,trigger,procedure,verifier,tags};
}

export function isSafeVerifier(command){
  const raw=String(command||'').trim();if(!raw||raw.length>300)return false;
  const scrub=raw.replace(/&&/g,'');if(/[;|><`$]/.test(scrub))return false;
  const parts=raw.split(/&&/).map(x=>x.trim()).filter(Boolean);if(!parts.length||parts.length>4)return false;
  const patterns=[
    /^(npm|pnpm|yarn|bun)\s+(test|check|lint|build|typecheck)(\b|\s)/i,
    /^(npm|pnpm|yarn|bun)\s+run\s+(test|check|lint|build|typecheck)(\b|\s)/i,
    /^node\s+--test(\b|\s)/i,/^npx\s+(tsc\s+--noEmit|eslint\b)/i,
    /^(pytest|python(?:3)?\s+-m\s+pytest)(\b|\s)/i,/^go\s+test(\b|\s)/i,/^cargo\s+test(\b|\s)/i,
    /^dotnet\s+test(\b|\s)/i,/^(mvn|gradle|\.\/gradlew)\s+(test|check|build)(\b|\s)/i,
    /^make\s+(test|check|lint|build)(\b|\s)/i
  ];
  return parts.every(p=>patterns.some(r=>r.test(p)));
}

function allSkills(store){return [...store.versions.values()]}
function activeSkills(store){return allSkills(store).filter(s=>s.status==='promoted'&&s.transferVerified===true)}
function currentForId(store,id){return allSkills(store).filter(s=>s.id===id).sort((a,b)=>b.version-a.version)[0]}
function priorPromoted(store,id,version){return allSkills(store).filter(s=>s.id===id&&s.version<version&&s.transferVerified===true&&['promoted','superseded'].includes(s.status)).sort((a,b)=>b.version-a.version)[0]}
function skillQuality(skill){if(!skill)return null;const usage=mean(skill.usageScores);return usage===null?null:usage}
function similar(store,candidate){return allSkills(store).map(s=>({s,sim:jaccard(`${s.title} ${s.trigger} ${(s.tags||[]).join(' ')}`,`${candidate.title} ${candidate.trigger} ${(candidate.tags||[]).join(' ')}`),proc:jaccard(s.procedure,candidate.procedure)})).sort((a,b)=>b.sim-a.sim)[0]}

export async function retrieveSkills(root,query,limit=4){
  const store=await loadSkillStore(root),w=store.meta.retrieval||DEFAULT_META.retrieval,hits=[];
  for(const s of activeSkills(store)){
    const relevance=lexical(query,skillText(s));if(!relevance)continue;
    const utility=s.uses?((s.successes+1)/(s.uses+2)):.67,confidence=clamp((s.confidence||.9)*.65+utility*.35),recency=1/(1+daysOld(s.lastUsedAt||s.promotedAt||s.updatedAt)/30),score=relevance*w.relevance+confidence*w.confidence+utility*w.utility+recency*w.recency;
    hits.push({...s,supports:[...s.supports],score,utility,confidence});
  }
  return hits.sort((a,b)=>b.score-a.score).slice(0,limit);
}

export function formatSkills(skills=[]){if(!skills.length)return 'No transfer-verified skills matched this task.';return skills.map((s,i)=>`[${i+1}] ${s.title} (${s.id}@v${s.version}, confidence ${Math.round(s.confidence*100)}%)\nWHEN: ${s.trigger}\nDO: ${s.procedure}${s.verifier?`\nVERIFY: ${s.verifier}`:''}`).join('\n\n')}

export async function observeSkillCandidate(root,candidateInput,{task,score,verify}={}){
  const candidate=normalizeSkillCandidate(candidateInput),meta=await getMetaPolicy(root);
  if(!candidate||clamp(score)<meta.minScore)return{status:'ignored',reason:'No reusable candidate or advisory score below candidate threshold.'};
  let store=await loadSkillStore(root),match=similar(store,candidate),id,version,state;
  if(match?.sim>=.58){
    id=match.s.id;const latest=currentForId(store,id),latestProc=latest?jaccard(latest.procedure,candidate.procedure):0;
    if(latest?.status==='candidate'&&latestProc>=.7){
      version=latest.version;state=latest;await append(root,{type:'skill:supported',id,version,taskFingerprint:taskFingerprint(task),score});
    }else if(latest?.status==='promoted'&&latest.transferVerified===true&&latestProc>=.82){
      await append(root,{type:'skill:supported',id,version:latest.version,taskFingerprint:taskFingerprint(task),score});
      return{status:'existing',id,version:latest.version,skill:latest,reason:'Existing transfer-verified skill already covers this candidate.'};
    }else{
      version=(latest?.version||0)+1;await append(root,{type:'skill:proposed',id,version,skill:candidate,taskFingerprint:taskFingerprint(task),score});
    }
  }else{
    id=`skill-${hash(`${candidate.title}|${candidate.trigger}|${candidate.tags.join(',')}`)}`;version=1;await append(root,{type:'skill:proposed',id,version,skill:candidate,taskFingerprint:taskFingerprint(task),score});
  }
  store=await loadSkillStore(root);state=store.versions.get(versionKey(id,version));

  if(candidate.verifier&&isSafeVerifier(candidate.verifier)&&verify){
    try{
      const out=await verify(candidate.verifier),summary=String(out||'Verifier passed').slice(-1000);
      await append(root,{type:'skill:verified',id,version,command:candidate.verifier,summary});
      store=await loadSkillStore(root);state=store.versions.get(versionKey(id,version));
      return{status:'candidate',id,version,skill:state,verified:true,sourceVerified:true,supportCount:state.supports.size,reason:'Source-task verifier passed; held-out transfer on a different related task is still required before promotion.'};
    }catch(e){
      const summary=e instanceof Error?e.message:String(e);
      await append(root,{type:'skill:verification_failed',id,version,command:candidate.verifier,summary});
      await append(root,{type:'skill:rejected',id,version,reason:'Concrete source-task verifier failed.'});
      return{status:'rejected',id,version,skill:state,reason:'Concrete source-task verifier failed.',verification:summary};
    }
  }
  store=await loadSkillStore(root);state=store.versions.get(versionKey(id,version));
  return{status:'candidate',id,version,skill:state,verified:false,sourceVerified:false,supportCount:state?.supports?.size||0,reason:candidate.verifier&&!isSafeVerifier(candidate.verifier)?'Verifier was not safe to execute automatically; candidate remains quarantined.':'Candidate retained as a hypothesis; model scores and repeated proposals cannot promote it.'};
}

function normalizeComparison(x){
  if(!x||typeof x!=='object'||typeof x.passed!=='boolean')return null;
  const out={passed:x.passed};
  if(Number.isFinite(Number(x.attempts))&&Number(x.attempts)>0)out.attempts=Number(x.attempts);
  if(Number.isFinite(Number(x.durationMs))&&Number(x.durationMs)>=0)out.durationMs=Number(x.durationMs);
  if(Number.isFinite(Number(x.failures))&&Number(x.failures)>=0)out.failures=Number(x.failures);
  return out;
}
function objectivelyBetter(baseline,withSkill){
  if(!withSkill?.passed)return false;
  if(!baseline?.passed)return true;
  if(Number.isFinite(baseline.attempts)&&Number.isFinite(withSkill.attempts)&&withSkill.attempts<baseline.attempts)return true;
  if(Number.isFinite(baseline.failures)&&Number.isFinite(withSkill.failures)&&withSkill.failures<baseline.failures)return true;
  if(Number.isFinite(baseline.durationMs)&&baseline.durationMs>0&&Number.isFinite(withSkill.durationMs)&&withSkill.durationMs<=baseline.durationMs*.9)return true;
  return false;
}
function parseSkillRef(ref){
  if(ref&&typeof ref==='object'&&ref.id&&Number.isFinite(Number(ref.version)))return{id:String(ref.id),version:Number(ref.version)};
  const m=String(ref||'').match(/^(.*)@v?(\d+)$/);return m?{id:m[1],version:Number(m[2])}:null;
}

export async function recordSkillTransfer(root,skillRef,{task,baseline,withSkill,verify}={}){
  const ref=parseSkillRef(skillRef);if(!ref)return{status:'rejected',reason:'A concrete skill id and version are required.'};
  let store=await loadSkillStore(root),state=store.versions.get(versionKey(ref.id,ref.version));
  if(!state||state.status!=='candidate')return{status:'rejected',reason:'Only a quarantined candidate can enter transfer evaluation.'};
  if(!state.verification?.ok)return{status:'rejected',id:ref.id,version:ref.version,reason:'The source task was not independently verified.'};
  const transferFp=taskFingerprint(task),known=new Set([...state.supports,...state.transfers.map(t=>t.taskFingerprint).filter(Boolean)]);
  if(!task||known.has(transferFp))return{status:'rejected',id:ref.id,version:ref.version,reason:'Transfer evidence must come from a different related task.'};
  const before=normalizeComparison(baseline),after=normalizeComparison(withSkill);
  if(!before||!after)return{status:'rejected',id:ref.id,version:ref.version,reason:'Baseline and with-skill results must include objective passed booleans.'};
  if(!objectivelyBetter(before,after))return{status:'rejected',id:ref.id,version:ref.version,reason:'The held-out run did not objectively improve on the baseline.'};
  if(!state.verifier||!isSafeVerifier(state.verifier)||typeof verify!=='function')return{status:'rejected',id:ref.id,version:ref.version,reason:'A safe concrete verifier must re-check the held-out result.'};
  let summary;
  try{summary=String(await verify(state.verifier)||'Verifier passed').slice(-1000)}catch(e){return{status:'rejected',id:ref.id,version:ref.version,reason:`Held-out verifier failed: ${e instanceof Error?e.message:String(e)}`}}
  await append(root,{type:'skill:transfer_verified',id:ref.id,version:ref.version,taskFingerprint:transferFp,baseline:before,withSkill:after,command:state.verifier,summary});
  store=await loadSkillStore(root);state=store.versions.get(versionKey(ref.id,ref.version));const previous=priorPromoted(store,ref.id,ref.version);
  if(previous?.status==='promoted')await append(root,{type:'skill:superseded',id:previous.id,version:previous.version,byVersion:ref.version});
  const confidence=.92;
  await append(root,{type:'skill:promoted',id:ref.id,version:ref.version,confidence,transferVerified:true,reason:'Source verifier passed and held-out reuse objectively beat baseline.'});
  return{status:'promoted',id:ref.id,version:ref.version,skill:state,confidence,verified:true,transferVerified:true,baseline:before,withSkill:after,reason:'Source verifier passed and held-out reuse objectively beat baseline.'};
}

export async function recordSkillUsage(root,skills,evidence){
  if(!evidence||typeof evidence!=='object'||evidence.verified!==true||typeof evidence.passed!=='boolean')return{recorded:false,count:0,reason:'Model/evaluator scores are advisory and are not recorded as skill success evidence.'};
  const score=Number.isFinite(Number(evidence.score))?clamp(evidence.score):(evidence.passed?1:0);let count=0;
  for(const s of skills||[]){if(!s?.id||!s?.version)continue;await append(root,{type:'skill:used',id:s.id,version:s.version,verified:true,success:evidence.passed,score});count++}
  return{recorded:true,count};
}

export async function recordRunOutcome(root,{task,score,skills=[],candidateDecision,verified=false}={}){
  const event={taskFingerprint:taskFingerprint(task),score:clamp(score),skillRefs:(skills||[]).map(s=>`${s.id}@v${s.version}`),candidateDecision:candidateDecision?.status||'none'};
  if(verified!==true){await append(root,{type:'run:observation',...event,verified:false});return null}
  await append(root,{type:'run:outcome',...event,verified:true});return maybeMetaMaintenance(root);
}

export async function maybeMetaMaintenance(root){
  let store=await loadSkillStore(root),meta=store.meta,every=Number(meta.maintenanceEvery||10);if(store.runCount-meta.lastRunCount<every)return null;
  const recent=store.rows.filter(e=>e.type==='run:outcome'&&e.verified===true).slice(-every),decisions=recent.map(x=>x.candidateDecision),avgScore=recent.reduce((a,b)=>a+clamp(b.score),0)/Math.max(1,recent.length),withSkills=recent.filter(x=>x.skillRefs?.length),skillFailureRate=withSkills.length?withSkills.filter(x=>clamp(x.score)<meta.minScore).length/withSkills.length:0,promotionRate=decisions.filter(x=>['promoted','existing'].includes(x)).length/Math.max(1,decisions.filter(x=>x!=='none').length),candidateRate=decisions.filter(x=>x==='candidate').length/Math.max(1,decisions.filter(x=>x!=='none').length);
  const guidance=[...DEFAULT_META.guidance];
  if(candidateRate>.5)guidance.push('Many verified runs still leave candidates quarantined: improve transfer coverage rather than weakening the gate.');
  if(skillFailureRate>.25)guidance.push('Transfer-verified skills correlated with verified failures: retrieve fewer candidates and re-check assumptions.');
  if(promotionRate>.6&&avgScore>.9)guidance.push('Recent transfer-verified skills are helping on objective runs; prefer them before inventing new procedures.');
  const next={...meta,version:Number(meta.version||2)+1,lastRunCount:store.runCount,guidance,metrics:{window:every,avgScore,promotionRate,candidateRate,skillFailureRate}};await append(root,{type:'meta:update',meta:next});
  store=await loadSkillStore(root);const actions=[];
  for(const s of activeSkills(store)){
    if(s.uses<3)continue;const successRate=s.successes/Math.max(1,s.uses),usageAvg=mean(s.usageScores),prior=priorPromoted(store,s.id,s.version),priorQuality=skillQuality(prior),materiallyWorse=prior&&usageAvg!==null&&priorQuality!==null&&usageAvg+.03<priorQuality,consistentlyFailing=s.uses>=5&&successRate<.4;
    if(!materiallyWorse&&!consistentlyFailing)continue;
    const reason=materiallyWorse?`verified usage score ${usageAvg.toFixed(2)} trails prior ${priorQuality.toFixed(2)}`:`verified usage success rate ${successRate.toFixed(2)}`;
    await append(root,{type:'skill:rollback',id:s.id,version:s.version,restore:false,reason});actions.push(`rolled back ${s.id}@v${s.version}`);
    if(prior){await append(root,{type:'skill:rollback',id:prior.id,version:prior.version,restore:true,reason:`restored after v${s.version} underperformed on verified usage`});actions.push(`restored ${prior.id}@v${prior.version}`)}
  }
  return{meta:next,actions};
}

export async function skillStats(root){
  const store=await loadSkillStore(root),skills=allSkills(store),active=activeSkills(store);
  return{runCount:store.runCount,meta:store.meta,promoted:active.length,quarantinedLegacy:skills.filter(s=>s.status==='promoted'&&s.transferVerified!==true).length,candidates:skills.filter(s=>s.status==='candidate').length,rejected:skills.filter(s=>s.status==='rejected').length,retired:skills.filter(s=>['retired','rolled_back'].includes(s.status)).length,skills:active.map(s=>({id:s.id,version:s.version,title:s.title,uses:s.uses,successes:s.successes,confidence:s.confidence,avgUsageScore:mean(s.usageScores),transferVerified:true}))};
}
