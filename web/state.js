import { normalizeEvent } from './event-model.js';

export const UI_STATE_KEY='xrai-ui-v4';
export const UI_STATE_VERSION=4;
export const MAX_UI_STATE_CHARS=1500000;

const HOST_PATTERNS=[
  /\b(repo|repository|codebase|github|git)\b/i,
  /\b(file|files|filesystem|terminal|shell|command line|cli)\b/i,
  /\b(fix|edit|modify|patch|commit|push|checkout|refactor)\b[\s\S]{0,40}\b(code|test|tests|build|lint|file|repo|repository)\b/i,
  /\b(npm|pnpm|yarn|bun|pytest|cargo|go test|make|cmake|gradle|mvn)\b/i,
  /\b(run|execute|verify)\b[\s\S]{0,30}\b(test|tests|build|lint|command|script)\b/i
];

const cut=(value,max)=>String(value??'').slice(0,max);
function compactValue(value,depth=0){
  if(value==null||typeof value==='boolean'||typeof value==='number')return value;
  if(typeof value==='string')return cut(value,4000);
  if(depth>=2)return cut(typeof value==='object'?JSON.stringify(value):value,4000);
  if(Array.isArray(value))return value.slice(0,32).map(v=>compactValue(v,depth+1));
  if(typeof value==='object')return Object.fromEntries(Object.entries(value).slice(0,32).map(([k,v])=>[cut(k,120),compactValue(v,depth+1)]));
  return cut(value,4000);
}
function compactMessage(value={}){return{id:cut(value.id,160),role:cut(value.role,24),text:cut(value.text,12000),ts:value.ts??Date.now(),runId:value.runId?cut(value.runId,160):null}}
function compactEvent(value={}){
  const e=normalizeEvent(value);
  return{id:e.id,runId:e.runId,parentId:e.parentId,type:e.type,kind:e.kind,name:cut(e.name,160),status:e.status,ts:e.ts,startedAt:e.startedAt,endedAt:e.endedAt,durationMs:e.durationMs,summary:cut(e.summary,2000),inputSummary:cut(e.inputSummary,4000),outputSummary:cut(e.outputSummary,4000),evidence:compactValue(e.evidence),error:e.error?cut(e.error,2000):null,data:e.type==='improvement:verified'?{...compactValue(e.data),commands:(e.data?.commands||[]).slice(0,10).map(c=>({cmd:cut(c.cmd,500),exitCode:c.exitCode,timedOut:Boolean(c.timedOut)}))}:compactValue(e.data),agentId:value.agentId?cut(value.agentId,160):undefined,parentAgentId:value.parentAgentId?cut(value.parentAgentId,160):undefined};
}
function compactResult(result){if(!result||typeof result!=='object')return null;return{...compactValue(result),output:cut(result.output,20000),diff:cut(result.diff,50000),evidence:Array.isArray(result.evidence)?result.evidence.slice(-10).map(x=>({cmd:cut(x.cmd,500),code:x.code,timedOut:Boolean(x.timedOut),output:cut(x.output,4000)})):[],changedFiles:Array.isArray(result.changedFiles)?result.changedFiles.slice(0,100).map(v=>cut(v,500)):[]}}

export function taskNeedsExecutionHost(task=''){
  return HOST_PATTERNS.some(pattern=>pattern.test(String(task)));
}

export function isConstrainedDevice(nav={}){
  const ua=String(nav.userAgent||'');
  const mobile=/iPhone|iPad|iPod|Android|Mobile/i.test(ua);
  const lowMemory=Number(nav.deviceMemory||0)>0&&Number(nav.deviceMemory)<=4;
  const noWebGpu=!nav.gpu;
  return mobile||lowMemory||noWebGpu;
}

export function defaultUiState(){
  return {
    version:UI_STATE_VERSION,
    view:'workspace',
    activeRunId:null,
    lastTask:'',
    runStatus:'idle',
    statusText:'ready',
    messages:[],
    events:[],
    result:null,
    options:{workspace:'.',maxDepth:2,maxChildren:2,retries:1},
    updatedAt:Date.now()
  };
}

export function normalizeUiState(value){
  const base=defaultUiState();
  if(!value||typeof value!=='object'||value.version!==UI_STATE_VERSION)return base;
  return {
    ...base,
    ...value,
    context:{repo:cut(value.context?.repo,200),goal:cut(value.context?.goal,2000)},
    lastTask:cut(value.lastTask,12000),
    statusText:cut(value.statusText,1000),
    messages:Array.isArray(value.messages)?value.messages.slice(-100).map(compactMessage):[],
    events:Array.isArray(value.events)?value.events.slice(-500).map(compactEvent):[],
    options:{...base.options,...compactValue(value.options||{})},
    result:compactResult(value.result)
  };
}

export function loadUiState(storage){
  try{
    const raw=storage?.getItem(UI_STATE_KEY)||'';
    if(!raw)return defaultUiState();
    if(raw.length>MAX_UI_STATE_CHARS)return{...defaultUiState(),statusText:'ready · oversized prior UI state skipped'};
    return normalizeUiState(JSON.parse(raw));
  }catch{return defaultUiState()}
}

export function saveUiState(storage,state){
  const next=normalizeUiState({...state,version:UI_STATE_VERSION,updatedAt:Date.now()});
  try{storage?.setItem(UI_STATE_KEY,JSON.stringify(next))}catch{}
  return next;
}

export function clearUiState(storage){
  try{storage?.removeItem(UI_STATE_KEY)}catch{}
  return defaultUiState()
}
