import fs from 'node:fs/promises';
import path from 'node:path';
const STOP=new Set('the a an and or to of in on for with is are be as at by from it this that use uses using'.split(' '));
const tokens=s=>[...new Set((String(s).toLowerCase().match(/[a-z0-9_+-]{2,}/g)||[]).filter(x=>!STOP.has(x)))];
async function walk(dir){try{const es=await fs.readdir(dir,{withFileTypes:true});return (await Promise.all(es.map(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]))).flat()}catch{return[]}}
export async function searchKnowledge(query,roots,limit=5){
  const q=tokens(query),files=(await Promise.all(roots.map(walk))).flat().filter(f=>/\.(md|txt|json|jsonl)$/i.test(f)),hits=[];
  for(const file of files){let text;try{text=await fs.readFile(file,'utf8')}catch{continue}for(const chunk of text.split(/\n(?=#{1,4}\s)|\n{2,}/).filter(Boolean)){const c=tokens(chunk),overlap=q.filter(t=>c.includes(t)).length;if(overlap)hits.push({source:file,text:chunk.slice(0,1800),score:overlap/Math.max(1,q.length)})}}
  return hits.sort((a,b)=>b.score-a.score).slice(0,limit);
}
export async function syncXraiKnowledge(dest){const base='https://raw.githubusercontent.com/JT5D/xrai/main/knowledge/';const names=['MISSION.md','KEY_LEARNINGS.md','SYSTEM_PATTERNS.md','AGENTIC_CODING_EVALS_2025_2026.md','UNVERIFIED.md'];await fs.mkdir(dest,{recursive:true});for(const name of names){const r=await fetch(base+name);if(!r.ok)throw new Error(`Failed ${name}: ${r.status}`);await fs.writeFile(path.join(dest,name),await r.text())}return names}
