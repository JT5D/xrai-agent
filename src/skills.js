import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const STOP=new Set('the a an and or to of in on for with is are be as at by from it this that use uses using'.split(' '));
const DEFAULT_META={
  version:1,
  lastRunCount:0,
  minScore:.82,
  directPromoteScore:.86,
  supportNeeded:2,
  maintenanceEvery:10,
  minVersionGain:.01,
  retrieval:{relevance:.65,confidence:.15,utility:.15,recency:.05},
  guidance:[
    'Create narrow reusable skills, not task transcripts.',
    'Prefer a concrete safe verifier that directly tests the claimed outcome.',
    'Treat retrieved skills as hypotheses; evidence outranks memory.',
    'A replacement skill should measurably outperform the version it supersedes.'
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
    if(e.type==='run:outcome'){runCount++;continue}
    if(!e.id||!e.version)continue;const key=versionKey(e.id,e.version);let s=versions.get(key);
    if(e.type==='skill:proposed'){s={...e.skill,id:e.id,version:e.version,status:'candidate',createdAt:e.ts,updatedAt:e.ts,supports:new Set([e.taskFingerprint].filter(Boolean)),scores:[clamp(e.score)],usageScores:[],uses:0,successes:0,failures:0,lastUsedAt:null,verification:null};versions.set(key,s);continue}
    if(!s)continue;s.updatedAt=e.ts||s.updatedAt;
    if(e.type==='skill:supported'){if(e.taskFingerprint)s.supports.add(e.taskFingerprint);if(Number.isFinite(Number(e.score)))s.scores.push(clamp(e.score))}
    else if(e.type==='skill:verified')s.verification={ok:true,command:e.command,summary:e.summary||'Verifier passed',ts:e.ts};
    else if(e.type==='skill:verification_failed')s.verification={ok:false,command:e.command,summary:e.summary||'Verifier failed',ts:e.ts};
    else if(e.type==='skill:promoted'){s.status='promoted';s.promotedAt=e.ts;s.confidence=clamp(e.confidence||.72)}
    else if(e.type==='skill:superseded')s.status='superseded';
    else if(e.type==='skill:rejected')s.status='rejected';
    else if(e.type==='skill:retired')s.status='retired';
    else if(e.type==='skill:rollback')s.status=e.restore?'promoted':'rolled_back';
    else if(e.type==='skill:used'){s.uses++;if(e.success)s.successes++;else s.failures++;if(Number.isFinite(Number(e.score)))s.usageScores.push(clamp(e.score));s.lastUsedAt=e.ts}
  }
  return {rows,versions,meta,runCount};
}

export async function loadSkillStore(root){return reduce(await events(root))}
export async function getMetaPolicy(root){return (await loadSkillStore(root)).meta}

