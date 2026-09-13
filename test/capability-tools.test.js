import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPABILITIES,classifyBuiltinTask,isEvaluatorArtifact,runBuiltinTask } from '../web/capability-tools.js';
import { searchWeb } from '../web/web-search.js';

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

test('evaluator JSON is recognized as an internal artifact and normal answers are not',()=>{
  const leaked='```json {"score":0.78,"critique":"needs work","work_product":{},"skills":[]} ```';
  assert.equal(isEvaluatorArtifact(leaked),true);
  assert.equal(isEvaluatorArtifact('Web search is enabled and verified with real source URLs.'),false);
});
