const POLICY_KEY='xrai-orchestration-policies-v1',UI_KEY='xrai-ui-v4';
const clampInt=(n,a,b)=>Math.max(a,Math.min(b,Math.floor(Number(n)||0)));
const clamp01=n=>Math.max(0,Math.min(1,Number(n)||0));
const read=(storage,key,fallback)=>{try{return JSON.parse(storage?.getItem(key)||'null')??fallback}catch{return fallback}};
const write=(storage,key,value)=>{try{storage?.setItem(key,JSON.stringify(value))}catch{}};
const baseStore=()=>({incumbentByBucket:{},outcomes:[],decisions:[],processedRuns:[]});

// The browser model owns semantic planning and whether delegation is useful.
// This module supplies only device/user ceilings plus mechanical parsing and evidence accounting.
export function analyzeOrchestration(task='',{constrained=false,maxChildren=2,maxRetries=1}={}){
  const workerCap=clampInt(maxChildren,0,constrained?1:3),retryCap=clampInt(maxRetries,0,constrained?0:2),bucket=`runtime:${constrained?'constrained':'standard'}:workers-${workerCap}:retries-${retryCap}`;
  return{mode:'model-led',policyKey:'model-led-v1',policyId:'model-led',policyVersion:1,policyLabel:'Model-led browser orchestration',experiment:false,incumbent:'model-led-v1',bucket,workerCap,retryCap,workers:1,retries:retryCap,parallelWorkers:false,recentDecision:null};
}

export function parsePlannerDecision(text='',{workerCap=1}={}){
  const raw=String(text).trim(),cap=Math.max(1,clampInt(workerCap,0,3));let value=null;
  const match=raw.match(/\{[\s\S]*\}/);if(match)try{value=JSON.parse(match[0])}catch{}
  const plan=String(value?.plan||raw).trim()||'Complete the task directly and verify the result.';
  const workers=clampInt(value?.workers??1,1,cap),parallel=Boolean(value?.parallel)&&workers>1;
  return{plan,workers,parallel};
}

function utility(o){const quality=.62*clamp01(o.score)+.28*clamp01(o.pathScore??o.score),latencyPenalty=Math.min(.07,(Number(o.durationMs)||0)/180000),workPenalty=Math.min(.05,((Number(o.workers)||1)-1)*.018+(Number(o.retries)||0)*.014);return quality-latencyPenalty-workPenalty}
export function ingestPolicyOutcomes(storage=globalThis.localStorage){
  const ui=read(storage,UI_KEY,null);if(!ui?.events?.length)return[];const store={...baseStore(),...read(storage,POLICY_KEY,baseStore())},processed=new Set(store.processedRuns||[]),byRun=new Map();
  for(const e of ui.events){if(!e?.runId)continue;if(!byRun.has(e.runId))byRun.set(e.runId,[]);byRun.get(e.runId).push(e)}
  for(const [runId,events] of byRun){if(processed.has(runId))continue;const p=events.find(e=>e.type==='orchestration:policy'||e.type==='policy:selected'),done=[...events].reverse().find(e=>e.type==='run:done');if(!p||!done)continue;const data=p.data||{},decision=[...events].reverse().find(e=>e.type==='orchestration:decision'),end=new Date(done.ts||Date.now()).getTime(),start=new Date(events.find(e=>e.type==='run:start')?.ts||end).getTime(),workers=Number(decision?.data?.workers??data.workers)||1,retries=Math.max(0,(Number(done.data?.attempts)||1)-1);store.outcomes.push({runId,policyKey:data.policyKey||'model-led-v1',bucket:data.bucket||'unknown',score:Number(done.data?.score)||0,pathScore:Number(done.data?.pathScore??done.data?.score)||0,durationMs:Math.max(0,end-start),workers,retries,utility:utility({score:done.data?.score,pathScore:done.data?.pathScore,durationMs:Math.max(0,end-start),workers,retries}),ts:new Date(end).toISOString()});processed.add(runId)}
  store.outcomes=store.outcomes.slice(-240);store.decisions=store.decisions.slice(-80);store.processedRuns=[...processed].slice(-240);write(storage,POLICY_KEY,store);return[];
}
export function policyStore(storage=globalThis.localStorage){return read(storage,POLICY_KEY,baseStore())}
export function shouldContinueImproving({score=0,previousScore=null,minScore=.82,attempt=1,maxAttempts=1,pathScore=score}={}){if(score>=minScore&&pathScore>=Math.max(0,minScore-.08))return{continue:false,reason:'target-met'};if(attempt>=maxAttempts)return{continue:false,reason:'budget-exhausted'};if(previousScore!==null&&score<=previousScore+.005)return{continue:false,reason:'no-gain'};return{continue:true,reason:'fixable-gap'}}
