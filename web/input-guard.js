import { MAX_UI_STATE_CHARS,UI_STATE_KEY,loadUiState,saveUiState } from './state.js';

const LEGACY_UI_KEY='xrai-ui-v3';
const CURRENT_UI_KEY=UI_STATE_KEY;
const DEFAULT_REPO='JT5D/xrai-agent';
const CONTEXT_MARKER='\n\nPrevious XRAI context';

const API_REPO_URL=/https?:\/\/api\.github\.com\/repos\/[^\s)\]}>'"]+/gi;
const BAD_PAIR=/\b(filesystem|file|files|repo|repository|repos|codebase|src|test|tests|build|api\.github\.com|github\.com|https?|localhost)\/(filesystem|file|files|repo|repository|repos|codebase|src|test|tests|build|api\.github\.com|github\.com|https?|localhost)\b/gi;
const QUESTION_FOLLOWUP=/^(?:is|was|did|does|has|have|can|could|will|would)\s+(?:it|that|this)\b[^\n]{0,100}[?.!]?$/i;
const RETRY_FOLLOWUP=/^(?:(?:please\s+)?(?:try|do|run|execute|repeat|retry|rerun)(?:\s+(?:it|that|this|the\s+same(?:\s+thing)?))?(?:\s+again)?|(?:try|do|run)\s+that\s+again|same(?:\s+thing)?(?:\s+again)?|again|retry|rerun)[?.!]*$/i;

export function sanitizeTask(task=''){
  let text=String(task);
  text=text.replace(API_REPO_URL,'[GitHub API error URL]');
  text=text.replace(BAD_PAIR,(m,a,b)=>`${a} ${b}`);
  return text;
}

export function visibleTask(task=''){
  return sanitizeTask(String(task).split(CONTEXT_MARKER,1)[0]).trim();
}

export function isContextualFollowup(task=''){
  const text=visibleTask(task);
  return QUESTION_FOLLOWUP.test(text)||RETRY_FOLLOWUP.test(text);
}

export function isRetryFollowup(task=''){
  return RETRY_FOLLOWUP.test(visibleTask(task));
}

export function lastMeaningfulUserTask(state){
  const messages=Array.isArray(state?.messages)?state.messages:[];
  for(let i=messages.length-1;i>=0;i--){
    const message=messages[i];
    if(message?.role!=='user')continue;
    const text=visibleTask(message?.text||'');
    if(text&&!isContextualFollowup(text))return text;
  }
  const lastTask=visibleTask(state?.lastTask||'');
  return lastTask&&!isContextualFollowup(lastTask)?lastTask:'';
}

export function stateLooksStale(value){
  if(!value||typeof value!=='object')return false;
  const hay=[...(Array.isArray(value.messages)?value.messages.map(m=>m?.text):[]),value?.result?.output,value?.statusText].filter(Boolean).join('\n');
  return /public github pages runtime does not have those capabilities|open runtime and use the local execution host|api\.github\.com\/repos\/(?:filesystem|api\.github\.com)|filesystem\/repository/i.test(hay);
}

export function purgeStaleUiState(storage=globalThis.localStorage){
  let removed=false;
  try{
    const raw=storage?.getItem(CURRENT_UI_KEY)||'';
    if(raw&&raw.length<=MAX_UI_STATE_CHARS&&stateLooksStale(loadUiState(storage))){storage.removeItem(CURRENT_UI_KEY);removed=true}
  }catch{}
  try{
    const raw=storage?.getItem(LEGACY_UI_KEY)||'';
    if(raw&&raw.length<=MAX_UI_STATE_CHARS&&stateLooksStale(JSON.parse(raw))){storage.removeItem(LEGACY_UI_KEY);removed=true}
  }catch{}
  return removed;
}

export function migrateLegacyUiState(storage=globalThis.localStorage){
  try{
    if(storage?.getItem(CURRENT_UI_KEY))return false;
    const raw=storage?.getItem(LEGACY_UI_KEY);if(!raw||raw.length>MAX_UI_STATE_CHARS)return false;
    const parsed=JSON.parse(raw);
    if(stateLooksStale(parsed)){storage.removeItem(LEGACY_UI_KEY);return true}
  }catch{}
  return false;
}

export function repairLeakedContextState(storage=globalThis.localStorage){
  try{
    const raw=storage?.getItem(CURRENT_UI_KEY)||'';if(!raw||raw.length>MAX_UI_STATE_CHARS)return false;
    const state=loadUiState(storage);if(!state||typeof state!=='object')return false;
    const leaked=String(state.lastTask||'').includes(CONTEXT_MARKER)||(Array.isArray(state.messages)&&state.messages.some(m=>String(m?.text||'').includes(CONTEXT_MARKER)));
    if(!leaked)return false;
    const prior=lastMeaningfulUserTask(state);
    if(Array.isArray(state.messages))state.messages=state.messages.map(m=>m?.role==='user'?{...m,text:visibleTask(m.text)}:m);
    state.lastTask=prior||visibleTask(state.lastTask||'');
    saveUiState(storage,state);return true;
  }catch{return false}
}

export function contextualizeFollowup(task,storage=globalThis.localStorage){
  const clean=visibleTask(task);
  if(!isContextualFollowup(clean))return clean;
  try{
    const state=loadUiState(storage);
    const priorTask=lastMeaningfulUserTask(state);
    const priorResult=String(state?.result?.output||'').trim();
    if(!priorTask&&!priorResult)return clean;
    const mode=isRetryFollowup(clean)?'retry':'reference';
    return `${clean}${CONTEXT_MARKER} (mode: ${mode}; internal only):\nTask: ${priorTask||DEFAULT_REPO}\nResult: ${(priorResult||'No completed result was recorded.').slice(0,1600)}`;
  }catch{return clean}
}

if(typeof window!=='undefined'){
  purgeStaleUiState(window.localStorage);
  migrateLegacyUiState(window.localStorage);
  repairLeakedContextState(window.localStorage);
}
