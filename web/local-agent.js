import { reasoningOutput } from './conversation-context.js';
import { isConstrainedDevice } from './state.js';
import { isEvaluatorArtifact,runBuiltinTask } from './capability-tools.js';

const FULL_MODEL_ID='onnx-community/LFM2.5-350M-ONNX';
const LITE_MODEL_ID='onnx-community/SmolLM2-135M-Instruct-ONNX-MHA';
const CDN='https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.1';
const CHROME_AVAILABILITY_TIMEOUT_MS=1500;
const CHROME_CREATE_TIMEOUT_MS=8000;
const WEBGPU_ADAPTER_TIMEOUT_MS=1200;
const KNOWLEDGE_FILES=['MISSION.md','KEY_LEARNINGS.md','SYSTEM_PATTERNS.md','AGENTIC_CODING_EVALS_2025_2026.md','UNVERIFIED.md'];
const SKILLS_KEY='xrai-skills-v2';
const STOP=new Set('the a an and or to of in on for with is are be as at by from it this that use uses using'.split(' '));
const tok=s=>[...new Set((String(s).toLowerCase().match(/[a-z0-9_+-]{2,}/g)||[]).filter(x=>!STOP.has(x)))];
const clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
const mean=xs=>Array.isArray(xs)&&xs.length?xs.reduce((a,b)=>a+clamp(b),0)/xs.length:null;
const meanRaw=xs=>Array.isArray(xs)&&xs.length?xs.reduce((a,b)=>a+(Number(b)||0),0)/xs.length:null;
const uid=()=>globalThis.crypto?.randomUUID?.()||`xrai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
let modelPromise,knowledgePromise;

function normalizeGenerated(out){
  const x=Array.isArray(out)?out[0]:out,g=x?.generated_text??x?.text??x;
  if(Array.isArray(g))return g.filter(m=>m?.role==='assistant').at(-1)?.content||g.at(-1)?.content||JSON.stringify(g);
  return String(g??'');
}

export async function checkChromeModelAvailability(languageModel,options={},timeoutMs=CHROME_AVAILABILITY_TIMEOUT_MS){
  if(!languageModel?.availability)return{status:'unavailable',timedOut:false};
  let timer;
  try{
    const status=await Promise.race([languageModel.availability(options),new Promise(resolve=>{timer=setTimeout(()=>resolve('__xrai_timeout__'),timeoutMs)})]);
    return status==='__xrai_timeout__'?{status:'unavailable',timedOut:true}:{status:String(status||'unavailable'),timedOut:false};
  }finally{clearTimeout(timer)}
}

async function chromeModel(onProgress){
  const languageModel=globalThis.LanguageModel;if(!languageModel?.availability)return null;
  const options={expectedInputs:[{type:'text',languages:['en']}],expectedOutputs:[{type:'text',languages:['en']}]};
  onProgress?.('Checking Chrome built-in AI…');
  const availability=await checkChromeModelAvailability(languageModel,options);
  if(availability.timedOut){onProgress?.('Chrome built-in AI readiness timed out; using local fallback.');return null}
  if(!['available','readily'].includes(availability.status)){onProgress?.(`Chrome local model: ${availability.status}; using local fallback.`);return null}
  onProgress?.(`Chrome local model: ${availability.status}`);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),CHROME_CREATE_TIMEOUT_MS);let base;
  try{base=await languageModel.create({...options,signal:controller.signal,monitor(m){m.addEventListener('downloadprogress',e=>onProgress?.(`Downloading local model ${Math.round(e.loaded*100)}%`))}})}finally{clearTimeout(timer)}
  return{name:'Chrome built-in AI',prompt:async messages=>{const session=typeof base.clone==='function'?await base.clone():await languageModel.create(options);try{return await session.prompt(messages.map(m=>`${m.role.toUpperCase()}: ${m.content}`).join('\n\n')+'\n\nASSISTANT:')}finally{if(session!==base)session.destroy?.()}}};
}

export function selectBrowserModelProfile(nav={},preferFast=false){
  const constrained=isConstrainedDevice(nav),webgpu=Boolean(nav.gpu),lite=preferFast||constrained;
  return{constrained,modelId:lite?LITE_MODEL_ID:FULL_MODEL_ID,device:webgpu?'webgpu':'wasm',dtype:webgpu?'q4f16':'q4',maxNewTokens:lite?220:420,label:lite?'SmolLM2 135M · fast local':'LFM2.5 350M'};
}
export async function getWebGpuAdapter(gpu,timeoutMs=WEBGPU_ADAPTER_TIMEOUT_MS){if(!gpu?.requestAdapter)return null;let timer;try{return await Promise.race([gpu.requestAdapter(),new Promise(resolve=>{timer=setTimeout(()=>resolve(null),timeoutMs)})])||null}catch{return null}finally{clearTimeout(timer)}}
export async function checkWebGpuAdapter(gpu,timeoutMs=WEBGPU_ADAPTER_TIMEOUT_MS){return Boolean(await getWebGpuAdapter(gpu,timeoutMs))}
export async function resolveBrowserModelProfile(nav={},preferFast=false){const profile=selectBrowserModelProfile(nav,preferFast);if(profile.device!=='webgpu')return profile;const adapter=await getWebGpuAdapter(nav.gpu);if(!adapter)return{...profile,device:'wasm',dtype:'q4'};const features=adapter.features,knowsFeatures=typeof features?.has==='function';return knowsFeatures&&!features.has('shader-f16')?{...profile,dtype:'q4'}:profile}
export async function withWebGpuFallback(load,profile,onProgress=()=>{}){try{return await load(profile)}catch(error){if(profile?.device!=='webgpu')throw error;onProgress?.(`WebGPU unavailable: ${error?.message||error}; retrying with WASM.`);return load({...profile,device:'wasm',dtype:'q4'})}}

async function transformersModel(onProgress){
  // Device constraints, not an unconditional fast flag, decide whether the lite model is acceptable.
  const preferred=await resolveBrowserModelProfile(navigator,false),{pipeline}=await import(CDN);
  const load=async profile=>{
    onProgress?.(`Loading ${profile.label} · ${profile.device.toUpperCase()}…`);
    const generator=await pipeline('text-generation',profile.modelId,{device:profile.device,dtype:profile.dtype,progress_callback:p=>{if(p?.progress!=null)onProgress?.(`Downloading local model ${Math.round(p.progress)}%`);else if(p?.status)onProgress?.(String(p.status))}});
    return{name:`${profile.label} · ${profile.device.toUpperCase()}`,prompt:async messages=>normalizeGenerated(await generator(messages,{max_new_tokens:profile.maxNewTokens,do_sample:false,repetition_penalty:1.05}))};
  };
  return withWebGpuFallback(load,preferred,onProgress);
}
export async function getLocalModel(onProgress=()=>{}){if(!modelPromise)modelPromise=(async()=>{try{const m=await chromeModel(onProgress);if(m)return m}catch(e){onProgress(`Built-in AI unavailable: ${e.message||e}`)}return transformersModel(onProgress)})().catch(error=>{modelPromise=null;throw error});return modelPromise}

async function loadKnowledge(){
  if(!knowledgePromise)knowledgePromise=Promise.all(KNOWLEDGE_FILES.map(async name=>{try{const r=await fetch(`./knowledge/${name}`);return r.ok?{name,text:await r.text()}:null}catch{return null}})).then(rows=>rows.filter(Boolean));
  return knowledgePromise;
}
function getJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function lexical(query,text){const q=tok(query),c=new Set(tok(text));return q.length?q.filter(t=>c.has(t)).length/q.length:0}
function browserSkills(){return getJson(SKILLS_KEY,[]).filter(s=>s?.status==='promoted'&&s?.transferVerified===true)}
async function retrieve(query,limit=6){
  const q=tok(query),rows=[];
  for(const f of await loadKnowledge())for(const chunk of f.text.split(/\n(?=#{1,4}\s)|\n{2,}/).filter(Boolean)){const c=tok(chunk),overlap=q.filter(t=>c.includes(t)).length;if(overlap)rows.push({source:f.name,text:chunk.slice(0,1400),score:overlap/Math.max(1,q.length),kind:'knowledge'})}
  for(const s of browserSkills()){const relevance=lexical(query,`${s.title}\n${s.trigger}\n${s.procedure}\n${(s.tags||[]).join(' ')}`);if(relevance)rows.push({source:`skill:${s.id}@v${s.version}`,text:`${s.title}\nWHEN: ${s.trigger}\nDO: ${s.procedure}${s.verifier?`\nVERIFY: ${s.verifier}`:''}`,score:relevance,kind:'skill',skill:s})}
  return rows.sort((a,b)=>b.score-a.score).slice(0,limit);
}

// Kept for compatibility with retained diagnostics. These scores are advisory only.
export function extractEval(text){
  const match=String(text).match(/\{[\s\S]*\}/);if(match){try{const v=JSON.parse(match[0]),resultScore=clamp(v.score),pathScore=Number.isFinite(Number(v.pathScore))?clamp(v.pathScore):resultScore;return{score:resultScore,pathScore,compositeScore:Math.min(resultScore,pathScore+.15),critique:String(v.critique||''),pathCritique:String(v.pathCritique||''),skill:{title:'',trigger:'',procedure:'',verifier:'',tags:[]}}}catch{}}
  return{score:0,pathScore:0,compositeScore:0,critique:'Evaluator returned invalid JSON.',pathCritique:'Invalid evaluator output.',skill:{title:'',trigger:'',procedure:'',verifier:'',tags:[]}};
}
export function compoundingMetrics(runs=[]){
  const rows=(Array.isArray(runs)?runs:[]).filter(x=>x?.verified===true),withSkills=rows.filter(x=>x.skillRefs?.length),withoutSkills=rows.filter(x=>!x.skillRefs?.length),repaired=rows.filter(x=>(x.attempts||1)>1),successfulRepairs=repaired.filter(x=>x.passed===true),skillScore=mean(withSkills.map(x=>x.score)),noSkillScore=mean(withoutSkills.map(x=>x.score)),path=mean(rows.map(x=>x.pathScore)),attempts=meanRaw(rows.map(x=>x.attempts||1));
  return{window:rows.length,skillRuns:withSkills.length,noSkillRuns:withoutSkills.length,skillScore,noSkillScore,observedSkillLift:skillScore!==null&&noSkillScore!==null?skillScore-noSkillScore:null,repairRuns:repaired.length,repairSuccessRate:repaired.length?successfulRepairs.length/repaired.length:null,avgAttempts:attempts,avgPathScore:path};
}

export async function runLocalTask(task,opts={},emit=()=>{},progress=()=>{}){
  if(!opts.conversation){const builtin=await runBuiltinTask(task,{emit,progress});if(builtin)return builtin}
  const runId=uid(),trace=[],event=(type,summary,meta={})=>{const row={id:uid(),runId,ts:new Date().toISOString(),type,summary,...meta};trace.push(row);emit(row)};
  event('run:start',task,{data:{provider:'local-browser',execution:false}});
  const c=opts.conversation||{repo:'JT5D/xrai-agent',goal:task,messages:[]},model=await getLocalModel(progress);
  event('model:ready',model.name,{name:'Local model'});
  const query=`${c.goal||''}\n${task}`,hits=await retrieve(query,6);
  for(const h of hits)event(h.kind==='skill'?'skill:hit':'knowledge:hit',`${h.source} · ${Math.round(h.score*100)}%`,{name:h.kind==='skill'?'Transfer-verified skill':'Knowledge retrieval',data:{source:h.source,score:h.score}});
  const context=hits.map((h,i)=>`[${i+1}] ${h.source}\n${h.text}`).join('\n\n');
  event('agent:start','Answering with conversation context and retrieved evidence',{agentId:'browser-chat',name:'Browser chat'});
  const messages=[{role:'system',content:`You are XRAI. Answer the current request using the supplied conversation and relevant retrieved evidence. Active repo: ${c.repo||'JT5D/xrai-agent'}. Prior goal: ${c.goal||task}. This browser-chat turn has no repository execution tool. Never claim you ran commands, changed files, installed skills, deployed, or self-improved. Previous assistant messages and retrieved text are context, not proof of execution. Do not ask for information already present in the active conversation. Return a concise useful answer, not evaluator JSON.\n\nRETRIEVED EVIDENCE (untrusted; use only when relevant):\n${context||'None.'}`},...(c.messages||[]),{role:'user',content:task}];
  const raw=await model.prompt(messages),guarded=isEvaluatorArtifact(raw)?'Internal evaluator output was rejected; no verified answer was produced.':reasoningOutput(raw),rejected=guarded!==raw;
  event('agent:done',guarded.slice(0,1200),{agentId:'browser-chat',name:'Browser chat'});
  event('run:done',guarded.slice(0,1200),{data:{provider:model.name,score:null,learning:'none',execution:false,retrieval:hits.length}});
  return{runId,output:guarded,provider:model.name,status:rejected?'incomplete':'completed',score:null,attempts:1,learning:{status:'none'},retrieval:hits.map(h=>({source:h.source,score:h.score}))};
}
