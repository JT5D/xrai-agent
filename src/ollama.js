import path from 'node:path';
import { bus } from './events.js';
import { formatSkills,getMetaPolicy,observeSkillCandidate,recordRunOutcome,recordSkillUsage,retrieveSkills } from './skills.js';
const HOST=()=>process.env.OLLAMA_HOST||'http://127.0.0.1:11434';

async function request(route,body,timeout=120000){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
  try{const r=await fetch(`${HOST()}${route}`,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:c.signal});const data=await r.json();if(!r.ok)throw new Error(data?.error||`Ollama ${r.status}`);return data}finally{clearTimeout(t)}
}
export async function detectOllama(){
  try{const data=await request('/api/tags',null,1200),names=(data.models||[]).map(x=>x.name).filter(Boolean);const preferred=process.env.XRAI_LOCAL_MODEL||names.find(n=>/^qwen3(?::|$)/i.test(n))||names.find(n=>/qwen.*coder|llama3\.1|llama4|devstral/i.test(n))||names[0];return preferred?{available:true,model:preferred,models:names}:{available:false,reason:'Ollama is running but has no local models.'}}catch{return{available:false,reason:'Ollama is not running.'}}
}
const tool=(name,description,properties,required=[])=>({type:'function',function:{name,description,parameters:{type:'object',properties,required,additionalProperties:false}}});
const tools=[
  tool('bash','Run a shell command rooted at the configured workspace for inspection, editing, tests, and automation.',{command:{type:'string'},timeout_ms:{type:'integer'}},['command']),
  tool('knowledge_search','Search XRAI knowledge and promoted evidence-gated skills.',{query:{type:'string'},limit:{type:'integer'}},['query']),
  tool('delegate','Spawn one bounded child agent for a genuinely separable subtask.',{task:{type:'string'}},['task'])
];

