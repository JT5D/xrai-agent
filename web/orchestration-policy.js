const COMPLEX_RE=/\b(repo|repository|code|debug|fix|implement|refactor|architecture|research|compare|evaluate|benchmark|state of the art|optimi[sz]e|self[- ]?improv|multi[- ]?step|end[- ]?to[- ]?end|deep(?:ly)?|plan carefully)\b/i;
const MULTI_RE=/\b(and|also|then|plus|across|multiple|several|all|both|three|3|four|4)\b/i;
const VERIFY_RE=/\b(verify|test|prove|evidence|benchmark|measure|validate|check|working|correct)\b/i;
const FRESH_RE=/\b(latest|current|today|recent|2026|state of the art|github|web|online|research)\b/i;

export function analyzeOrchestration(task='',{constrained=false,maxChildren=2,maxRetries=1}={}){
  const text=String(task).trim(),words=text.split(/\s+/).filter(Boolean).length;
  let complexity=0;
  if(words>18)complexity++;
  if(words>45)complexity++;
  if(COMPLEX_RE.test(text))complexity+=2;
  if(MULTI_RE.test(text))complexity++;
  if(VERIFY_RE.test(text))complexity++;
  const separable=complexity>=3&&MULTI_RE.test(text);
  const evidenceCritical=VERIFY_RE.test(text)||/\b(code|repo|research|compare|benchmark|self[- ]?improv)\b/i.test(text);
  const fresh=FRESH_RE.test(text);
  const childCap=Math.max(0,Math.min(constrained?1:3,Number(maxChildren)||0));
  const retryCap=Math.max(0,Math.min(constrained?0:2,Number(maxRetries)||0));
  const workers=childCap===0?1:Math.min(childCap,complexity>=4&&separable?2:1);
  const retries=complexity>=3&&evidenceCritical?retryCap:0;
  const mode=complexity>=5?'deep':complexity>=3?'standard':'fast';
  return{mode,complexity,workers,retries,separable,evidenceCritical,fresh,parallelWorkers:workers>1};
}

export function shouldContinueImproving({score=0,previousScore=null,minScore=.82,attempt=1,maxAttempts=1,pathScore=score}={}){
  if(score>=minScore&&pathScore>=Math.max(0,minScore-.08))return{continue:false,reason:'target-met'};
  if(attempt>=maxAttempts)return{continue:false,reason:'budget-exhausted'};
  if(previousScore!==null&&score<=previousScore+.005)return{continue:false,reason:'no-gain'};
  return{continue:true,reason:'fixable-gap'};
}
