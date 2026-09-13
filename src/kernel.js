import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { bus } from './events.js';
import { appendLesson,searchKnowledge } from './knowledge.js';
import { outputText,response } from './openai.js';
import { runOllamaTask } from './ollama.js';
const execFileAsync=promisify(execFile);
const MODEL=()=>process.env.XRAI_MODEL||'gpt-5.6-luna';
const EFFORT=()=>process.env.XRAI_REASONING||'low';
function workspace(p){return path.resolve(p||process.env.XRAI_WORKSPACE||process.cwd())}
export async function primitiveShell(root,command,timeoutMs=120000){
  const cwd=workspace(root);const forbidden=/(^|[;&|]\s*)(sudo\b|rm\s+-rf\s+\/|shutdown\b|reboot\b|mkfs\b|dd\s+if=|:\(\)\s*\{)/i;
  if(forbidden.test(command))throw new Error('Blocked potentially destructive command.');
  const {stdout,stderr}=await execFileAsync('/bin/bash',['-lc',command],{cwd,timeout:timeoutMs,maxBuffer:2_000_000,env:{...process.env,XRAI_WORKSPACE:cwd}});return (stdout+(stderr?`\n[stderr]\n${stderr}`:'')).slice(-30000)||'Command completed with no output.'
}
export async function primitiveKnowledge(root,query,limit=5){const cwd=workspace(root);return searchKnowledge(query,[path.join(process.cwd(),'knowledge'),path.join(cwd,'knowledge'),path.join(cwd,'.xrai')],limit)}

const fn=(name,description,properties,required=[])=>({type:'function',name,description,parameters:{type:'object',properties,required,additionalProperties:false},strict:true});
const tools=[
  {type:'web_search'},
  fn('bash','Run a shell command rooted at the configured workspace. Use for repo inspection, coding, tests, and automation. Avoid destructive operations.',{command:{type:'string'},timeout_ms:{type:['integer','null'],minimum:1000,maximum:120000}},['command','timeout_ms']),
  fn('knowledge_search','Search the XRAI knowledgebase plus verified lessons from earlier successful runs.',{query:{type:'string'},limit:{type:['integer','null'],minimum:1,maximum:8}},['query','limit']),
  fn('delegate','Spawn one bounded child agent for a genuinely separable subtask.',{task:{type:'string'}},['task'])
];

export async function runTask(task,opts={}){
  if(!process.env.OPENAI_API_KEY && !opts.forceOpenAI)return runOllamaTask(task,opts,{primitiveShell,primitiveKnowledge});
  const runId=crypto.randomUUID(),root=workspace(opts.workspace),model=opts.model||MODEL(),maxDepth=opts.maxDepth??2,maxChildren=opts.maxChildren??2,retries=opts.retries??1,learn=opts.learn??true;
  bus.emitEvent(runId,'run:start',task,{data:{workspace:root,model,maxDepth,maxChildren,retries}});let attempts=0,finalOutput='',score=0;
  async function runAgent(agentTask,depth=0,parentAgentId){
    const agentId=crypto.randomUUID();let children=0;bus.emitEvent(runId,'agent:start',agentTask,{agentId,parentAgentId,name:depth?'Child agent':'Root agent'});
    let previous_response_id, input=agentTask;
    for(let turn=0;turn<32;turn++){
      const r=await response({model,reasoning:{effort:EFFORT()},instructions:`You are XRAI Agent, a compact execution agent. Complete the task end-to-end. Prefer evidence, inspect before editing, make minimal changes, test/verify, and report concrete results. Use XRAI knowledge when relevant. Delegate only for independent work. Never fabricate tool results. Workspace root: ${root}. The shell is workspace-rooted but not an OS sandbox, so do not access unrelated files.`,input,previous_response_id,tools,parallel_tool_calls:false,store:true});
      previous_response_id=r.id;const calls=(r.output||[]).filter(x=>x.type==='function_call');
      if(!calls.length){const out=outputText(r)||'Completed without a text response.';bus.emitEvent(runId,'agent:done',out.slice(0,900),{agentId,parentAgentId});return out}
      const outputs=[];
      for(const call of calls){let args={};try{args=JSON.parse(call.arguments||'{}')}catch{};bus.emitEvent(runId,'tool:start',`${call.name}: ${JSON.stringify(args).slice(0,500)}`,{agentId,name:call.name});let out;
        try{
          if(call.name==='bash')out=await primitiveShell(root,args.command,args.timeout_ms||120000);
          else if(call.name==='knowledge_search'){const hits=await primitiveKnowledge(root,args.query,args.limit||5);for(const h of hits)bus.emitEvent(runId,'knowledge:hit',`${path.basename(h.source)} · ${Math.round(h.score*100)}%`,{agentId,data:{source:h.source,score:h.score}});out=hits.length?hits.map((h,i)=>`[${i+1}] ${h.source}\n${h.text}`).join('\n\n'):'No relevant knowledge found.'}
          else if(call.name==='delegate'){if(depth>=maxDepth||children>=maxChildren)out='Delegation limit reached; continue yourself.';else{children++;bus.emitEvent(runId,'agent:delegate',args.task,{agentId,parentAgentId:agentId});out=await runAgent(args.task,depth+1,agentId)}}
          else out=`Unknown tool: ${call.name}`;
        }catch(e){out=`ERROR: ${e instanceof Error?e.message:String(e)}`}
        bus.emitEvent(runId,'tool:done',String(out).slice(0,800),{agentId,name:call.name,data:{ok:!String(out).startsWith('ERROR:')}});outputs.push({type:'function_call_output',call_id:call.call_id,output:String(out)});
      }
      input=outputs;
    }
    throw new Error('Agent exceeded 32 tool turns.');
  }
  async function evaluate(candidate){
    const schema={type:'object',properties:{score:{type:'number',minimum:0,maximum:1},critique:{type:'string'},lesson:{type:'string'},tags:{type:'array',items:{type:'string'},maxItems:8}},required:['score','critique','lesson','tags'],additionalProperties:false};
    const r=await response({model,reasoning:{effort:'low'},instructions:'Strictly grade the candidate against the user task. Score 1 only if complete and verified. Extract one reusable lesson only when evidence supports it. Never store secrets or personal data.',input:`TASK:\n${task}\n\nCANDIDATE:\n${candidate}`,text:{format:{type:'json_schema',name:'xrai_eval',schema,strict:true}},store:false});
    return JSON.parse(outputText(r));
  }
  let feedback='';
  while(attempts<=retries){attempts++;finalOutput=await runAgent(feedback?`${task}\n\nEvaluator feedback from the previous attempt:\n${feedback}\nFix only the identified gaps.`:task);const ev=await evaluate(finalOutput);score=ev.score;bus.emitEvent(runId,'eval',`Score ${Math.round(score*100)}% — ${ev.critique}`,{name:'Evaluator',data:ev});if(score>=.82||attempts>retries){if(learn&&score>=.82&&ev.lesson?.trim()){await appendLesson(root,{task:task.slice(0,500),lesson:ev.lesson,score,tags:ev.tags||[]});bus.emitEvent(runId,'learn',ev.lesson,{data:{tags:ev.tags||[]}})}break}feedback=ev.critique;bus.emitEvent(runId,'retry',feedback,{data:{attempt:attempts+1}})}
  bus.emitEvent(runId,'run:done',finalOutput.slice(0,1200),{data:{score,attempts}});return{runId,output:finalOutput,score,attempts,events:bus.forRun(runId)}
}
