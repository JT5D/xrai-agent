import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bus } from './events.js';
import { runTask } from './kernel.js';
import { detectOllama } from './ollama.js';
import { handleRpc } from './mcp.js';
const here=path.dirname(fileURLToPath(import.meta.url)),webDir=path.resolve(here,'../web'),knowledgeDir=path.resolve(here,'../knowledge');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json'};
async function body(req){const chunks=[];let n=0;for await(const c of req){n+=c.length;if(n>1_000_000)throw new Error('Body too large');chunks.push(c)}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}
function json(res,status,value){res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value))}
export async function startWebServer(port=Number(process.env.XRAI_PORT||8787),host=process.env.XRAI_HOST||'127.0.0.1'){
  const clients=new Set();bus.on('event',event=>{const chunk=`data: ${JSON.stringify(event)}\n\n`;for(const res of clients)res.write(chunk)});
  const server=createServer(async(req,res)=>{try{
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    if(url.pathname==='/mcp'){
      if(req.method!=='POST'){res.writeHead(405,{'allow':'POST'});return res.end()}
      const input=await body(req),items=Array.isArray(input)?input:[input],out=[];for(const item of items){const r=await handleRpc(item);if(r)out.push(r)}
      if(!out.length){res.writeHead(202);return res.end()}return json(res,200,Array.isArray(input)?out:out[0]);
    }
    if(url.pathname==='/events'){res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});res.write(': connected\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return}
    if(url.pathname==='/api/events')return json(res,200,bus.events.slice(-500));
    if(url.pathname==='/api/capabilities'){const local=process.env.OPENAI_API_KEY?{available:false}:await detectOllama();return json(res,200,{autonomous:Boolean(process.env.OPENAI_API_KEY||local.available),provider:process.env.OPENAI_API_KEY?'openai':local.available?'ollama':'browser-local',model:process.env.OPENAI_API_KEY?(process.env.XRAI_MODEL||'gpt-5.6-luna'):(local.model||'on-device browser model'),mcp:'/mcp'})}
    if(url.pathname==='/api/run'&&req.method==='POST'){const input=await body(req);if(!input.task||typeof input.task!=='string')return json(res,400,{error:'task is required'});const r=await runTask(input.task,{workspace:input.workspace,retries:input.retries??1,maxDepth:input.maxDepth??2,maxChildren:input.maxChildren??2});return json(res,200,r)}
    let file=url.pathname==='/'?'index.html':url.pathname.slice(1);file=path.normalize(file).replace(/^\.\.(\/|\\|$)/,'');const base=file.startsWith('knowledge'+path.sep)||file.startsWith('knowledge/')?knowledgeDir:webDir;const rel=base===knowledgeDir?file.replace(/^knowledge[\/\\]/,''):file;const data=await fs.readFile(path.join(base,rel));res.writeHead(200,{'content-type':mime[path.extname(file)]||'text/plain; charset=utf-8'});res.end(data)
  }catch(e){if(!res.headersSent)json(res,e?.code==='ENOENT'?404:500,{error:e instanceof Error?e.message:String(e)});else res.end()}});
  await new Promise(resolve=>server.listen(port,host,resolve));return{server,url:`http://${host}:${port}`}
}
