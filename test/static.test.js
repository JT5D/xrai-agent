import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { checkChromeModelAvailability,compoundingMetrics,extractEval,selectBrowserModelProfile,withWebGpuFallback } from '../web/local-agent.js';
import { formatVerifiedImprovementReport,requestedImprovementCount,shouldGuardImprovementClaim,verifiedImprovementsForRun } from '../web/improvement-guard.js';

test('static Pages build has no-key local inference and evidence-gated skill learning',async()=>{
  const app=await fs.readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const local=await fs.readFile(new URL('../web/local-agent.js',import.meta.url),'utf8');
  const bootstrap=await fs.readFile(new URL('../web/coi-bootstrap.js',import.meta.url),'utf8');
  assert.match(app,/runLocalTask/);assert.match(local,/LanguageModel/);assert.match(local,/LFM2\.5-350M-ONNX/);assert.match(local,/SmolLM2-135M-Instruct-ONNX-MHA/);assert.match(local,/xrai-skills-v2/);assert.match(local,/supportNeeded/);assert.match(local,/minVersionGain/);assert.match(local,/pathScore/);assert.match(local,/improvement:stop/);assert.match(local,/parsePlannerDecision/);assert.match(local,/orchestration:decision/);assert.match(bootstrap,/app\.js/);assert.match(bootstrap,/browser-enhancements\.js/);
});

test('Chrome built-in AI readiness is bounded and falls back when availability never resolves',async()=>{
  const started=Date.now();
  const result=await checkChromeModelAvailability({availability:()=>new Promise(()=>{})},{},20);
  assert.deepEqual(result,{status:'unavailable',timedOut:true});
  assert.ok(Date.now()-started<250,'Chrome availability escaped its bounded readiness gate');
});

test('browser local model retries WASM when a claimed WebGPU backend is unusable',async()=>{
  const calls=[],progress=[];
  const result=await withWebGpuFallback(async profile=>{
    calls.push({...profile});
    if(profile.device==='webgpu')throw new Error('Failed to get GPU adapter');
    return profile;
  },{device:'webgpu',dtype:'q4f16',modelId:'test-model',label:'test'},message=>progress.push(message));
  assert.deepEqual(calls.map(x=>x.device),['webgpu','wasm']);
  assert.equal(result.device,'wasm');assert.equal(result.dtype,'q4');
  assert.match(progress.join(' '),/retrying with WASM/i);
});

test('live deployed E2E stops waiting as soon as the app records an error',async()=>{
  const e2e=await fs.readFile(new URL('./live-pages.e2e.mjs',import.meta.url),'utf8');
  assert.match(e2e,/runStatus==='error'\)return true/);
  assert.match(e2e,/runStatus==='completed'&&s\?\.result\?\.runId/);
});

test('browser evaluator parse failure is fail-closed and cannot promote learning',()=>{
  const ev=extractEval('not valid evaluator json');assert.equal(ev.score,0);assert.equal(ev.pathScore,0);assert.equal(ev.compositeScore,0);assert.equal(ev.skill.title,'');
});

test('browser evaluator caps learning when execution path quality is poor',()=>{
  const ev=extractEval('{"score":0.95,"pathScore":0.4,"critique":"good answer","pathCritique":"weak evidence","skill":{"title":"","trigger":"","procedure":"","verifier":"","tags":[]}}');
  assert.equal(ev.score,.95);assert.equal(ev.pathScore,.4);assert.equal(ev.compositeScore,.55);
});

test('compounding metrics expose transfer and repair efficiency from existing run records',()=>{
  const m=compoundingMetrics([
    {score:.9,pathScore:.88,attempts:1,skillRefs:['skill-a@1']},
    {score:.86,pathScore:.84,attempts:2,skillRefs:['skill-a@1']},
    {score:.78,pathScore:.76,attempts:1,skillRefs:[]},
    {score:.8,pathScore:.79,attempts:2,skillRefs:[]}
  ]);
  assert.equal(m.skillRuns,2);assert.equal(m.noSkillRuns,2);assert.ok(m.observedSkillLift>.08);assert.equal(m.repairRuns,2);assert.equal(m.repairSuccessRate,.5);assert.equal(m.avgAttempts,1.5);assert.ok(m.avgPathScore>.8);
});

