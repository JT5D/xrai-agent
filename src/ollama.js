import path from 'node:path';
import { bus } from './events.js';
import { appendLesson } from './knowledge.js';
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
  tool('knowledge_search','Search XRAI knowledge and verified lessons.',{query:{type:'string'},limit:{type:'integer'}},['query']),
  tool('delegate','Spawn one bounded child agent for a genuinely separable subtask.',{task:{type:'string'}},['task'])
];

export async function runOllamaTask(task,opts,{primitiveShell,primitiveKnowledge}){
  const found=await detectOllama();if(!found.available)throw new Error(`${found.reason} No API key is required: use the GitHub Pages browser agent, or install Ollama and run \`ollama pull qwen3:0.6b\`.`);
  const runId=crypto.randomUUID(),root=path.resolve(opts.workspace||process.env.XRAI_WORKSPACE||process.cwd()),model=opts.model||found.model,maxDepth=opts.maxDepth??2,maxChildren=opts.maxChildren??2,retries=opts.retries??1,learn=opts.learn??true;
  bus.emitEvent(runId,'run:start',task,{data:{workspace:root,model:`ollama:${model}`,maxDepth,maxChildren,retries}});let attempts=0,finalOutput='',score=0;
  async function chat(messages,extra={}){return request('/api/chat',{model,messages,stream:false,think:false,options:{num_ctx:Number(process.env.XRAI_LOCAL_CONTEXT||32768)},...extra})}
  async function runAgent(agentTask,depth=0,parentAgentId){
    const agentId=crypto.randomUUID();let children=0;bus.emitEvent(runId,'agent:start',agentTask,{agentId,parentAgentId,name:depth?'Child agent':'Root agent'});
    const messages=[{role:'system',content:`You are XRAI Agent, a compact execution agent. Complete tasks end-to-end. Inspect before editing, prefer evidence, make minimal changes, test/verify, and never fabricate tool results. Workspace root: ${root}. Use tools as needed. Delegate only independent work.`},{role:'user',content:agentTask}];
    for(let turn=0;turn<32;turn++){
      const r=await chat(messages,{tools}),m=r.message||{role:'assistant',content:''};messages.push(m);const calls=m.tool_calls||[];
      if(!calls.length){const out=m.content||'Completed without a text response.';bus.emitEvent(runId,'agent:done',out.slice(0,900),{agentId,parentAgentId});return out}
      for(const call of calls){const name=call?.function?.name,args=call?.function?.arguments||{};bus.emitEvent(runId,'tool:start',`${name}: ${JSON.stringify(args).slice(0,500)}`,{agentId,name});let out;
        try{
          if(name==='bash')out=await primitiveShell(root,args.command,args.timeout_ms||120000);
          else if(name==='knowledge_search'){const hits=await primitiveKnowledge(root,args.query,args.limit||5);for(const h of hits)bus.emitEvent(runId,'knowledge:hit',`${path.basename(h.source)} · ${Math.round(h.score*100)}%`,{agentId,data:{source:h.source,score:h.score}});out=hits.length?hits.map((h,i)=>`[${i+1}] ${h.source}\n${h.text}`).join('\n\n'):'No relevant knowledge found.'}
          else if(name==='delegate'){if(depth>=maxDepth||children>=maxChildren)out='Delegation limit reached; continue yourself.';else{children++;bus.emitEvent(runId,'agent:delegate',args.task,{agentId,parentAgentId:agentId});out=await runAgent(args.task,depth+1,agentId)}}
          else out=`Unknown tool: ${name}`;
        }catch(e){out=`ERROR: ${e instanceof Error?e.message:String(e)}`}
        bus.emitEvent(runId,'tool:done',String(out).slice(0,800),{agentId,name,data:{ok:!String(out).startsWith('ERROR:')}});messages.push({role:'tool',tool_name:name,content:String(out)});
      }
    }
    throw new Error('Local agent exceeded 32 tool turns.');
  }
  async function evaluate(candidate){
    const schema={type:'object',properties:{score:{type:'number'},critique:{type:'string'},lesson:{type:'string'},tags:{type:'array',items:{type:'string'}}},required:['score','critique','lesson','tags'],additionalProperties:false};
    const r=await chat([{role:'system',content:'Strictly grade the candidate against the task. Return only valid JSON. Score >= 0.82 only when complete and verified. Extract one reusable lesson only when evidence supports it. Never store secrets or personal data.'},{role:'user',content:`TASK:\n${task}\n\nCANDIDATE:\n${candidate}`}],{format:schema});
    let ev;try{ev=JSON.parse(r.message?.content||'{}')}catch{ev={score:.75,critique:'Evaluator returned invalid JSON; retry for a cleaner verified result.',lesson:'',tags:[]}};ev.score=Math.max(0,Math.min(1,Number(ev.score)||0));return ev;
  }
  let feedback='';
  while(attempts<=retries){attempts++;finalOutput=await runAgent(feedback?`${task}\n\nEvaluator feedback from the previous attempt:\n${feedback}\nFix only the identified gaps.`:task);const ev=await evaluate(finalOutput);score=ev.score;bus.emitEvent(runId,'eval',`Score ${Math.round(score*100)}% — ${ev.critique}`,{name:'Evaluator',data:ev});if(score>=.82||attempts>retries){if(learn&&score>=.82&&ev.lesson?.trim()){await appendLesson(root,{task:task.slice(0,500),lesson:ev.lesson,score,tags:ev.tags||[]});bus.emitEvent(runId,'learn',ev.lesson,{data:{tags:ev.tags||[]}})}break}feedback=ev.critique;bus.emitEvent(runId,'retry',feedback,{data:{attempt:attempts+1}})}
  bus.emitEvent(runId,'run:done',finalOutput.slice(0,1200),{data:{score,attempts,provider:`ollama:${model}`}});return{runId,output:finalOutput,score,attempts,provider:`ollama:${model}`,events:bus.forRun(runId)};
}
