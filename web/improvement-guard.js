import { UI_STATE_KEY } from './state.js';
import { normalizeEvents } from './event-model.js';

const SELF_IMPROVE_RE=/\b(self[- ]?improv(?:e|ement|ing)|self[- ]?fix(?:ing)?|make\s+\d+\s+improvements?|prove\s+(?:that\s+)?self[- ]?improvement|improve\s+yourself)\b/i;
const CLAIM_RE=/\b(?:improvements? made|improved|optimized|learned|self[- ]?improved|fixed myself|retained improvement)\b/i;

const readState=storage=>{try{return JSON.parse(storage?.getItem(UI_STATE_KEY)||'null')}catch{return null}};
const pct=n=>Number.isFinite(Number(n))?`${Math.round(Number(n)*100)}%`:null;

export function verifiedImprovementsForRun(state,runId){
  const events=normalizeEvents(state?.events||[]).filter(e=>!runId||e.runId===runId),out=[];
  for(const e of events){
    if(e.type==='improvement:accept'){
      out.push({id:e.id,type:'attempt',summary:e.summary||'Verified retry improvement',baseline:e.evidence?.baseline??e.data?.baseline,candidate:e.evidence?.candidate??e.data?.candidate,delta:e.evidence?.delta??e.data?.delta,verifier:e.evidence?.verifier??e.data?.verifier,files:(e.evidence?.changedFiles??e.data?.changedFiles??[]),retained:true,ts:e.ts});
    }else if(e.type==='skill:promoted'){
      out.push({id:e.id,type:'skill',summary:e.summary||'Verified skill promotion',baseline:e.evidence?.baseline??e.data?.baseline,candidate:e.evidence?.candidateScore??e.data?.candidateScore,skillId:e.data?.id,version:e.data?.version,verifier:e.data?.verified?'safe verifier':'repeated successful support',retained:true,ts:e.ts});
    }else if(e.type==='run:done'&&Array.isArray(e.evidence?.changedFiles||e.data?.changedFiles)&&(e.evidence?.changedFiles||e.data?.changedFiles).length&&Number(e.evidence?.score??e.data?.score)>=1){
      const files=e.evidence?.changedFiles||e.data?.changedFiles;out.push({id:e.id,type:'code',summary:`Verified sandbox change${files.length===1?'':'s'}`,candidate:1,files,verifier:'real command exit codes',retained:true,ts:e.ts});
    }
  }
  const seen=new Set();return out.filter(x=>{const key=`${x.type}:${x.skillId||''}:${x.version||''}:${x.summary}:${(x.files||[]).join(',')}`;if(seen.has(key))return false;seen.add(key);return true});
}

export function formatVerifiedImprovementReport(records,requested){
  const rows=Array.isArray(records)?records:[],n=rows.length,limit=Math.max(1,Number(requested)||n||1);
  if(!n)return `0 verified improvements were retained in this run. I will not claim self-improvement without machine-verifiable before/after evidence. Ask me to improve the XRAI repo explicitly if you want code changes that can be tested in the sandbox.`;
  const shown=rows.slice(0,limit).map((r,i)=>{
    const bits=[];if(r.baseline!=null)bits.push(`baseline ${pct(r.baseline)}`);if(r.candidate!=null)bits.push(`candidate ${pct(r.candidate)}`);if(r.delta!=null)bits.push(`delta +${pct(r.delta)}`);if(r.skillId)bits.push(`${r.skillId}@v${r.version}`);if(r.files?.length)bits.push(`files: ${r.files.join(', ')}`);if(r.verifier)bits.push(`evidence: ${r.verifier}`);
    return `${i+1}. ${r.summary}${bits.length?` — ${bits.join(' · ')}`:''}`;
  });
  return `${shown.length} verified retained improvement${shown.length===1?'':'s'}:\n\n${shown.join('\n')}\n\nOnly retained improvements backed by structured execution evidence are counted.`;
}

export function requestedImprovementCount(text=''){
  const m=String(text).match(/\b(?:make|do|prove)[^\d]{0,30}(\d+)\s+improvements?\b/i);return m?Math.max(1,Math.min(10,Number(m[1]))):null;
}

export function shouldGuardImprovementClaim(userText='',agentText=''){return SELF_IMPROVE_RE.test(String(userText))&&CLAIM_RE.test(String(agentText))}

function repairLatestClaim(storage=globalThis.localStorage){
  const state=readState(storage);if(!state?.messages?.length)return false;
  const agentIndex=[...state.messages].map((m,i)=>({m,i})).reverse().find(x=>x.m?.role==='agent')?.i;if(agentIndex==null)return false;
  const userIndex=[...state.messages].slice(0,agentIndex).map((m,i)=>({m,i})).reverse().find(x=>x.m?.role==='user')?.i;if(userIndex==null)return false;
  const user=state.messages[userIndex],agent=state.messages[agentIndex];if(!shouldGuardImprovementClaim(user.text,agent.text))return false;
  const records=verifiedImprovementsForRun(state,agent.runId||state.activeRunId),replacement=formatVerifiedImprovementReport(records,requestedImprovementCount(user.text));
  if(agent.text===replacement)return false;agent.text=replacement;try{storage?.setItem(UI_STATE_KEY,JSON.stringify(state))}catch{}
  const bubbles=[...document.querySelectorAll('#messages .msg.agent .bubble p')];if(bubbles.length)bubbles.at(-1).textContent=replacement;return true;
}

if(typeof window!=='undefined'&&typeof document!=='undefined'){
  const observer=new MutationObserver(()=>repairLatestClaim(window.localStorage));observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  queueMicrotask(()=>repairLatestClaim(window.localStorage));
}