test('self-improvement claims are replaced by retained structured evidence',()=>{
  assert.equal(requestedImprovementCount('prove self improvement is happening by making 3 improvements now'),3);
  assert.equal(shouldGuardImprovementClaim('prove self improvement is happening by making 3 improvements now','3 Improvements Made: learned and optimized'),true);
  const state={events:[
    {id:'a',runId:'r',type:'improvement:accept',summary:'Retry improved verified score',data:{baseline:.82,candidate:.91,delta:.09}},
    {id:'b',runId:'r',type:'skill:promoted',summary:'Promoted safer verifier',data:{id:'skill-x',version:2,baseline:.88,candidateScore:.94,verified:true}}
  ]};
  const rows=verifiedImprovementsForRun(state,'r');assert.equal(rows.length,2);const report=formatVerifiedImprovementReport(rows,3);assert.match(report,/2 verified retained improvements/);assert.match(report,/baseline 82%/);assert.match(report,/skill-x@v2/);
  assert.match(formatVerifiedImprovementReport([],3),/0 verified improvements/);
});

test('browser chooses a smaller quantized model on mobile, a full model when requested, and a fast fallback',()=>{
  const mobile=selectBrowserModelProfile({userAgent:'iPhone',gpu:{}});assert.equal(mobile.constrained,true);assert.match(mobile.modelId,/135M/);assert.equal(mobile.maxNewTokens,220);
  const desktop=selectBrowserModelProfile({userAgent:'Desktop',deviceMemory:16,gpu:{}});assert.equal(desktop.constrained,false);assert.match(desktop.modelId,/350M/);assert.equal(desktop.maxNewTokens,420);
  const fallback=selectBrowserModelProfile({userAgent:'Desktop',deviceMemory:16,gpu:{}},true);assert.equal(fallback.constrained,false);assert.match(fallback.modelId,/135M/);assert.equal(fallback.maxNewTokens,220);
});

test('public build links the canonical public XRAI Agent repository',async()=>{
  const html=await fs.readFile(new URL('../web/index.html',import.meta.url),'utf8');
  const readme=await fs.readFile(new URL('../README.md',import.meta.url),'utf8');
  assert.match(html,/https:\/\/github\.com\/JT5D\/xrai-agent/);
  assert.match(readme,/git clone https:\/\/github\.com\/JT5D\/xrai-agent\.git/);
  assert.doesNotMatch(html,/private preview repo/i);
  assert.doesNotMatch(readme,/JT5D\/unrepo/);
});

test('public browser version and gated runtime bootstrap stay synchronized',async()=>{
  const html=await fs.readFile(new URL('../web/index.html',import.meta.url),'utf8');
  const bootstrap=await fs.readFile(new URL('../web/coi-bootstrap.js',import.meta.url),'utf8');
  const pkg=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url),'utf8'));
  const version=String(pkg.version).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  assert.match(html,new RegExp(`<dt>Version<\\/dt><dd>${version}<\\/dd>`));
  for(const asset of ['coi-bootstrap.js','static-runtime.js'])assert.match(html,new RegExp(`${asset.replace('.','\\.')}\\?v=${version}`));
  assert.doesNotMatch(html,/type="module"/);
  for(const asset of ['input-guard.js','browser-enhancements.js','event-inspector.js','policy-inspector.js','improvement-guard.js','app.js'])assert.match(bootstrap,new RegExp(asset.replace('.','\\.')));
  assert.match(bootstrap,/registration\.update/);assert.match(bootstrap,/waitForActivation/);assert.match(bootstrap,/loadModules/);
});