export async function runOllamaTask(task,opts,{primitiveShell,primitiveKnowledge}){
  const found=await detectOllama();if(!found.available)throw new Error(`${found.reason} No API key is required: use the GitHub Pages browser agent, or install Ollama and run \`ollama pull qwen3:0.6b\`.`);
  const runId=crypto.randomUUID(),root=path.resolve(opts.workspace||process.env.XRAI_WORKSPACE||process.cwd()),model=opts.model||found.model,maxDepth=opts.maxDepth??Number(process.env.XRAI_MAX_DEPTH||2),maxChildren=opts.maxChildren??Number(process.env.XRAI_MAX_CHILDREN||2),retries=opts.retries??Number(process.env.XRAI_MAX_RETRIES||1),learn=opts.learn??true;
  const promotedSkills=await retrieveSkills(root,task,4),meta=await getMetaPolicy(root),skillContext=formatSkills(promotedSkills),metaGuidance=(meta.guidance||[]).join(' ');
  bus.emitEvent(runId,'run:start',task,{data:{workspace:root,model:`ollama:${model}`,maxDepth,maxChildren,retries,skills:promotedSkills.map(s=>`${s.id}@v${s.version}`)}});for(const s of promotedSkills)bus.emitEvent(runId,'skill:hit',`${s.title} · ${Math.round(s.score*100)}%`,{name:'Promoted skill',data:{id:s.id,version:s.version,score:s.score,confidence:s.confidence}});
  let attempts=0,finalOutput='',score=0,finalEval=null;
  async function chat(messages,extra={}){return request('/api/chat',{model,messages,stream:false,think:false,options:{num_ctx:Number(process.env.XRAI_LOCAL_CONTEXT||32768)},...extra})}
  async function runAgent(agentTask,depth=0,parentAgentId){
    const agentId=crypto.randomUUID();let children=0;bus.emitEvent(runId,'agent:start',agentTask,{agentId,parentAgentId,name:depth?'Child agent':'Root agent'});
    const messages=[{role:'system',content:`You are XRAI Agent, a compact execution agent. Complete tasks end-to-end. Inspect before editing, prefer evidence, make minimal changes, test/verify, and never fabricate tool results. Workspace root: ${root}. Use tools as needed. Delegate only independent work.\n\nPROMOTED SKILLS (reuse only when relevant; evidence outranks memory):\n${skillContext}\n\nMETA-SKILL GUIDANCE:\n${metaGuidance}`},{role:'user',content:agentTask}];
    for(let turn=0;turn<32;turn++){
      const r=await chat(messages,{tools}),m=r.message||{role:'assistant',content:''};messages.push(m);const calls=m.tool_calls||[];
      if(!calls.length){const out=m.content||'Completed without a text response.';bus.emitEvent(runId,'agent:done',out.slice(0,900),{agentId,parentAgentId});return out}
      for(const call of calls){const name=call?.function?.name,args=call?.function?.arguments||{};bus.emitEvent(runId,'tool:start',`${name}: ${JSON.stringify(args).slice(0,500)}`,{agentId,name});let out;
        try{
          if(name==='bash')out=await primitiveShell(root,args.command,args.timeout_ms||120000);
          else if(name==='knowledge_search'){const hits=await primitiveKnowledge(root,args.query,args.limit||5);for(const h of hits)bus.emitEvent(runId,h.source.startsWith('skill:')?'skill:hit':'knowledge:hit',`${path.basename(h.source)} · ${Math.round(h.score*100)}%`,{agentId,data:{source:h.source,score:h.score}});out=hits.length?hits.map((h,i)=>`[${i+1}] ${h.source}\n${h.text}`).join('\n\n'):'No relevant knowledge found.'}
          else if(name==='delegate'){if(depth>=maxDepth||children>=maxChildren)out='Delegation limit reached; continue yourself.';else{children++;bus.emitEvent(runId,'agent:delegate',args.task,{agentId,parentAgentId:agentId});out=await runAgent(args.task,depth+1,agentId)}}
          else out=`Unknown tool: ${name}`;
        }catch(e){out=`ERROR: ${e instanceof Error?e.message:String(e)}`}
        bus.emitEvent(runId,'tool:done',String(out).slice(0,800),{agentId,name,data:{ok:!String(out).startsWith('ERROR:')}});messages.push({role:'tool',tool_name:name,content:String(out)});
      }
    }
    throw new Error('Local agent exceeded 32 tool turns.');
  }
  async function evaluate(candidate){
    const skillSchema={type:'object',properties:{title:{type:'string'},trigger:{type:'string'},procedure:{type:'string'},verifier:{type:'string'},tags:{type:'array',items:{type:'string'}}},required:['title','trigger','procedure','verifier','tags'],additionalProperties:false};
    const schema={type:'object',properties:{score:{type:'number'},critique:{type:'string'},skill:skillSchema},required:['score','critique','skill'],additionalProperties:false};
    const r=await chat([{role:'system',content:`Strictly grade the candidate against the task. Return only valid JSON. Score >= 0.82 only when complete and verified. If a reusable procedure is supported, propose one narrow skill with title, trigger, procedure, verifier, tags. Otherwise return empty strings and tags. Never store secrets or personal data. Prefer a safe test/check/lint/build verifier. ${metaGuidance}`},{role:'user',content:`TASK:\n${task}\n\nCANDIDATE:\n${candidate}`}],{format:schema});
    let ev;try{ev=JSON.parse(r.message?.content||'{}')}catch{ev={score:0,critique:'Evaluator returned invalid JSON; no learning is allowed from this attempt.',skill:{title:'',trigger:'',procedure:'',verifier:'',tags:[]}}}ev.score=Math.max(0,Math.min(1,Number(ev.score)||0));return ev;
  }
  let feedback='';
  while(attempts<=retries){attempts++;finalOutput=await runAgent(feedback?`${task}\n\nEvaluator feedback from the previous attempt:\n${feedback}\nFix only the identified gaps.`:task);finalEval=await evaluate(finalOutput);score=finalEval.score;bus.emitEvent(runId,'eval',`Score ${Math.round(score*100)}% — ${finalEval.critique}`,{name:'Evaluator',data:finalEval});if(score>=meta.minScore||attempts>retries)break;feedback=finalEval.critique;bus.emitEvent(runId,'retry',feedback,{data:{attempt:attempts+1}})}
  await recordSkillUsage(root,promotedSkills,score);let learning={status:'disabled'};
  if(learn&&score>=meta.minScore&&finalEval?.skill){learning=await observeSkillCandidate(root,finalEval.skill,{task,score,verify:cmd=>primitiveShell(root,cmd,120000)});const title=learning.skill?.title||finalEval.skill.title||'Skill';bus.emitEvent(runId,`skill:${learning.status}`,`${title} — ${learning.reason}`,{name:'Skill gate',data:{id:learning.id,version:learning.version,status:learning.status,verified:learning.verified,supportCount:learning.supportCount}})}
  const maintenance=await recordRunOutcome(root,{task,score,skills:promotedSkills,candidateDecision:learning});if(maintenance)bus.emitEvent(runId,'meta:update',`Meta-skill v${maintenance.meta.version} · avg score ${Math.round(maintenance.meta.metrics.avgScore*100)}%${maintenance.actions.length?` · ${maintenance.actions.join(', ')}`:''}`,{name:'Slow learning loop',data:maintenance});
  bus.emitEvent(runId,'run:done',finalOutput.slice(0,1200),{data:{score,attempts,provider:`ollama:${model}`,learning:learning.status}});return{runId,output:finalOutput,score,attempts,provider:`ollama:${model}`,learning,events:bus.forRun(runId)};
}
