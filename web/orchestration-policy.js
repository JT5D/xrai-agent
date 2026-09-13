const COMPLEX_RE=/\b(repo|repository|code|debug|fix|implement|refactor|architecture|research|compare|evaluate|benchmark|state of the art|optimi[sz]e|self[- ]?improv|multi[- ]?step|end[- ]?to[- ]?end|deep(?:ly)?|plan carefully)\b/i;
const MULTI_RE=/\b(and|also|then|plus|across|multiple|several|all|both|three|3|four|4)\b/i;
const VERIFY_RE=/\b(verify|test|prove|evidence|benchmark|measure|validate|check|working|correct)\b/i;
const FRESH_RE=/\b(latest|current|today|recent|2026|state of the art|github|web|online|research)\b/i;
const POLICY_KEY='xrai-orchestration-policies-v1',UI_KEY='xrai-ui-v4';
const MIN_SAMPLES=4,MIN_GAIN=.015,ROLLBACK_GAP=.03;

export const POLICY_REGISTRY={
  'adaptive-v1':{id:'adaptive',version:1,label:'Adaptive incumbent',workerBoost:0,retryBoost:0},
  'efficient-v2':{id:'efficient',version:2,label:'Efficiency challenger',workerBoost:-1,retryBoost:0},
  'breadth-v2':{id:'breadth',version:2,label:'Breadth challenger',workerBoost:1,retryBoost:0}
};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
const avg=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const hash=s=>{let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const read=(storage,key,fallback)=>{try{return JSON.parse(storage?.getItem(key)||'null')??fallback}catch{return fallback}};
const write=(storage,key,value)=>{try{storage?.setItem(key,JSON.stringify(value))}catch{}};
const baseStore=()=>({incumbentByBucket:{},outcomes:[],decisions:[],processedRuns:[]});

function taskFeatures(task,{constrained=false}={}){
  const text=String(task).trim(),words=text.split(/\s+/).filter(Boolean).length;let complexity=0;
  if(words>18)complexity++;if(words>45)complexity++;if(COMPLEX_RE.test(text))complexity+=2;if(MULTI_RE.test(text))complexity++;if(VERIFY_RE.test(text))complexity++;
  const separable=complexity>=3&&MULTI_RE.test(text),evidenceCritical=VERIFY_RE.test(text)||/\b(code|repo|research|compare|benchmark|self[- ]?improv)\b/i.test(text),fresh=FRESH_RE.test(text),mode=complexity>=5?'deep':complexity>=3?'standard':'fast';
  return{mode,complexity,separable,evidenceCritical,fresh,constrained,bucket:`${mode}:${separable?'sep':'single'}:${evidenceCritical?'evidence':'ordinary'}:${fresh?'fresh':'stable'}`};
}
function utility(o){const quality=.62*clamp(o.score,0,1)+.28*clamp(o.pathScore??o.score,0,1),latencyPenalty=Math.min(.07,(Number(o.durationMs)||0)/180000),workPenalty=Math.min(.05,((Number(o.workers)||1)-1)*.018+(Number(o.retries)||0)*.014);return quality-latencyPenalty-workPenalty}
function stats(rows,key,bucket){const r=rows.filter(x=>x.policyKey===key&&x.bucket===bucket),vals=r.map(utility);return{n:r.length,utility:avg(vals),score:avg(r.map(x=>Number(x.score)||0)),pathScore:avg(r.map(x=>Number(x.pathScore??x.score)||0)),durationMs:avg(r.map(x=>Number(x.durationMs)||0))}}
function assess(store,bucket){
  const incumbent=store.incumbentByBucket[bucket]||'adaptive-v1',keys=['adaptive-v1','efficient-v2','breadth-v2'],inc=stats(store.outcomes,incumbent,bucket);let best=null;
  for(const key of keys){if(key===incumbent)continue;const s=stats(store.outcomes,key,bucket);if(s.n<MIN_SAMPLES||inc.n<MIN_SAMPLES)continue;const delta=s.utility-inc.utility;if(!best||delta>best.delta)best={key,stats:s,delta}}
  if(best&&best.delta>=MIN_GAIN){store.incumbentByBucket[bucket]=best.key;const d={type:'policy:promoted',bucket,incumbent,challenger:best.key,samples:{incumbent:inc.n,challenger:best.stats.n},utility:{incumbent:inc.utility,challenger:best.stats.utility,delta:best.delta},ts:new Date().toISOString(),reason:'Comparable challenger exceeded incumbent utility threshold.'};store.decisions.push(d);return d}
  if(incumbent!=='adaptive-v1'&&inc.n>=MIN_SAMPLES){const baseline=stats(store.outcomes,'adaptive-v1',bucket);if(baseline.n>=MIN_SAMPLES&&inc.utility+ROLLBACK_GAP<baseline.utility){store.incumbentByBucket[bucket]='adaptive-v1';const d={type:'policy:rollback',bucket,incumbent,restore:'adaptive-v1',samples:{incumbent:inc.n,baseline:baseline.n},utility:{incumbent:inc.utility,baseline:baseline.utility,delta:baseline.utility-inc.utility},ts:new Date().toISOString(),reason:'Promoted policy materially underperformed the stable baseline.'};store.decisions.push(d);return d}}
  return null;
}
export function ingestPolicyOutcomes(storage=globalThis.localStorage){
  const ui=read(storage,UI_KEY,null);if(!ui?.events?.length)return[];const store={...baseStore(),...read(storage,POLICY_KEY,baseStore())},processed=new Set(store.processedRuns||[]),byRun=new Map();
  for(const e of ui.events){if(!e?.runId)continue;if(!byRun.has(e.runId))byRun.set(e.runId,[]);byRun.get(e.runId).push(e)}const decisions=[];
  for(const [runId,events] of byRun){if(processed.has(runId))continue;const p=events.find(e=>e.type==='orchestration:policy'||e.type==='policy:selected'),done=[...events].reverse().find(e=>e.type==='run:done');if(!p||!done)continue;const data=p.data||{},end=new Date(done.ts||Date.now()).getTime(),start=new Date(events.find(e=>e.type==='run:start')?.ts||end).getTime();store.outcomes.push({runId,policyKey:data.policyKey||'adaptive-v1',bucket:data.bucket||'unknown',score:Number(done.data?.score)||0,pathScore:Number(done.data?.pathScore??done.data?.score)||0,durationMs:Math.max(0,end-start),workers:Number(data.workers)||1,retries:Number(data.retries)||0,ts:new Date(end).toISOString()});processed.add(runId);const d=assess(store,data.bucket||'unknown');if(d)decisions.push(d)}
  store.outcomes=store.outcomes.slice(-240);store.decisions=store.decisions.slice(-80);store.processedRuns=[...processed].slice(-240);write(storage,POLICY_KEY,store);return decisions;
}
function choosePolicy(features,task,storage,maxWorkers){
  ingestPolicyOutcomes(storage);const store={...baseStore(),...read(storage,POLICY_KEY,baseStore())},incumbent=store.incumbentByBucket[features.bucket]||'adaptive-v1';
  if(features.constrained||features.mode==='fast'||maxWorkers<=1)return{key:incumbent,experiment:false,decision:store.decisions.at(-1)||null};
  const candidates=['efficient-v2','breadth-v2'].filter(k=>k!==incumbent),roll=hash(`${task}|${store.outcomes.length}`)%10,key=roll<2?candidates[roll%candidates.length]:incumbent;
  return{key,experiment:key!==incumbent,incumbent,decision:store.decisions.at(-1)||null};
}
export function analyzeOrchestration(task='',{constrained=false,maxChildren=2,maxRetries=1,storage=globalThis.localStorage}={}){
  const f=taskFeatures(task,{constrained}),childCap=clamp(maxChildren,0,constrained?1:3),retryCap=clamp(maxRetries,0,constrained?0:2),baseWorkers=childCap===0?1:Math.min(childCap,f.complexity>=4&&f.separable?2:1),baseRetries=f.complexity>=3&&f.evidenceCritical?retryCap:0,choice=choosePolicy(f,task,storage,childCap),variant=POLICY_REGISTRY[choice.key]||POLICY_REGISTRY['adaptive-v1'];
  const workers=clamp(baseWorkers+variant.workerBoost,1,Math.max(1,childCap)),retries=clamp(baseRetries+variant.retryBoost,0,retryCap);
  return{...f,policyKey:choice.key,policyId:variant.id,policyVersion:variant.version,policyLabel:variant.label,experiment:choice.experiment,incumbent:choice.incumbent||choice.key,workers,retries,parallelWorkers:workers>1,recentDecision:choice.decision||null};
}
export function policyStore(storage=globalThis.localStorage){return read(storage,POLICY_KEY,baseStore())}
export function shouldContinueImproving({score=0,previousScore=null,minScore=.82,attempt=1,maxAttempts=1,pathScore=score}={}){if(score>=minScore&&pathScore>=Math.max(0,minScore-.08))return{continue:false,reason:'target-met'};if(attempt>=maxAttempts)return{continue:false,reason:'budget-exhausted'};if(previousScore!==null&&score<=previousScore+.005)return{continue:false,reason:'no-gain'};return{continue:true,reason:'fixable-gap'}}
