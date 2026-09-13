import { normalizeEvents } from './event-model.js';

const SELF_IMPROVE_RE=/\b(self[- ]?improv(?:e|ement|ing)|self[- ]?fix(?:ing)?|make\s+\d+\s+improvements?|prove\s+(?:that\s+)?self[- ]?improvement|improve\s+yourself)\b/i;
const CLAIM_RE=/\b(?:improvements? made|improved|optimized|learned|self[- ]?improved|fixed myself|retained improvement)\b/i;

export function verifiedImprovementsForRun(state,runId){
  return normalizeEvents(state?.events||[]).filter(e=>!runId||e.runId===runId).flatMap(e=>{
    const d=e.data||{};
    if(e.type!=='improvement:verified'||d.scope!=='sandbox'||!d.repo||!d.sha||!d.changedFiles?.length||!Array.isArray(d.commands)||!d.commands.length||!d.commands.every(c=>c.exitCode===0&&!c.timedOut))return [];
    return [{id:e.id,type:'code',summary:'Verified sandbox patch',files:d.changedFiles,repo:d.repo,sha:d.sha,verifier:'real command exit codes',retained:false,ts:e.ts}];
  });
}
export function formatVerifiedImprovementReport(records,requested){
  const rows=(records||[]).slice(-Math.max(1,Number(requested)||10));
  if(!rows.length)return '0 verified improvements are available. I will not invent improvements: model scores and promotion labels alone are not execution evidence.';
  return `${rows.length} verified sandbox patch${rows.length===1?'':'es'}:\n\n${rows.map((r,i)=>`${i+1}. ${r.repo}@${r.sha.slice(0,8)}: ${r.files.join(', ')}; ${r.verifier}`).join('\n')}\n\nThese changes were tested in an isolated browser sandbox. They were not committed, pushed, deployed, or installed into the running agent.`;
}

export function requestedImprovementCount(text=''){
  const m=String(text).match(/\b(\d+)\s+improvements?\b/i);return m?Math.max(1,Math.min(10,Number(m[1]))):null;
}

export function shouldGuardImprovementClaim(userText='',agentText=''){return SELF_IMPROVE_RE.test(String(userText))&&CLAIM_RE.test(String(agentText))}

