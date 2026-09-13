import { isRuntimeStatusQuestion } from './runtime-status.js';
import { visibleTask,isContextualFollowup,isRetryFollowup } from './input-guard.js';
const FOLLOWUP=/\b(?:previous|these|those|this|that|our|chat history|recommendations?|plans?)\b/i;
export function isContinuation(task=''){
  if(isRuntimeStatusQuestion(task))return true;
  return /^(?:did|have|has|was|were|is|are|what|which)\b[\s\S]*\b(?:improvements?|plans?|changes?|executed|implemented|installed|verified|done|finished|working)\b/i.test(task.trim())||isContextualFollowup(task)||(/\b(?:do|execute|implement|apply|finish|continue|verify|fix|remember)\b/i.test(task)&&FOLLOWUP.test(task));
}
export function conversationContext(state={},task=''){
  const prior=state.context||{};
  const users=(state.messages||[]).filter(m=>m.role==='user');
  const goal=prior.goal||[...users].reverse().find(m=>!isContinuation(m.text))?.text||'';
  const explicit=String(task).match(/https?:\/\/github\.com\/([\w.-]+\/[\w.-]+)/i)||String(task).match(/\brepo(?:sitory)?\s*[:=]?\s+([\w.-]+\/[\w.-]+)/i);
  const repo=(explicit?.[1]||prior.repo||'JT5D/xrai-agent').replace(/\.git$/,'');
  const messages=[];let size=0;
  for(const m of [...(state.messages||[])].reverse()){
    if(!['user','agent'].includes(m.role)||m.id==='welcome')continue;
    const content=(m.role==='user'?visibleTask(m.text):String(m.text||'')).slice(0,1200);if(size+content.length>8000||messages.length>=14)break;
    messages.unshift({role:m.role==='agent'?'assistant':'user',content});size+=content.length;
  }
  return {repo,lastTask:[...users].reverse().find(m=>!isRetryFollowup(m.text))?.text||goal,goal:String(goal).slice(0,2000),messages,previousResult:state.result};
}
export function executionIntent(task='',context={}){
  task=task.trim().replace(/^(?:can|could|would)\s+you\s+(?:please\s+)?(?=(?:fix|repair|implement|install|refactor|modify|edit|patch|execute|run|verify)\b)/i,'');
  if(/^(?:did|does|has|have|is|are|what|why|can|could|should|remember|summarize|explain)\b/i.test(task.trim()))return false;
  if(/^(?:please\s+)?(?:try|retry|again|repeat|rerun)\b/i.test(task.trim()))return executionIntent(context.lastTask||context.goal||'',{});
  if(/^\s*(?:research|search|look up)\b/i.test(task)&&! /\b(?:implement|install|integrate|fix|refactor|apply|edit)\b/i.test(task))return false;
  const action=/\b(?:fix|implement|install|integrate|refactor|modify|edit|patch|commit|push|execute|run|verify|review|audit|improve)\b|\bmak(?:e|ing)\s+(?:\d+\s+)?(?:more\s+)?improvements?\b/i;
  const scope=/\b(?:repos?|repository|xrai|tests?|code|skills?|context|chat|recommendations?|plans?)\b/i;
  return (action.test(task)||isContinuation(task))&&scope.test(`${task} ${context.goal||''}`);
}
export function contextualResearchQuery(task='',context={}){
  if(isContinuation(task)&&/\b(?:research|search)\b/i.test(context.goal||''))return contextualResearchQuery(context.goal,{});
  const scoped=/\b(?:xrai|agent|repo|github)\b/i.test(`${task} ${context.goal||''}`);
  if(scoped&&/\b(?:similar|improvements?|imrovements?|recommendations?|skills?)\b/i.test(task)&&!/\bModel Context Protocol\b/.test(task))
    return /\bskills?\b/i.test(task)?'AI agent skills tools':'AI agent orchestration';
  return null;
}
export function requestsChanges(task='',context={}){
  const target=isContinuation(task)?`${task} ${context.goal||''}`:task;
  return /\b(?:fix|repair|edit|patch|change)\b/i.test(target.replace(/\b(?:fix|repair)\s+(?:any\s+)?(?:failed|failing|broken)\s+tests?\b/ig,''))||/\b(?:improve|improvements?|implement|install|integrate|refactor|modify|add|recommendations?)\b/i.test(target);
}
export function reasoningOutput(text=''){
  // A language-model answer is not an execution receipt.
  if(/\bI\s+(?:have\s+)?(?:executed|installed|deployed|committed|pushed|implemented|created the file|ran the tests)\b|\b(?:skill|context handling|context manager)\s+(?:is |was |has been )?(?:added|installed|implemented)\b|\bStatus:\s*Pass\b/i.test(text))
    return 'The model produced an unsupported execution claim, so that answer was rejected. No commands, edits, installations, or deployments were performed by this reasoning-only run.';
  return String(text);
}
