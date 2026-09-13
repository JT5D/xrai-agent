import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPABILITIES,classifyBuiltinTask,extractSearchQuery,isEvaluatorArtifact,runBuiltinTask } from '../web/capability-tools.js';
import { formatWebResults,searchWeb } from '../web/web-search.js';

function response(body,{status=200,type='json'}={}){
  return {ok:status>=200&&status<300,status,json:async()=>body,text:async()=>type==='text'?String(body):JSON.stringify(body)};
}
function mockFetch(url){
  const u=String(url);
  if(u.includes('search.jina.ai'))return Promise.reject(new Error('CORS unavailable'));
  if(u.includes('api.duckduckgo.com'))return Promise.resolve(response({Heading:'XRAI',AbstractText:'A compact agent runtime.',AbstractURL:'https://example.com/xrai',RelatedTopics:[]}));
  if(u.includes('wikipedia.org'))return Promise.resolve(response({query:{search:[{title:'Artificial intelligence agent',snippet:'Software agents use tools.'}]}}));
  if(u.includes('hn.algolia.com'))return Promise.resolve(response({hits:[{title:'Agent runtimes',url:'https://news.ycombinator.com/item?id=1',points:42,author:'tester',objectID:'1'}]}));
  if(u.includes('api.github.com/search/repositories'))return Promise.resolve(response({items:[{full_name:'example/agent',html_url:'https://github.com/example/agent',stargazers_count:100,description:'Agent repo'}]}));
  return Promise.resolve(response({}, {status:404}));
}

test('capability request with web-search install language is routed to executable built-in capability',()=>{
  const task='what are all agent capabilities? can it search the web? if not add this skill & ensure it is state of art & fast';
  assert.equal(classifyBuiltinTask(task),'capabilities+web');
  assert.ok(CAPABILITIES.some(([name])=>/web research/i.test(name)));
});

