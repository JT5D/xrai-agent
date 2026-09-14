import fs from 'node:fs/promises';
import path from 'node:path';

const apiUrl=process.env.XRAI_CANDIDATE_API_URL;
const apiKey=process.env.XRAI_CANDIDATE_API_KEY;
const model=process.env.XRAI_CANDIDATE_MODEL;
const timeoutMs=Number(process.env.XRAI_CANDIDATE_CASE_TIMEOUT_MS||45_000);
const reasoningEffort=(process.env.XRAI_CANDIDATE_REASONING_EFFORT||'').trim();
if(!apiUrl||!model)throw new Error('Set XRAI_CANDIDATE_API_URL and XRAI_CANDIDATE_MODEL. Set XRAI_CANDIDATE_API_KEY for authenticated remote endpoints. This evaluator never reads production provider credentials implicitly.');
const endpoint=new URL(apiUrl),loopback=endpoint.protocol==='http:'&&['127.0.0.1','localhost','::1'].includes(endpoint.hostname);
if(endpoint.protocol!=='https:'&&!loopback)throw new Error('XRAI_CANDIDATE_API_URL must use HTTPS unless it is a loopback HTTP endpoint.');
if(!apiKey&&!loopback)throw new Error('XRAI_CANDIDATE_API_KEY is required for non-loopback endpoints.');
if(!Number.isFinite(timeoutMs)||timeoutMs<1_000||timeoutMs>180_000)throw new Error('XRAI_CANDIDATE_CASE_TIMEOUT_MS must be between 1000 and 180000.');

const safeModel=model.replace(/[^a-z0-9_.-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,96)||'candidate';
const artifactDir=path.resolve('artifacts',`remote-model-qualification-${safeModel}`);
const report={model,apiUrl,startedAt:new Date().toISOString(),timeoutMs,cases:[]};
await fs.mkdir(artifactDir,{recursive:true});
const persist=()=>fs.writeFile(path.join(artifactDir,'qualification.json'),JSON.stringify(report,null,2));

function outputText(response){
  if(typeof response?.output_text==='string')return response.output_text;
  return (response?.output||[]).flatMap(item=>item?.type==='message'?(item.content||[]):[]).filter(c=>c?.type==='output_text').map(c=>c.text||'').join('\n');
}
function functionCall(response,name){
  const calls=(response?.output||[]).filter(x=>x?.type==='function_call'&&(!name||x.name===name));
  return calls[0]||null;
}
function exact(name,response,expected,ms){
  const output=outputText(response).trim();
  return{name,passed:output===expected,expected,output,durationMs:ms,responseId:response?.id||null};
}
function toolArgs(name,response,tool,expected,ms){
  const call=functionCall(response,tool);let parsed=null,error=null;
  try{parsed=call?(typeof call.arguments==='string'?JSON.parse(call.arguments||'{}'):call.arguments):null}catch(e){error=e instanceof Error?e.message:String(e)}
  const passed=Boolean(call&&!error&&Object.entries(expected).every(([k,v])=>parsed?.[k]===v)&&Object.keys(parsed||{}).length===Object.keys(expected).length);
  return{name,passed,tool,expected,arguments:parsed,rawArguments:typeof call?.arguments==='string'?call.arguments:JSON.stringify(call?.arguments??null),error,durationMs:ms,responseId:response?.id||null};
}
function fn(name,description,properties,required){
  return{type:'function',name,description,parameters:{type:'object',properties,required,additionalProperties:false},strict:true};
}
async function call(body){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const request={model,max_output_tokens:256,...body};
    if(reasoningEffort)request.reasoning={effort:reasoningEffort};
    const headers={'content-type':'application/json'};if(apiKey)headers.authorization=`Bearer ${apiKey}`;
    const response=await fetch(apiUrl,{method:'POST',headers,body:JSON.stringify(request),signal:controller.signal});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data?.error?.message||data?.message||`HTTP ${response.status}`);
    if(data?.error)throw new Error(data.error.message||JSON.stringify(data.error));
    return data;
  }finally{clearTimeout(timer)}
}
async function run(name,work,grade){
  const started=Date.now();let result;
  try{const response=await work();result=grade(response,Date.now()-started)}
  catch(error){result={name,passed:false,error:error instanceof Error?error.message:String(error),durationMs:Date.now()-started}}
  report.cases.push(result);await persist();
  if(!result.passed)throw new Error(`${name} failed`);
  return result;
}

try{
  await run('instruction-following',()=>call({input:'Follow this instruction exactly. Reply with only XRAI_OK and no punctuation or explanation.'}),(r,ms)=>exact('instruction-following',r,'XRAI_OK',ms));
  await run('arithmetic-sanity',()=>call({input:'Reply with only the number. What is 17 + 25?'}),(r,ms)=>exact('arithmetic-sanity',r,'42',ms));

  const memoryResponse=await call({input:'Remember this codeword for the next turn: ORBIT-73. Reply with only ACK.'});
  if(!memoryResponse?.id)throw new Error('conversation seed did not return a response id');
  await run('conversation-recall',()=>call({previous_response_id:memoryResponse.id,input:'What is the codeword? Reply with only the codeword.'}),(r,ms)=>exact('conversation-recall',r,'ORBIT-73',ms));

  const readFile=fn('read_file','Read one workspace file.',{path:{type:'string'}},['path']);
  await run('structured-tool-arguments',()=>call({input:'Call read_file for src/app.js. Do not answer in text.',tools:[readFile],tool_choice:'required'}),(r,ms)=>toolArgs('structured-tool-arguments',r,'read_file',{path:'src/app.js'},ms));

  await run('simple-code-diagnosis',()=>call({input:'Bug: function add(a,b){return a-b}. The test add(2,3) expects 5. Reply with exactly the single replacement operator and nothing else.'}),(r,ms)=>exact('simple-code-diagnosis',r,'+',ms));

  const applyEdit=fn('apply_edit','Apply one exact bounded text replacement.',{path:{type:'string'},search:{type:'string'},replace:{type:'string'}},['path','search','replace']);
  await run('simple-code-repair',()=>call({input:'Repair src/math.js containing function add(a,b){return a-b}. Call apply_edit with the smallest exact replacement. Do not answer in text.',tools:[applyEdit],tool_choice:'required'}),(r,ms)=>toolArgs('simple-code-repair',r,'apply_edit',{path:'src/math.js',search:'return a-b',replace:'return a+b'},ms));

  report.passed=report.cases.filter(x=>x.passed).length;report.total=report.cases.length;report.ok=report.passed===report.total;report.finishedAt=new Date().toISOString();await persist();
  console.log(JSON.stringify({model:report.model,apiUrl:report.apiUrl,passed:report.passed,total:report.total,cases:report.cases.map(x=>({name:x.name,passed:x.passed,durationMs:x.durationMs,error:x.error}))},null,2));
}catch(error){
  report.passed=report.cases.filter(x=>x.passed).length;report.total=6;report.ok=false;report.error=error instanceof Error?error.message:String(error);report.finishedAt=new Date().toISOString();await persist();
  console.error(JSON.stringify({model:report.model,apiUrl:report.apiUrl,passed:report.passed,total:report.total,last:report.cases.at(-1)},null,2));
  process.exitCode=1;
}
