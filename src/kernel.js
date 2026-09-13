import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { bus } from './events.js';
import { searchKnowledge } from './knowledge.js';
import { formatSkills,getMetaPolicy,observeSkillCandidate,recordRunOutcome,recordSkillUsage,retrieveSkills } from './skills.js';
import { outputText,response } from './openai.js';
import { runOllamaTask } from './ollama.js';
import { analyzeOrchestration } from './orchestration-policy.js';
const execFileAsync=promisify(execFile);
const MODEL=()=>process.env.XRAI_MODEL||'gpt-5.6-luna';
const EFFORT=()=>process.env.XRAI_REASONING||'low';
const clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
function workspace(p){return path.resolve(p||process.env.XRAI_WORKSPACE||process.cwd())}
export function summarizeTrace(events=[]){
  const rows=Array.isArray(events)?events:[],count=type=>rows.filter(e=>e?.type===type).length;
  const toolDone=rows.filter(e=>e?.type==='tool:done'),toolErrors=toolDone.filter(e=>e?.data?.ok===false||/^ERROR:/i.test(String(e?.summary||''))).length;
  return {toolCalls:count('tool:start'),toolErrors,delegations:count('agent:delegate'),knowledgeHits:count('knowledge:hit'),skillHits:count('skill:hit'),events:rows.length};
}
export async function primitiveShell(root,command,timeoutMs=120000){
  const cwd=workspace(root);const forbidden=/(^|[;&|]\s*)(sudo\b|rm\s+-rf\s+\/|shutdown\b|reboot\b|mkfs\b|dd\s+if=|:\(\)\s*\{)/i;
  if(forbidden.test(command))throw new Error('Blocked potentially destructive command.');
  const {stdout,stderr}=await execFileAsync('/bin/bash',['-lc',command],{cwd,timeout:timeoutMs,maxBuffer:2_000_000,env:{...process.env,XRAI_WORKSPACE:cwd}});return (stdout+(stderr?`\n[stderr]\n${stderr}`:'')).slice(-30000)||'Command completed with no output.'
}
export async function primitiveKnowledge(root,query,limit=5){
  const cwd=workspace(root),kb=await searchKnowledge(query,[path.join(process.cwd(),'knowledge'),path.join(cwd,'knowledge')],limit),skills=await retrieveSkills(cwd,query,limit);
  return [...kb,...skills.map(s=>({source:`skill:${s.id}@v${s.version}`,text:`${s.title}\nWHEN: ${s.trigger}\nDO: ${s.procedure}${s.verifier?`\nVERIFY: ${s.verifier}`:''}`,score:s.score}))].sort((a,b)=>b.score-a.score).slice(0,limit)
}

const fn=(name,description,properties,required=[])=>({type:'function',name,description,parameters:{type:'object',properties,required,additionalProperties:false},strict:true});
const tools=[
  {type:'web_search'},
  fn('bash','Run a shell command rooted at the configured workspace. Use for repo inspection, coding, tests, and automation. Avoid destructive operations.',{command:{type:'string'},timeout_ms:{type:['integer','null'],minimum:1000,maximum:120000}},['command','timeout_ms']),
  fn('knowledge_search','Search the XRAI knowledgebase plus promoted evidence-gated skills from earlier successful runs.',{query:{type:'string'},limit:{type:['integer','null'],minimum:1,maximum:8}},['query','limit']),
  fn('delegate','Spawn one bounded child agent for a genuinely separable subtask.',{task:{type:'string'}},['task'])
];

export async function runTask(task,opts={}){
  if(!process.env.OPENAI_API_KEY && !opts.forceOpenAI)return runOllamaTask(task,opts,{primitiveShell,primitiveKnowledge});
  const runId=opts.runId||crypto.randomUUID(),root=workspace(opts.workspace),model=opts.model||MODEL(),requestedDepth=opts.maxDepth??Number(process.env.XRAI_MAX_DEPTH||2),requestedChildren=opts.maxChildren??Number(process.env.XRAI_MAX_CHILDREN||2),requestedRetries=opts.retries??Number(process.env.XRAI_MAX_RETRIES||1),learn=opts.learn??true;
  const policy=analyzeOrchestration(task,{maxDepth:requestedDepth,maxChildren:requestedChildren,maxRetries:requestedRetries}),maxDepth=policy.depth,maxChildren=policy.children,retries=policy.retries;
  const promotedSkills=await retrieveSkills(root,task,4),meta=await getMetaPolicy(root),skillContext=formatSkills(promotedSkills),metaGuidance=(meta.guidance||[]).join(' ');
  bus.emitEvent(runId,'run:start',task,{data:{workspace:root,model,maxDepth,maxChildren,retries,skills:promotedSkills.map(s=>`${s.id}@v${s.version}`),policy}});
  bus.emitEvent(runId,'orchestration:policy',`model-led · caps depth ${policy.depth} · children ${policy.children} · retries ${policy.retries} · turns ${policy.maxTurns}`,{name:'Model-led orchestration',data:policy});
  for(const s of promotedSkills)bus.emitEvent(runId,'skill:hit',`${s.title} · ${Math.round(s.score*100)}%`,{name:'Promoted skill',data:{id:s.id,version:s.version,score:s.score,confidence:s.confidence}});
  let attempts=0,finalOutput='',score=0,finalEval=null,previousScore=null;
  async function runAgent(agentTask,depth=0,parentAgentId){
    const agentId=crypto.randomUUID();let children=0;bus.emitEvent(runId,'agent:start',agentTask,{agentId,parentAgentId,name:depth?'Child agent':'Root agent'});
    let previous_response_id,input=agentTask;
    for(let turn=0;turn<policy.maxTurns;turn++){
      const r=await response({model,reasoning:{effort:process.env.XRAI_REASONING||policy.reasoning||EFFORT()},instructions:`You are XRAI Agent, a compact execution agent. Complete the task end-to-end. You own planning, decomposition, tool choice, and whether delegation is useful. Prefer evidence, inspect before editing, make minimal changes, test/verify, and report concrete results. Never fabricate tool results. Delegate only when you judge the work genuinely separable and worth the added latency; the runtime caps are safety ceilings, not a prescribed workflow. Workspace root: ${root}. The shell is workspace-rooted but not an OS sandbox, so do not access unrelated files.\n\nPROMOTED SKILLS (reuse only when relevant; evidence outranks memory):\n${skillContext}\n\nMETA-SKILL GUIDANCE:\n${metaGuidance}`,input,previous_response_id,tools,parallel_tool_calls:false,store:true});
      previous_response_id=r.id;const calls=(r.output||[]).filter(x=>x.type==='function_call');
      if(!calls.length){const out=outputText(r)||'Completed without a text response.';bus.emitEvent(runId,'agent:done',out.slice(0,900),{agentId,parentAgentId});return out}
      const outputs=[];
      for(const call of calls){let args={};try{args=JSON.parse(call.arguments||'{}')}catch{};bus.emitEvent(runId,'tool:start',`${call.name}: ${JSON.stringify(args).slice(0,500)}`,{agentId,name:call.name});let out;
        try{
          if(call.name==='bash')out=await primitiveShell(root,args.command,args.timeout_ms||120000);
          else if(call.name==='knowledge_search'){const hits=await primitiveKnowledge(root,args.query,args.limit||5);for(const h of hits)bus.emitEvent(runId,h.source.startsWith('skill:')?'skill:hit':'knowledge:hit',`${path.basename(h.source)} · ${Math.round(h.score*100)}%`,{agentId,data:{source:h.source,score:h.score}});out=hits.length?hits.map((h,i)=>`[${i+1}] ${h.source}\n${h.text}`).join('\n\n'):'No relevant knowledge found.'}
          else if(call.name==='delegate'){if(depth>=maxDepth||children>=maxChildren)out='Delegation limit reached; continue yourself.';else{children++;bus.emitEvent(runId,'agent:delegate',args.task,{agentId,parentAgentId:agentId});out=await runAgent(args.task,depth+1,agentId)}}
          else out=`Unknown tool: ${call.name}`;
        }catch(e){out=`ERROR: ${e instanceof Error?e.message:String(e)}`}
        bus.emitEvent(runId,'tool:done',String(out).slice(0,800),{agentId,name:call.name,data:{ok:!String(out).startsWith('ERROR:')}});outputs.push({type:'function_call_output',call_id:call.call_id,output:String(out)});
      }
      input=outputs;
    }
    throw new Error(`Agent exceeded model-led ${policy.maxTurns}-turn safety ceiling.`);
  }
  async function evaluate(candidate,trace){
    const skillSchema={type:'object',properties:{title:{type:'string'},trigger:{type:'string'},procedure:{type:'string'},verifier:{type:'string'},tags:{type:'array',items:{type:'string'},maxItems:8}},required:['title','trigger','procedure','verifier','tags'],additionalProperties:false};
    const schema={type:'object',properties:{score:{type:'number',minimum:0,maximum:1},pathScore:{type:'number',minimum:0,maximum:1},critique:{type:'string'},pathCritique:{type:'string'},skill:{...skillSchema}},required:['score','pathScore','critique','pathCritique','skill'],additionalProperties:false};
    const r=await response({model,reasoning:{effort:'low'},instructions:`Strictly grade both the final result and the execution path against the user task. Result score measures completeness and correctness. Path score measures whether the agent used grounded evidence, appropriate tools, verification, and an efficient non-looping route; tool errors or unsupported claims should lower it, while necessary exploration should not. Penalize unnecessary delegation or retries that did not add evidence. Score 1 only when the result is complete and the path is well-grounded and verified. If and only if a reusable procedure is supported by this run, propose one narrow skill. A skill must contain no secrets or personal data. Use an empty title/trigger/procedure/verifier/tags when no reusable skill is justified. The verifier, when present, should be one safe test/check/lint/build command that directly validates the procedure. ${metaGuidance}`,input:`TASK:\n${task}\n\nCANDIDATE:\n${candidate}\n\nEXECUTION TRACE SUMMARY:\n${JSON.stringify(trace)}`,text:{format:{type:'json_schema',name:'xrai_eval',schema,strict:true}},store:false});
    const ev=JSON.parse(outputText(r));ev.score=clamp(ev.score);ev.pathScore=clamp(ev.pathScore);ev.compositeScore=Math.min(ev.score,ev.pathScore+.15);return ev;
  }
  let feedback='';
  while(attempts<=retries){
    attempts++;const eventStart=bus.forRun(runId).length;finalOutput=await runAgent(feedback?`${task}\n\nEvaluator feedback from the previous attempt:\n${feedback}\nFix only the identified gaps.`:task);const trace=summarizeTrace(bus.forRun(runId).slice(eventStart));finalEval=await evaluate(finalOutput,trace);score=finalEval.compositeScore;bus.emitEvent(runId,'eval',`Result ${Math.round(finalEval.score*100)}% · path ${Math.round(finalEval.pathScore*100)}% · composite ${Math.round(score*100)}% — ${finalEval.critique}`,{name:'Evaluator',data:{...finalEval,trace}});
    if(previousScore===null)bus.emitEvent(runId,'improvement:baseline',`Baseline ${Math.round(score*100)}%`,{name:'Improvement loop',data:{score,attempt:attempts}});
    else if(score>previousScore+.005)bus.emitEvent(runId,'improvement:accept',`Improved ${Math.round((score-previousScore)*100)} points to ${Math.round(score*100)}%`,{name:'Improvement loop',data:{score,previousScore,attempt:attempts}});
    else{bus.emitEvent(runId,'improvement:stop',`No meaningful gain (${Math.round(previousScore*100)}% → ${Math.round(score*100)}%); stopping to avoid waste.`,{name:'Improvement loop',data:{score,previousScore,attempt:attempts}});break}
    if(score>=meta.minScore||attempts>retries)break;previousScore=score;feedback=`${finalEval.critique}\nExecution-path critique: ${finalEval.pathCritique}`;bus.emitEvent(runId,'retry',feedback,{data:{attempt:attempts+1,previousScore}})
  }
  await recordSkillUsage(root,promotedSkills,score);
  let learning={status:'disabled'};
  if(learn&&score>=meta.minScore&&finalEval?.skill){
    learning=await observeSkillCandidate(root,finalEval.skill,{task,score,verify:cmd=>primitiveShell(root,cmd,120000)});
    const title=learning.skill?.title||finalEval.skill.title||'Skill';
    bus.emitEvent(runId,`skill:${learning.status}`,`${title} — ${learning.reason}`,{name:'Skill gate',data:{id:learning.id,version:learning.version,status:learning.status,verified:learning.verified,supportCount:learning.supportCount,baseline:learning.baseline,candidateScore:learning.candidateScore}});
  }
  const maintenance=await recordRunOutcome(root,{task,score,skills:promotedSkills,candidateDecision:learning,policy});if(maintenance)bus.emitEvent(runId,'meta:update',`Meta-skill v${maintenance.meta.version} · avg score ${Math.round(maintenance.meta.metrics.avgScore*100)}%${maintenance.actions.length?` · ${maintenance.actions.join(', ')}`:''}`,{name:'Slow learning loop',data:maintenance});
  bus.emitEvent(runId,'run:done',finalOutput.slice(0,1200),{data:{score,attempts,learning:learning.status,pathScore:finalEval?.pathScore,policy}});return{runId,output:finalOutput,score,attempts,learning,events:bus.forRun(runId)}
}