test('public graph ships exact provenance binding plus interactive X-ray inspection',async()=>{
  const app=await fs.readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const inspector=await fs.readFile(new URL('../web/event-inspector.js',import.meta.url),'utf8');
  const policy=await fs.readFile(new URL('../web/policy-inspector.js',import.meta.url),'utf8');
  const html=await fs.readFile(new URL('../web/index.html',import.meta.url),'utf8');
  const history=await fs.readFile(new URL('../web/browser-enhancements.js',import.meta.url),'utf8');
  assert.match(app,/eventId/);assert.match(app,/dataset\.eventId/);assert.match(inspector,/events\.find\(e=>e\.id===n\.dataset\.eventId\)/);assert.match(inspector,/X-ray provenance/);
  assert.match(inspector,/graph-tooltip/);assert.match(inspector,/dblclick/);assert.match(inspector,/toggleExpanded/);assert.match(inspector,/fitGraph/);assert.match(inspector,/pointerdown/);assert.match(inspector,/aria-label/);assert.match(inspector,/highlightPath/);
  assert.match(policy,/Model-led orchestration evidence/);assert.match(policy,/Model decides; runtime constrains/);assert.match(policy,/What code does not decide/);assert.doesNotMatch(policy,/setInterval/);assert.doesNotMatch(policy,/ingestPolicyOutcomes/);
  assert.match(html,/X-ray View/);assert.match(html,/God's-eye view/);assert.match(history,/Time Travel/);
});

test('browser guards use bounded state and scoped observers without perpetual polling',async()=>{
  const history=await fs.readFile(new URL('../web/browser-enhancements.js',import.meta.url),'utf8');
  const input=await fs.readFile(new URL('../web/input-guard.js',import.meta.url),'utf8');
  const improvement=await fs.readFile(new URL('../web/improvement-guard.js',import.meta.url),'utf8');
  const capabilities=await fs.readFile(new URL('../web/capability-tools.js',import.meta.url),'utf8');
  assert.doesNotMatch(history,/setInterval/);assert.doesNotMatch(history,/JSON\.parse\(localStorage\.getItem/);assert.match(history,/loadUiState/);assert.match(history,/saveUiState/);assert.match(history,/requestIdleCallback/);assert.match(history,/visibilitychange/);assert.match(history,/MutationObserver/);
  assert.match(input,/loadUiState/);assert.match(input,/MAX_UI_STATE_CHARS/);assert.match(capabilities,/loadUiState/);
  assert.match(improvement,/loadUiState/);assert.match(improvement,/saveUiState/);assert.match(improvement,/querySelector\('#messages'\)/);assert.doesNotMatch(improvement,/document\.documentElement/);assert.doesNotMatch(improvement,/characterData:true/);
});

test('public browser has integrated zero-install repo execution',async()=>{
  const app=await fs.readFile(new URL('../web/app.js',import.meta.url),'utf8');
  const workspace=await fs.readFile(new URL('../web/browser-workspace.js',import.meta.url),'utf8');
  const html=await fs.readFile(new URL('../web/index.html',import.meta.url),'utf8');
  const bootstrap=await fs.readFile(new URL('../web/coi-bootstrap.js',import.meta.url),'utf8');
  const sw=await fs.readFile(new URL('../web/coi-sw.js',import.meta.url),'utf8');
  assert.match(app,/runBrowserRepoTask/);
  assert.match(app,/taskNeedsExecutionHost/);
  assert.match(app,/downloadPatch/);
  assert.match(workspace,/@webcontainer\/api@1\.6\.4/);
  assert.match(workspace,/coep:'credentialless'/);
  assert.match(workspace,/\.teardown\(\)/);
  assert.match(workspace,/command timed out/);
  assert.match(workspace,/raw\.githubusercontent\.com/);
  assert.match(workspace,/Dependency install/);
  assert.match(workspace,/Test verifier/);
  assert.match(html,/coi-bootstrap\.js/);
  assert.doesNotMatch(html,/repo-runtime\.js/);
  assert.match(bootstrap,/serviceWorker\.register/);
  assert.match(bootstrap,/updateViaCache:'none'/);
  assert.match(sw,/cache:'no-store'/);
  assert.match(sw,/request\.mode==='navigate'/);
  assert.match(sw,/Cross-Origin-Opener-Policy/);
  assert.match(sw,/Cross-Origin-Embedder-Policy/);
});