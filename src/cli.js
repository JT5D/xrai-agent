#!/usr/bin/env node
import readline from 'node:readline/promises';
import { stdin as input,stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runTask } from './kernel.js';
import { startWebServer } from './server.js';
import { startMcpStdio } from './mcp.js';
import { syncXraiKnowledge } from './knowledge.js';
import { skillStats } from './skills.js';
const args=process.argv.slice(2),cmd=args[0]||'chat',rest=args.slice(1);
async function chat(){const rl=readline.createInterface({input,output});console.log('XRAI Agent · /exit to quit');while(true){const q=(await rl.question('› ')).trim();if(!q)continue;if(q==='/exit'||q==='/quit')break;try{const r=await runTask(q);console.log(`\n${r.output}\n\nscore ${Math.round(r.score*100)}% · ${r.attempts} attempt(s) · run ${r.runId.slice(0,8)}\n`)}catch(e){console.error(e instanceof Error?e.message:String(e))}}rl.close()}
async function main(){
  if(cmd==='web'){const port=rest.find(x=>/^\d+$/.test(x));const {url}=await startWebServer(port?Number(port):undefined);console.log(`XRAI: ${url}\nMCP HTTP: ${url}/mcp`);return}
  if(cmd==='mcp'){startMcpStdio();return}
  if(cmd==='skills'){console.log(JSON.stringify(await skillStats(process.env.XRAI_WORKSPACE||process.cwd()),null,2));return}
  if(cmd==='sync'){const here=path.dirname(fileURLToPath(import.meta.url));const names=await syncXraiKnowledge(path.resolve(here,'../knowledge'));console.log(`Synced ${names.length} XRAI knowledge files.`);return}
  if(cmd==='run'){const task=rest.join(' ').trim();if(!task)throw new Error('Usage: xrai run "task"');const r=await runTask(task);console.log(r.output);console.error(`score=${Math.round(r.score*100)}% run=${r.runId}`);return}
  if(['help','--help','-h'].includes(cmd)){console.log('xrai [chat]\nxrai run "task"\nxrai web [port]\nxrai mcp\nxrai skills\nxrai sync\n\nNo API key is required. CLI uses local Ollama when available; browser can run on-device; ChatGPT/Claude can act as the host model through MCP. OPENAI_API_KEY is an optional hosted upgrade.');return}
  await chat();
}
main().catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1});
