import { loadUiState } from './state.js';
import { formatWebResults,searchWeb } from './web-search.js';

const CAPABILITY_RE=/\b(capabilit(?:y|ies)|what can (?:you|it|xrai)|can (?:you|it|xrai)|features?|tools?)\b/i;
const WEB_RE=/\b(web search|search the web|search online|search the internet|look up online|research online|internet search)\b/i;
const FRESH_RE=/\b(latest|current|today|recent|up[- ]?to[- ]?date|this week|this month)\b/i;
const ADD_WEB_RE=/\b(add|create|install|enable|implement)\b[\s\S]{0,80}\b(web search|search skill|internet search)\b/i;
const SELF_IMPROVE_PROOF_RE=/\b(show|list|report|summari[sz]e|what|which|evidence|proof|prove)\b[\s\S]{0,80}\b(self[- ]?improv(?:e|ement|ing)|self[- ]?fix(?:ing)?|improvements?|retained changes?|learned)\b/i;
const SELF_IMPROVE_ACTION_RE=/\b(make|making|do|perform|implement|apply|fix|improve|refactor|change|update)\b[\s\S]{0,80}\b(?:\d+\s+)?(?:self[- ]?improvements?|improvements?|fixes?|changes?|yourself|xrai)\b/i;
const EVAL_KEYS=new Set(['score','critique','work_product','skills','missing_elements']);
const CONTEXT_MARKER='\n\nPrevious XRAI context';

export const CAPABILITIES=[
  ['On-device chat/reasoning','Runs locally in supported browsers; no user model API key required.'],
  ['No-key web research','Federated live search across no-key public sources with parallel fallbacks and source URLs.'],
  ['XRAI knowledge retrieval','Uses the bundled XRAI knowledgebase plus promoted evidence-gated skills.'],
  ['Public repo execution','Imports public Node/JS/TS repos into an isolated WebContainer on supported modern browsers; mobile support is beta and memory-limited.'],
  ['Real verification','Runs actual package test/check/lint/build commands and trusts exit codes over model confidence.'],
  ['Bounded repair + patch','Makes constrained sandbox edits, re-verifies, and produces a downloadable patch.'],
  ['Visible orchestration','Shows observable agents, tools, retrieval, verification, retries, and learning events.'],
  ['Evidence-gated learning','Candidate skills require concrete evidence or repeated independent successful support; bad versions can roll back.'],
  ['Durable browser state','Tasks, messages, results, visible events, and recovery state survive reload/page eviction.'],
  ['MCP / CLI / local host','Can also run through MCP, CLI, optional Ollama, or an optional hosted OpenAI model.']
];

export function classifyBuiltinTask(task=''){
  const text=String(task).split(CONTEXT_MARKER,1)[0].trim();
  if(SELF_IMPROVE_PROOF_RE.test(text)&&!SELF_IMPROVE_ACTION_RE.test(text))return'self-improvement-proof';
  const asksCapabilities=CAPABILITY_RE.test(text),asksWeb=WEB_RE.test(text),asksAddWeb=ADD_WEB_RE.test(text);
  const needsFresh=FRESH_RE.test(text)&&/\b(find|search|research|news|status|version|release|best|popular|state of the art|repo|github)\b/i.test(text);
  if(asksCapabilities&&(asksWeb||asksAddWeb))return'capabilities+web';
  if(asksCapabilities)return'capabilities';
  if(asksWeb||needsFresh)return'web-search';
  return null;
}

export function extractSearchQuery(task=''){
  let q=String(task).split(CONTEXT_MARKER,1)[0].trim();
  q=q.replace(/^(?:please\s+)?(?:search the web|search online|search the internet|look up online|research online|internet search)\s*(?:for|about|on)?\s*/i,'');
  q=q.replace(/\b(if not|if it cannot|if you cannot)[\s\S]*$/i,'').trim();
  q=q.replace(/\s+(?:and|,)\s+(?:please\s+)?(?:give|include|list|return|show|provide)\s+(?:me\s+)?(?:the\s+)?(?:source\s+urls?|sources?|citations?|links?)[.!?]*$/i,'').trim();
  return q||String(task).split(CONTEXT_MARKER,1)[0].trim();
}

export function capabilityText({webEvidence}={}){
  const list=CAPABILITIES.map(([name,detail])=>`• ${name}: ${detail}`).join('\n');
  const proof=webEvidence?`\n\nWeb-search smoke check: ${webEvidence.results.length} relevant result(s) from ${webEvidence.contributingProviders||0} contributing provider(s); ${webEvidence.providers}/${webEvidence.attemptedProviders} responded in ${webEvidence.latencyMs} ms.`:'';
  return `XRAI's current capabilities:\n\n${list}\n\nYes — web search is a real built-in runtime tool now. It does not require SerpAPI, Redis, Python, a local install, or a user API key. It searches multiple no-key sources in parallel and returns source URLs; unavailable providers fail independently instead of taking the run down.${proof}\n\nCurrent public-browser boundaries: anonymous mode does not push to GitHub, private repos require an authorized lane, and WebContainer repo execution is intentionally limited to compatible web/Node toolchains.`;
}

export function isEvaluatorArtifact(text=''){
  const raw=String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  if(!raw.startsWith('{'))return false;
  try{const value=JSON.parse(raw);const keys=Object.keys(value);return keys.some(k=>EVAL_KEYS.has(k))&&(keys.includes('score')||keys.includes('critique'))}catch{return false}
}

