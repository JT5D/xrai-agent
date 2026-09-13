const uid=()=>globalThis.crypto?.randomUUID?.()||`xrai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;

function inferStatus(type=''){
  if(/(?:^|:)start$|delegate$/.test(type))return'running';
  if(/blocked|error|fail/i.test(type))return'error';
  if(/(?:^|:)done$|eval$|hit$|update$/.test(type))return'completed';
  if(/retry/i.test(type))return'retrying';
  return'event';
}

function inferKind(type=''){
  if(type.startsWith('tool:'))return'tool';
  if(type.startsWith('agent:'))return'agent';
  if(type.startsWith('knowledge:')||type==='skill:hit')return'retrieval';
  if(type==='eval'||type==='retry')return'verification';
  if(type.startsWith('skill:')||type==='meta:update')return'learning';
  if(type==='capability:blocked')return'capability';
  if(type.startsWith('run:'))return'run';
  if(type==='model:ready')return'model';
  return'event';
}

function safeEvidence(data={}){
  if(!data||typeof data!=='object')return{};
  const out={};
  for(const key of ['exitCode','timedOut','repo','branch','sha','fileCount','changedFiles','attempts','score','provider','model','sources','url','command']){
    if(data[key]!=null)out[key]=data[key];
  }
  return out;
}

export function normalizeEvent(value={}){
  const type=String(value.type||'event');
  const ts=value.ts||new Date().toISOString();
  const data=value.data&&typeof value.data==='object'?value.data:{};
  return {
    ...value,
    id:String(value.id||uid()),
    runId:String(value.runId||''),
    parentId:value.parentId||value.parentAgentId||null,
    type,
    kind:value.kind||inferKind(type),
    name:String(value.name||value.agentId||value.tool||inferKind(type)),
    status:value.status||inferStatus(type),
    ts,
    startedAt:value.startedAt||ts,
    endedAt:value.endedAt||null,
    durationMs:Number.isFinite(value.durationMs)?value.durationMs:null,
    summary:String(value.summary||''),
    inputSummary:String(value.inputSummary||''),
    outputSummary:String(value.outputSummary||''),
    evidence:{...safeEvidence(data),...(value.evidence&&typeof value.evidence==='object'?value.evidence:{})},
    error:value.error?String(value.error):null,
    data
  };
}

export function normalizeEvents(rows=[]){return(Array.isArray(rows)?rows:[]).map(normalizeEvent)}

export function eventInspectorRows(event={}){
  const e=normalizeEvent(event),rows=[
    ['Type',e.type],['Status',e.status],['Name',e.name],['Summary',e.summary]
  ];
  if(e.durationMs!=null)rows.push(['Duration',`${e.durationMs} ms`]);
  if(e.inputSummary)rows.push(['Input',e.inputSummary]);
  if(e.outputSummary)rows.push(['Output',e.outputSummary]);
  for(const [key,val] of Object.entries(e.evidence||{})){
    const text=Array.isArray(val)?val.join(', '):typeof val==='object'?JSON.stringify(val):String(val);
    rows.push([key,text]);
  }
  if(e.error)rows.push(['Error',e.error]);
  return rows.filter(([,value])=>value!==''&&value!=null);
}
