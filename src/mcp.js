import readline from 'node:readline';
import { runTask,primitiveKnowledge,primitiveShell } from './kernel.js';
import { skillStats } from './skills.js';

export const MCP_TOOLS=[
  {name:'xrai_run',description:'Run the complete recursive XRAI agent with evidence-gated skill learning. Uses OpenAI when configured or a local Ollama model with no model API key.',inputSchema:{type:'object',properties:{task:{type:'string'},workspace:{type:'string'}},required:['task'],additionalProperties:false}},
  {name:'xrai_shell',description:'Run a workspace-rooted shell command. Lets ChatGPT or Claude Code act as the model/orchestrator without a second model API call.',inputSchema:{type:'object',properties:{command:{type:'string'},workspace:{type:'string'}},required:['command'],additionalProperties:false}},
  {name:'xrai_knowledge',description:'Search XRAI knowledge plus promoted evidence-gated skills. Candidate/rejected skills are never returned.',inputSchema:{type:'object',properties:{query:{type:'string'},workspace:{type:'string'},limit:{type:'integer',minimum:1,maximum:8}},required:['query'],additionalProperties:false}},
  {name:'xrai_skills',description:'Inspect promoted/candidate skill counts and the current evidence-driven meta-skill policy for a workspace.',inputSchema:{type:'object',properties:{workspace:{type:'string'}},additionalProperties:false}}
];

const ok=(id,result)=>({jsonrpc:'2.0',id,result});
const err=(id,code,message)=>({jsonrpc:'2.0',id,error:{code,message}});
export async function handleRpc(msg){
  const id=msg?.id;
  try{
    if(msg?.method==='initialize')return ok(id,{protocolVersion:msg.params?.protocolVersion||'2025-11-25',capabilities:{tools:{listChanged:false}},serverInfo:{name:'xrai-agent',version:'0.2.0'},instructions:'Use XRAI tools for workspace execution, evidence-gated skill retrieval/inspection, or the complete recursive agent. Promoted skills are reusable hypotheses; verification evidence outranks memory.'});
    if(msg?.method==='notifications/initialized'||msg?.method==='notifications/cancelled')return null;
    if(msg?.method==='ping')return ok(id,{});
    if(msg?.method==='tools/list')return ok(id,{tools:MCP_TOOLS});
    if(msg?.method==='tools/call'){
      const {name,arguments:a={}}=msg.params||{};let text;
      if(name==='xrai_run'){const r=await runTask(a.task,{workspace:a.workspace});text=JSON.stringify({output:r.output,score:r.score,runId:r.runId,learning:r.learning},null,2)}
      else if(name==='xrai_shell')text=await primitiveShell(a.workspace||'.',a.command);
      else if(name==='xrai_knowledge')text=JSON.stringify(await primitiveKnowledge(a.workspace||'.',a.query,a.limit||5),null,2);
      else if(name==='xrai_skills')text=JSON.stringify(await skillStats(a.workspace||'.'),null,2);
      else return ok(id,{content:[{type:'text',text:`Unknown tool: ${name}`}],isError:true});
      return ok(id,{content:[{type:'text',text}]});
    }
    return id===undefined?null:err(id,-32601,`Method not found: ${msg?.method}`);
  }catch(e){return id===undefined?null:ok(id,{content:[{type:'text',text:`ERROR: ${e instanceof Error?e.message:String(e)}`}],isError:true})}
}

export function startMcpStdio(){
  const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
  console.error('xrai-agent MCP listening on stdio');
  rl.on('line',async line=>{if(!line.trim())return;try{const msg=JSON.parse(line),r=await handleRpc(msg);if(r)process.stdout.write(JSON.stringify(r)+'\n')}catch(e){process.stdout.write(JSON.stringify(err(null,-32700,e instanceof Error?e.message:String(e)))+'\n')}});
  return rl;
}
