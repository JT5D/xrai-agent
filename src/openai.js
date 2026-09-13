const API='https://api.openai.com/v1/responses';
export async function response(body){
  const key=process.env.OPENAI_API_KEY;if(!key)throw new Error('OPENAI_API_KEY is required for autonomous CLI/browser runs. Claude Code or ChatGPT can use XRAI primitive MCP tools with the host model instead.');
  const r=await fetch(API,{method:'POST',headers:{'authorization':`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify(body)});
  const data=await r.json();if(!r.ok)throw new Error(data?.error?.message||`OpenAI ${r.status}`);return data;
}
export function outputText(r){if(typeof r.output_text==='string')return r.output_text;return (r.output||[]).flatMap(i=>i.type==='message'?(i.content||[]):[]).filter(c=>c.type==='output_text').map(c=>c.text).join('\n')}
