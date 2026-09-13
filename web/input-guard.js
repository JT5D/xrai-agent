const LEGACY_UI_KEY='xrai-ui-v3';
const CURRENT_UI_KEY='xrai-ui-v4';
const DEFAULT_REPO='JT5D/xrai-agent';

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

export function isContextualFollowup(task=''){
  const text=String(task).trim();
  return QUESTION_FOLLOWUP.test(text)||RETRY_FOLLOWUP.test(text);
}

export function isRetryFollowup(task=''){
  return RETRY_FOLLOWUP.test(String(task).trim());
}

export function stateLooksStale(value){
  if(!value||typeof value!=='object')return false;
  const hay=[...(Array.isArray(value.messages)?value.messages.map(m=>m?.text):[]),value?.result?.output,value?.statusText].filter(Boolean).join('\n');
  return /public github pages runtime does not have those capabilities|open runtime and use the local execution host|api\.github\.com\/repos\/(?:filesystem|api\.github\.com)|filesystem\/repository/i.test(hay);
}

export function purgeStaleUiState(storage=globalThis.localStorage){
  let removed=false;
  for(const key of [CURRENT_UI_KEY,LEGACY_UI_KEY]){
    try{
      const raw=storage?.getItem(key);if(!raw)continue;
      if(stateLooksStale(JSON.parse(raw))){storage.removeItem(key);removed=true}
    }catch{}
  }
  return removed;
}

export function migrateLegacyUiState(storage=globalThis.localStorage){
  try{
    if(storage?.getItem(CURRENT_UI_KEY))return false;
    const raw=storage?.getItem(LEGACY_UI_KEY);if(!raw)return false;
    const parsed=JSON.parse(raw);
    if(stateLooksStale(parsed)){storage.removeItem(LEGACY_UI_KEY);return true}
  }catch{}
  return false;
}

function lastMeaningfulUserTask(state){
  const lastTask=String(state?.lastTask||'').split('\n\nPrevious XRAI context',1)[0].trim();
  if(lastTask&&!isContextualFollowup(lastTask))return lastTask;
  const messages=Array.isArray(state?.messages)?state.messages:[];
  for(let i=messages.length-1;i>=0;i--){
    const message=messages[i];
    if(message?.role!=='user')continue;
    const text=String(message?.text||'').split('\n\nPrevious XRAI context',1)[0].trim();
    if(text&&!isContextualFollowup(text))return text;
  }
  return '';
}

export function contextualizeFollowup(task,storage=globalThis.localStorage){
  const clean=sanitizeTask(task);
  if(!isContextualFollowup(clean))return clean;
  try{
    const state=JSON.parse(storage?.getItem(CURRENT_UI_KEY)||'null');
    const priorTask=lastMeaningfulUserTask(state);
    const priorResult=String(state?.result?.output||'').trim();
    if(!priorTask&&!priorResult)return clean;
    const mode=isRetryFollowup(clean)?'retry':'reference';
    return `${clean}\n\nPrevious XRAI context (mode: ${mode}; use this context automatically; do not ask the user to restate it):\nTask: ${priorTask||DEFAULT_REPO}\nResult: ${(priorResult||'No completed result was recorded.').slice(0,1600)}`;
  }catch{return clean}
}

if(typeof window!=='undefined'){
  purgeStaleUiState(window.localStorage);
  migrateLegacyUiState(window.localStorage);
}