test('web search executes multiple no-key providers and returns source URLs',async()=>{
  const result=await searchWeb('state of the art agents',{fetchFn:mockFetch,limit:6});
  assert.ok(result.results.length>=3);
  assert.ok(result.providers>=3);
  assert.ok(result.results.every(x=>/^https?:\/\//.test(x.url)));
  assert.ok(result.results.some(x=>x.source==='DuckDuckGo'));
  assert.ok(result.results.some(x=>x.source==='Wikipedia'));
  assert.ok(result.contributingProviders>=3);
});

test('named-entity web search removes answer-format instructions and rejects irrelevant lookalikes',async()=>{
  const task='Search the web for the current Model Context Protocol specification and give source URLs.';
  const query=extractSearchQuery(task),seen=[];
  assert.equal(query,'the current Model Context Protocol specification');
  const fetchFn=async url=>{
    const u=String(url);seen.push(u);
    if(u.includes('search.jina.ai'))return response('<a href="https://modelcontextprotocol.io/specification">Official specification</a>',{type:'text'});
    if(u.includes('api.duckduckgo.com'))return response({RelatedTopics:[]});
    if(u.includes('wikipedia.org'))return response({query:{search:[
      {title:'Transmission Control Protocol',snippet:'A transport protocol.'},
      {title:'Model Context Protocol',snippet:'An open protocol for model context.'}
    ]}});
    if(u.includes('hn.algolia.com'))return response({hits:[]});
    if(u.includes('api.github.com/search/repositories'))return response({items:[{full_name:'modelcontextprotocol/servers',html_url:'https://github.com/modelcontextprotocol/servers',stargazers_count:1,description:'Model Context Protocol servers'}]});
    return response({}, {status:404});
  };
  const result=await searchWeb(query,{fetchFn,limit:6});
  assert.ok(seen.every(url=>decodeURIComponent(url).includes('Model Context Protocol')));
  assert.equal(result.searchedQuery,'Model Context Protocol');
  assert.equal(result.results.length,3);
  assert.ok(result.results.every(row=>/model.?context.?protocol/i.test(`${row.title} ${row.url} ${row.snippet}`)));
  assert.equal(result.contributingProviders,3);
  assert.match(formatWebResults(result),/3 relevant results from 3 contributing providers; 5\/5 responded/i);
});

test('named-entity web search fails closed when only generic lookalikes respond',async()=>{
  const fetchFn=async url=>{
    const u=String(url);
    if(u.includes('wikipedia.org'))return response({query:{search:[{title:'Transmission Control Protocol',snippet:'A transport protocol.'},{title:'OAuth',snippet:'An authorization protocol.'}]}});
    if(u.includes('search.jina.ai'))return response('',{type:'text'});
    if(u.includes('api.duckduckgo.com'))return response({RelatedTopics:[]});
    if(u.includes('hn.algolia.com'))return response({hits:[]});
    if(u.includes('api.github.com/search/repositories'))return response({items:[]});
    return response({}, {status:404});
  };
  const result=await searchWeb('the current Model Context Protocol specification',{fetchFn,limit:6});
  assert.equal(result.results.length,0);
  assert.equal(result.providers,5);
  assert.equal(result.contributingProviders,0);
  assert.match(formatWebResults(result),/no usable results/i);
});

test('web search bounds stalled provider body reads, not only response headers',async()=>{
  const stalledFetch=url=>{
    if(String(url).includes('search.jina.ai'))return Promise.resolve({ok:true,status:200,text:()=>new Promise(()=>{}),json:async()=>({})});
    return mockFetch(url);
  };
  const started=Date.now();
  const result=await searchWeb('bounded provider test',{fetchFn:stalledFetch,limit:6,providerTimeoutMs:25});
  assert.ok(Date.now()-started<500,'stalled provider escaped the whole-operation deadline');
  assert.ok(result.results.length>=3);
  assert.ok(result.errors.some(x=>/jina.*timed out/i.test(x)));
});

test('exact bad capability prompt executes a grounded capability answer rather than model planning',async()=>{
  const events=[];
  const result=await runBuiltinTask('what are all agent capabilities? can it search the web? if not add this skill & ensure it is state of art & fast',{fetchFn:mockFetch,emit:e=>events.push(e)});
  assert.equal(result.provider,'browser-tools');
  assert.match(result.output,/web search is a real built-in runtime tool/i);
  assert.match(result.output,/does not require SerpAPI, Redis, Python/i);
  assert.doesNotMatch(result.output,/api_selection_justification|Redis configuration|missing_elements|requests\b|pytest\b/i);
  assert.ok(events.some(e=>e.type==='tool:start'&&e.name==='web_search'));
  assert.ok(events.some(e=>e.type==='tool:done'&&e.name==='web_search'));
});

test('self-improvement proof requests are evidence-only and cannot invent improvements',async()=>{
  const task='show me proof that self improvement happened; list 3 improvements';
  assert.equal(classifyBuiltinTask(task),'self-improvement-proof');
  const storage={getItem:()=>JSON.stringify({version:4,events:[
    {type:'improvement:accept',summary:'Retry improved verified score',data:{baseline:.82,candidate:.91,delta:.09,verifier:'trace-aware evaluator'}},
    {type:'skill:promoted',summary:'Promoted safer verifier skill',data:{id:'skill-x',version:2,baseline:.88,candidateScore:.94,verified:true}}
  ]})};
  const events=[];const result=await runBuiltinTask(task,{storage,emit:e=>events.push(e)});
  assert.equal(result.provider,'browser-tools');assert.equal(result.learning.status,'evidence-only');
  assert.match(result.output,/2 verified retained improvements/i);assert.match(result.output,/skill-x@v2/);assert.match(result.output,/baseline 82%/);
  assert.doesNotMatch(result.output,/Text Summarization|AI Safety Knowledge|chain-of-thought prompting/i);
  assert.ok(events.some(e=>e.name==='improvement_evidence'&&e.data?.count===2));
});

test('real self-improvement action requests are not intercepted by the proof router',()=>{
  assert.equal(classifyBuiltinTask('prove self improvement is happening by making 3 improvements now'),null);
  assert.equal(classifyBuiltinTask('improve yourself now and verify the changes'),null);
});

test('self-improvement proof fails closed to zero when no retained evidence exists',async()=>{
  const result=await runBuiltinTask('show me proof of self improvement',{storage:{getItem:()=>JSON.stringify({version:4,events:[]})}});
  assert.match(result.output,/^0 verified improvements/i);assert.match(result.output,/will not invent improvements/i);
});

test('evaluator JSON is recognized as an internal artifact and normal answers are not',()=>{
  const leaked='```json {"score":0.78,"critique":"needs work","work_product":{},"skills":[]} ```';
  assert.equal(isEvaluatorArtifact(leaked),true);
  assert.equal(isEvaluatorArtifact('Web search is enabled and verified with real source URLs.'),false);
});