export function normalizeSkillCandidate(candidate={}){
  const title=String(candidate.title||'').trim().slice(0,120),trigger=String(candidate.trigger||'').trim().slice(0,500),procedure=String(candidate.procedure||'').trim().slice(0,1600),verifier=String(candidate.verifier||'').trim().slice(0,300),tags=[...new Set((Array.isArray(candidate.tags)?candidate.tags:[]).map(x=>String(x).trim().toLowerCase()).filter(Boolean))].slice(0,8);
  if(!title||!trigger||!procedure||sensitive(`${title}\n${trigger}\n${procedure}\n${verifier}`))return null;return{title,trigger,procedure,verifier,tags};
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
function activeSkills(store){return allSkills(store).filter(s=>s.status==='promoted')}
function currentForId(store,id){return allSkills(store).filter(s=>s.id===id).sort((a,b)=>b.version-a.version)[0]}
function priorPromoted(store,id,version){return allSkills(store).filter(s=>s.id===id&&s.version<version&&['promoted','superseded'].includes(s.status)).sort((a,b)=>b.version-a.version)[0]}
function skillQuality(skill){if(!skill)return null;const usage=mean(skill.usageScores);if(usage!==null)return usage;return mean(skill.scores)}
function similar(store,candidate){return allSkills(store).map(s=>({s,sim:jaccard(`${s.title} ${s.trigger} ${(s.tags||[]).join(' ')}`,`${candidate.title} ${candidate.trigger} ${(candidate.tags||[]).join(' ')}`),proc:jaccard(s.procedure,candidate.procedure)})).sort((a,b)=>b.sim-a.sim)[0]}

export async function retrieveSkills(root,query,limit=4){
  const store=await loadSkillStore(root),w=store.meta.retrieval||DEFAULT_META.retrieval,hits=[];
  for(const s of activeSkills(store)){const relevance=lexical(query,skillText(s));if(!relevance)continue;const utility=s.uses?((s.successes+1)/(s.uses+2)):.67,confidence=clamp((s.confidence||.72)*.65+utility*.35),recency=1/(1+daysOld(s.lastUsedAt||s.promotedAt||s.updatedAt)/30),score=relevance*w.relevance+confidence*w.confidence+utility*w.utility+recency*w.recency;hits.push({...s,supports:[...s.supports],score,utility,confidence})}
  return hits.sort((a,b)=>b.score-a.score).slice(0,limit);
}

export function formatSkills(skills=[]){if(!skills.length)return 'No promoted skills matched this task.';return skills.map((s,i)=>`[${i+1}] ${s.title} (${s.id}@v${s.version}, confidence ${Math.round(s.confidence*100)}%)\nWHEN: ${s.trigger}\nDO: ${s.procedure}${s.verifier?`\nVERIFY: ${s.verifier}`:''}`).join('\n\n')}

export async function observeSkillCandidate(root,candidateInput,{task,score,verify}={}){
  const candidate=normalizeSkillCandidate(candidateInput),meta=await getMetaPolicy(root);if(!candidate||clamp(score)<meta.minScore)return{status:'ignored',reason:'No reusable candidate or score below learning threshold.'};
  let store=await loadSkillStore(root),match=similar(store,candidate),id,version,state;
  if(match?.sim>=.58){id=match.s.id;const latest=currentForId(store,id),latestProc=latest?jaccard(latest.procedure,candidate.procedure):0;if(latest?.status==='candidate'&&latestProc>=.7){version=latest.version;state=latest;await append(root,{type:'skill:supported',id,version,taskFingerprint:taskFingerprint(task),score});}
    else if(latest?.status==='promoted'&&latestProc>=.82){await append(root,{type:'skill:supported',id,version:latest.version,taskFingerprint:taskFingerprint(task),score});return{status:'existing',id,version:latest.version,skill:latest,reason:'Existing promoted skill already covers this candidate.'}}
    else{version=(latest?.version||0)+1;await append(root,{type:'skill:proposed',id,version,skill:candidate,taskFingerprint:taskFingerprint(task),score});}
  }else{id=`skill-${hash(`${candidate.title}|${candidate.trigger}|${candidate.tags.join(',')}`)}`;version=1;await append(root,{type:'skill:proposed',id,version,skill:candidate,taskFingerprint:taskFingerprint(task),score});}
  store=await loadSkillStore(root);state=store.versions.get(versionKey(id,version));

  let verified=false,verificationSummary='';
  if(candidate.verifier&&isSafeVerifier(candidate.verifier)&&clamp(score)>=meta.directPromoteScore&&verify){
    try{const out=await verify(candidate.verifier);verified=true;verificationSummary=String(out||'Verifier passed').slice(-1000);await append(root,{type:'skill:verified',id,version,command:candidate.verifier,summary:verificationSummary});}
    catch(e){verificationSummary=e instanceof Error?e.message:String(e);await append(root,{type:'skill:verification_failed',id,version,command:candidate.verifier,summary:verificationSummary});await append(root,{type:'skill:rejected',id,version,reason:'Concrete verifier failed.'});return{status:'rejected',id,version,skill:state,reason:'Concrete verifier failed.',verification:verificationSummary}}
  }
  store=await loadSkillStore(root);state=store.versions.get(versionKey(id,version));const supportCount=state?.supports?.size||0,avg=mean(state?.scores)||0,previous=priorPromoted(store,id,version),baseline=skillQuality(previous),requiredGain=Number(meta.minVersionGain??.01),beatsPrevious=baseline===null||avg>=baseline+requiredGain;
  const evidenceGate=verified||(supportCount>=meta.supportNeeded&&avg>=meta.directPromoteScore),promote=evidenceGate&&beatsPrevious;
  if(promote){if(previous?.status==='promoted')await append(root,{type:'skill:superseded',id,version:previous.version,byVersion:version});const confidence=verified?Math.min(.98,.78+clamp(score)*.18):Math.min(.9,.62+avg*.22+Math.min(.08,supportCount*.02));const reason=previous?`Challenger beat v${previous.version} baseline ${Math.round(baseline*100)}% with ${Math.round(avg*100)}% and passed ${verified?'its verifier':'the support gate'}.`:verified?'Concrete verifier passed.':'Repeated successful observations passed the support gate.';await append(root,{type:'skill:promoted',id,version,confidence,reason,baseline,candidateScore:avg});return{status:'promoted',id,version,skill:state,confidence,verified,supportCount,baseline,candidateScore:avg,reason}}
  if(evidenceGate&&!beatsPrevious)return{status:'candidate',id,version,skill:state,verified,supportCount,baseline,candidateScore:avg,reason:`Challenger passed its evidence gate but did not yet beat v${previous.version} by ${Math.round(requiredGain*100)} point; baseline ${Math.round(baseline*100)}%, challenger ${Math.round(avg*100)}%.`};
  return{status:'candidate',id,version,skill:state,supportCount,baseline,candidateScore:avg,reason:candidate.verifier&&!isSafeVerifier(candidate.verifier)?'Verifier was not safe to execute automatically; awaiting repeated successful support.':'Awaiting another distinct successful observation or a safe concrete verifier.'};
}

export async function recordSkillUsage(root,skills,score){const success=clamp(score)>=.82;for(const s of skills||[])await append(root,{type:'skill:used',id:s.id,version:s.version,success,score:clamp(score)});}

export async function recordRunOutcome(root,{task,score,skills=[],candidateDecision}={}){await append(root,{type:'run:outcome',taskFingerprint:taskFingerprint(task),score:clamp(score),skillRefs:(skills||[]).map(s=>`${s.id}@v${s.version}`),candidateDecision:candidateDecision?.status||'none'});return maybeMetaMaintenance(root)}

export async function maybeMetaMaintenance(root){
  let store=await loadSkillStore(root),meta=store.meta,every=Number(meta.maintenanceEvery||10);if(store.runCount-meta.lastRunCount<every)return null;
  const recent=store.rows.filter(e=>e.type==='run:outcome').slice(-every),decisions=recent.map(x=>x.candidateDecision),avgScore=recent.reduce((a,b)=>a+clamp(b.score),0)/Math.max(1,recent.length),withSkills=recent.filter(x=>x.skillRefs?.length),skillFailureRate=withSkills.length?withSkills.filter(x=>clamp(x.score)<meta.minScore).length/withSkills.length:0,promotionRate=decisions.filter(x=>['promoted','existing'].includes(x)).length/Math.max(1,decisions.filter(x=>x!=='none').length),candidateRate=decisions.filter(x=>x==='candidate').length/Math.max(1,decisions.filter(x=>x!=='none').length);
  const guidance=[...DEFAULT_META.guidance];if(candidateRate>.5)guidance.push('Too many candidates lack decisive evidence: narrow the trigger and propose a direct test/lint/build verifier when possible.');if(skillFailureRate>.25)guidance.push('Recent retrieved skills correlated with failures: use fewer, higher-confidence skills and explicitly re-check assumptions.');if(promotionRate>.6&&avgScore>.9)guidance.push('Recent promoted skills transfer well: reuse proven procedures before inventing new ones.');
  const next={...meta,version:Number(meta.version||1)+1,lastRunCount:store.runCount,guidance,metrics:{window:every,avgScore,promotionRate,candidateRate,skillFailureRate}};await append(root,{type:'meta:update',meta:next});
  store=await loadSkillStore(root);const actions=[];
  for(const s of activeSkills(store)){if(s.uses<3)continue;const successRate=s.successes/Math.max(1,s.uses),usageAvg=mean(s.usageScores),prior=priorPromoted(store,s.id,s.version),priorQuality=skillQuality(prior),materiallyWorse=prior&&usageAvg!==null&&priorQuality!==null&&usageAvg+.03<priorQuality,consistentlyFailing=s.uses>=5&&successRate<.4;if(!materiallyWorse&&!consistentlyFailing)continue;const reason=materiallyWorse?`usage score ${usageAvg.toFixed(2)} trails prior ${priorQuality.toFixed(2)}`:`usage success rate ${successRate.toFixed(2)}`;await append(root,{type:'skill:rollback',id:s.id,version:s.version,restore:false,reason});actions.push(`rolled back ${s.id}@v${s.version}`);if(prior){await append(root,{type:'skill:rollback',id:prior.id,version:prior.version,restore:true,reason:`restored after v${s.version} underperformed`});actions.push(`restored ${prior.id}@v${prior.version}`)}}
  return{meta:next,actions};
}

export async function skillStats(root){const store=await loadSkillStore(root),skills=allSkills(store);return{runCount:store.runCount,meta:store.meta,promoted:skills.filter(s=>s.status==='promoted').length,candidates:skills.filter(s=>s.status==='candidate').length,rejected:skills.filter(s=>s.status==='rejected').length,retired:skills.filter(s=>['retired','rolled_back'].includes(s.status)).length,skills:activeSkills(store).map(s=>({id:s.id,version:s.version,title:s.title,uses:s.uses,successes:s.successes,confidence:s.confidence,avgUsageScore:mean(s.usageScores)}))}}
