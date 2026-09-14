import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bus } from './events.js';
import { runTask } from './kernel.js';
import { detectOllama } from './ollama.js';
import { handleRpc } from './mcp.js';
import { skillStats } from './skills.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const webDir=path.resolve(here,'../web');
const knowledgeDir=path.resolve(here,'../knowledge');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json'};

async function body(req){
  const chunks=[];let n=0;
  for await(const c of req){n+=c.length;if(n>1_000_000)throw new Error('Body too large');chunks.push(c)}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
}
function json(res,status,value){
  res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});
  res.end(JSON.stringify(value));
}
function publicRun(state){
  if(!state)return null;
  return {...state,events:bus.forRun(state.runId).slice(-500)};
}

export function createRunManager(runner=runTask){
  const runs=new Map();let latestRunId=null;
  function prune(){
    if(runs.size<=50)return;
    const finished=[...runs.values()].filter(r=>r.status!=='running').sort((a,b)=>a.startedAt-b.startedAt);
    for(const item of finished.slice(0,Math.max(0,runs.size-50)))runs.delete(item.runId);
  }
  function start(task,opts={}){
    const runId=crypto.randomUUID();
    const state={runId,task,status:'running',startedAt:Date.now(),updatedAt:Date.now(),output:'',score:null,attempts:0,learning:null,error:null};
    runs.set(runId,state);latestRunId=runId;prune();
    Promise.resolve()
      .then(()=>runner(task,{...opts,runId}))
      .then(result=>Object.assign(state,{status:'completed',updatedAt:Date.now(),completedAt:Date.now(),output:result.output||'',score:result.score??null,attempts:result.attempts??0,learning:result.learning??null,result:{...result,events:undefined}}))
      .catch(error=>Object.assign(state,{status:'error',updatedAt:Date.now(),completedAt:Date.now(),error:error instanceof Error?error.message:String(error)}));
    return publicRun(state);
  }
  return {
    start,
    get:id=>publicRun(runs.get(id)),
    latest:()=>publicRun(latestRunId?runs.get(latestRunId):null),
    list:()=>[...runs.values()].sort((a,b)=>b.startedAt-a.startedAt).slice(0,20).map(publicRun)
  };
}

export async function startWebServer(port=Number(process.env.XRAI_PORT||8787),host=process.env.XRAI_HOST||'127.0.0.1',options={}){
  const clients=new Set();
  const runManager=createRunManager(options.runner||runTask);
  bus.on('event',event=>{
    const chunk=`data: ${JSON.stringify(event)}\n\n`;
    for(const res of clients)res.write(chunk);
  });
  const server=createServer(async(req,res)=>{try{
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    if(url.pathname==='/mcp'){
      if(req.method!=='POST'){res.writeHead(405,{'allow':'POST'});return res.end()}
      const input=await body(req),items=Array.isArray(input)?input:[input],out=[];
      for(const item of items){const r=await handleRpc(item);if(r)out.push(r)}
      if(!out.length){res.writeHead(202);return res.end()}
      return json(res,200,Array.isArray(input)?out:out[0]);
    }
    if(url.pathname==='/events'){
      res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});
      res.write(': connected\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return;
    }
    if(url.pathname==='/api/events')return json(res,200,bus.events.slice(-500));
    if(url.pathname==='/api/skills')return json(res,200,await skillStats(process.env.XRAI_WORKSPACE||process.cwd()));
    if(url.pathname==='/api/runs/latest')return json(res,200,runManager.latest());
    if(url.pathname==='/api/runs'&&req.method==='GET')return json(res,200,runManager.list());
    const runMatch=url.pathname.match(/^\/api\/runs\/([a-f0-9-]+)$/i);
    if(runMatch){const state=runManager.get(runMatch[1]);return state?json(res,200,state):json(res,404,{error:'run not found'})}
    if(url.pathname==='/api/capabilities'){
      const local=process.env.OPENAI_API_KEY?{available:false}:await detectOllama();
      const autonomous=Boolean(process.env.OPENAI_API_KEY||local.available);
      return json(res,200,{
        version:'0.2.1',learning:'evidence-gated-skills',environment:'local-server',autonomous,
        provider:process.env.OPENAI_API_KEY?'openai':local.available?'ollama':'browser-local',
        model:process.env.OPENAI_API_KEY?(process.env.XRAI_MODEL||'gpt-5.6-luna'):(local.model||'on-device browser model'),
        capabilities:{browserLocal:true,filesystem:autonomous,shell:autonomous,repoExecution:autonomous,mcp:true,runPersistence:true},
        mcp:'/mcp'
      });
    }
    if((url.pathname==='/api/runs'||url.pathname==='/api/run')&&req.method==='POST'){
      const input=await body(req);
      if(!input.task||typeof input.task!=='string')return json(res,400,{error:'task is required'});
      const state=runManager.start(input.task,{workspace:input.workspace,retries:input.retries??1,maxDepth:input.maxDepth??2,maxChildren:input.maxChildren??2});
      return json(res,202,state);
    }
    let file=url.pathname==='/'?'index.html':url.pathname.slice(1);
    file=path.normalize(file).replace(/^\.\.(\/|\\|$)/,'');
    const base=file.startsWith('knowledge'+path.sep)||file.startsWith('knowledge/')?knowledgeDir:webDir;
    const rel=base===knowledgeDir?file.replace(/^knowledge[\/\\]/,''):file;
    const data=await fs.readFile(path.join(base,rel));
    res.writeHead(200,{'content-type':mime[path.extname(file)]||'text/plain; charset=utf-8','cache-control':'no-cache'});
    res.end(data);
  }catch(e){
    if(!res.headersSent)json(res,e?.code==='ENOENT'?404:500,{error:e instanceof Error?e.message:String(e)});else res.end();
  }});
  await new Promise(resolve=>server.listen(port,host,resolve));
  const address=server.address();const actualPort=typeof address==='object'&&address?address.port:port;
  return{server,url:`http://${host}:${actualPort}`};
}
