const DEFAULT_LIMIT=8;
const TIMEOUT_MS=4500;

function clean(value=''){return String(value).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()}
function dedupe(rows,limit=DEFAULT_LIMIT){
  const seen=new Set(),out=[];
  for(const row of rows){
    const url=String(row?.url||'').trim(),title=clean(row?.title||'');
    if(!url||!title||seen.has(url))continue;
    seen.add(url);out.push({...row,title,snippet:clean(row.snippet||'').slice(0,500)});
    if(out.length>=limit)break;
  }
  return out;
}
async function timedFetch(url,fetchFn,timeout=TIMEOUT_MS){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{return await fetchFn(url,{headers:{accept:'application/json,text/html;q=0.9,*/*;q=0.8'},signal:controller.signal,cache:'no-store'})}finally{clearTimeout(timer)}
}
function flattenDdg(topics,out=[]){
  for(const item of topics||[]){
    if(Array.isArray(item?.Topics))flattenDdg(item.Topics,out);
    else if(item?.FirstURL&&item?.Text)out.push({title:item.Text.split(' - ')[0]||item.Text,url:item.FirstURL,snippet:item.Text,source:'DuckDuckGo'});
  }
  return out;
}
async function duckduckgo(query,fetchFn){
  const url=`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1&skip_disambig=1`;
  const r=await timedFetch(url,fetchFn);if(!r.ok)throw new Error(`DuckDuckGo ${r.status}`);const d=await r.json(),rows=[];
  if(d.AbstractURL&&d.AbstractText)rows.push({title:d.Heading||query,url:d.AbstractURL,snippet:d.AbstractText,source:'DuckDuckGo'});
  return rows.concat(flattenDdg(d.RelatedTopics));
}
async function wikipedia(query,fetchFn){
  const url=`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=1&format=json&origin=*`;
  const r=await timedFetch(url,fetchFn);if(!r.ok)throw new Error(`Wikipedia ${r.status}`);const d=await r.json();
  return (d?.query?.search||[]).slice(0,6).map(x=>({title:x.title,url:`https://en.wikipedia.org/wiki/${encodeURIComponent(String(x.title).replace(/ /g,'_'))}`,snippet:x.snippet,source:'Wikipedia'}));
}
async function hackerNews(query,fetchFn){
  const url=`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=6`;
  const r=await timedFetch(url,fetchFn);if(!r.ok)throw new Error(`Hacker News ${r.status}`);const d=await r.json();
  return (d?.hits||[]).map(x=>({title:x.title||x.story_title,url:x.url||`https://news.ycombinator.com/item?id=${x.objectID}`,snippet:`${x.points||0} points · ${x.author||'unknown author'}`,source:'Hacker News'}));
}
async function github(query,fetchFn){
  const url=`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=6`;
  const r=await timedFetch(url,fetchFn);if(!r.ok)throw new Error(`GitHub ${r.status}`);const d=await r.json();
  return (d?.items||[]).map(x=>({title:x.full_name,url:x.html_url,snippet:`★ ${x.stargazers_count||0} · ${x.description||''}`,source:'GitHub'}));
}
async function jina(query,fetchFn){
  const url=`https://search.jina.ai/?q=${encodeURIComponent(query)}`;
  const r=await timedFetch(url,fetchFn,3500);if(!r.ok)throw new Error(`Jina Search ${r.status}`);const text=await r.text(),rows=[];
  const re=/<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;let m;
  while((m=re.exec(text))&&rows.length<6){const link=m[1];if(/search\.jina\.ai|jina\.ai\/(?:api|reader)/i.test(link))continue;const title=clean(m[2]);if(title.length<3)continue;rows.push({title,url:link,snippet:'Search result',source:'Jina Search'})}
  return rows;
}

export async function searchWeb(query,{fetchFn=globalThis.fetch,limit=DEFAULT_LIMIT}={}){
  const q=clean(query);if(!q)throw new Error('Web search query is empty.');if(typeof fetchFn!=='function')throw new Error('Fetch is unavailable in this runtime.');
  const started=Date.now(),providers=[jina,duckduckgo,wikipedia,hackerNews,github];
  const settled=await Promise.allSettled(providers.map(fn=>fn(q,fetchFn)));
  const results=dedupe(settled.flatMap(x=>x.status==='fulfilled'?x.value:[]),limit);
  const errors=settled.map((x,i)=>x.status==='rejected'?`${providers[i].name}: ${x.reason?.message||x.reason}`:null).filter(Boolean);
  return{query:q,results,providers:providers.length-errors.length,attemptedProviders:providers.length,latencyMs:Date.now()-started,errors};
}

export function formatWebResults(search){
  if(!search?.results?.length)return `I searched the web for “${search?.query||''}”, but the no-key providers returned no usable results. ${search?.errors?.length?`Provider notes: ${search.errors.slice(0,2).join('; ')}`:''}`.trim();
  const lines=search.results.map((r,i)=>`${i+1}. ${r.title} — ${r.source}\n${r.url}${r.snippet?`\n${r.snippet}`:''}`);
  return `Web search: “${search.query}”\n${search.results.length} results from ${search.providers}/${search.attemptedProviders} available providers in ${search.latencyMs} ms.\n\n${lines.join('\n\n')}`;
}