function improvementEvidenceFromState(storage=globalThis.localStorage){
  const state=loadUiState(storage),rows=Array.isArray(state?.events)?state.events:[],out=[];
  for(const e of rows.slice(-300)){
    if(e?.type==='improvement:accept')out.push({summary:e.summary||'Verified retry improvement',baseline:e.data?.baseline??e.evidence?.baseline,candidate:e.data?.candidate??e.evidence?.candidate,delta:e.data?.delta??e.evidence?.delta,evidence:(e.data?.verifier??e.evidence?.verifier??'structured improvement event')});
    else if(e?.type==='skill:promoted')out.push({summary:e.summary||'Verified skill promotion',baseline:e.data?.baseline??e.evidence?.baseline,candidate:e.data?.candidateScore??e.evidence?.candidateScore,evidence:e.data?.verified?'safe verifier':'repeated successful support',skill:e.data?.id&&e.data?.version?`${e.data.id}@v${e.data.version}`:null});
  }
  return out.slice(-10);
}
function requestedCount(task=''){const m=String(task).match(/\b(\d+)\s+improvements?\b/i);return m?Math.max(1,Math.min(10,Number(m[1]))):3}
function improvementProofText(task,storage=globalThis.localStorage){
  const requested=requestedCount(task),rows=improvementEvidenceFromState(storage).slice(-requested);
  if(!rows.length)return `0 verified improvements are available as evidence for this request. I will not invent improvements. In public browser mode, ask me to improve the XRAI repo explicitly when you want code changes that can be executed and tested in the sandbox.`;
  const fmt=n=>Number.isFinite(Number(n))?`${Math.round(Number(n)*100)}%`:null;
  return `${rows.length} verified retained improvement${rows.length===1?'':'s'} found in structured XRAI state:\n\n${rows.map((r,i)=>{const bits=[];if(r.baseline!=null)bits.push(`baseline ${fmt(r.baseline)}`);if(r.candidate!=null)bits.push(`candidate ${fmt(r.candidate)}`);if(r.delta!=null)bits.push(`delta +${fmt(r.delta)}`);if(r.skill)bits.push(r.skill);if(r.evidence)bits.push(`evidence: ${r.evidence}`);return `${i+1}. ${r.summary}${bits.length?` — ${bits.join(' · ')}`:''}`}).join('\n')}\n\nThese are reported from retained events, not model-authored claims.`;
}

export async function runBuiltinTask(task,{emit=()=>{},progress=()=>{},fetchFn=globalThis.fetch,storage=globalThis.localStorage}={}){
  const kind=classifyBuiltinTask(task);if(!kind)return null;
  const runId=globalThis.crypto?.randomUUID?.()||`xrai-${Date.now().toString(36)}`;
  const event=(type,summary,meta={})=>emit({id:globalThis.crypto?.randomUUID?.()||`${runId}-${Math.random()}`,runId,ts:new Date().toISOString(),type,summary,...meta});
  event('run:start',task,{data:{provider:'browser-tools'}});
  if(kind==='self-improvement-proof'){
    const output=improvementProofText(task,storage);const count=(output.match(/^\d+/)||['0'])[0];event('tool:done',`${count} retained improvement records found`,{name:'improvement_evidence',data:{count:Number(count)}});event('run:done',output.slice(0,1200),{data:{score:1,attempts:1,provider:'browser-tools',learning:'evidence-only'}});return{runId,output,score:1,attempts:1,provider:'browser-tools',learning:{status:'evidence-only'}};
  }
  if(kind==='capabilities'){
    const output=capabilityText();event('tool:done','Grounded runtime capability inventory',{name:'capabilities',data:{count:CAPABILITIES.length}});event('run:done',output.slice(0,1200),{data:{score:1,attempts:1,provider:'browser-tools'}});return{runId,output,score:1,attempts:1,provider:'browser-tools',learning:{status:'none'}};
  }
  if(kind==='capabilities+web'){
    progress('Verifying live web-search capability…');event('tool:start','Running no-key web-search smoke check',{name:'web_search'});
    const evidence=await searchWeb('state of the art AI agent orchestration 2026',{fetchFn,limit:4});event('tool:done',`${evidence.results.length} relevant web results · ${evidence.contributingProviders||0} contributing · ${evidence.providers}/${evidence.attemptedProviders} responsive`,{name:'web_search',data:evidence});
    const output=capabilityText({webEvidence:evidence});event('run:done',output.slice(0,1200),{data:{score:evidence.results.length?1:.85,attempts:1,provider:'browser-tools'}});return{runId,output,score:evidence.results.length?1:.85,attempts:1,provider:'browser-tools',learning:{status:'built-in'}};
  }
  const query=extractSearchQuery(task);progress(`Searching the web for “${query}”…`);event('tool:start',query,{name:'web_search'});
  const search=await searchWeb(query,{fetchFn});event('tool:done',`${search.results.length} relevant results · ${search.contributingProviders||0} contributing · ${search.providers}/${search.attemptedProviders} responsive · ${search.latencyMs} ms`,{name:'web_search',data:search});
  const output=formatWebResults(search);event('run:done',output.slice(0,1200),{data:{score:search.results.length?1:0,attempts:1,provider:'browser-tools'}});return{runId,output,score:search.results.length?1:0,attempts:1,provider:'browser-tools',learning:{status:'none'}};
}
