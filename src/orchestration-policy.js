const COMPLEX_RE=/\b(repo|repository|code|debug|fix|implement|refactor|architecture|research|compare|evaluate|benchmark|state of the art|optimi[sz]e|self[- ]?improv|multi[- ]?step|end[- ]?to[- ]?end|deep(?:ly)?|plan carefully)\b/i;
const MULTI_RE=/\b(and|also|then|plus|across|multiple|several|all|both|three|3|four|4)\b/i;
const VERIFY_RE=/\b(verify|test|prove|evidence|benchmark|measure|validate|check|working|correct)\b/i;
const FRESH_RE=/\b(latest|current|today|recent|2026|state of the art|github|web|online|research)\b/i;

export function analyzeOrchestration(task='',{maxChildren=2,maxRetries=1,maxDepth=2}={}){
  const text=String(task).trim(),words=text.split(/\s+/).filter(Boolean).length;
  let complexity=0;if(words>18)complexity++;if(words>45)complexity++;if(COMPLEX_RE.test(text))complexity+=2;if(MULTI_RE.test(text))complexity++;if(VERIFY_RE.test(text))complexity++;
  const separable=complexity>=3&&MULTI_RE.test(text),evidenceCritical=VERIFY_RE.test(text)||/\b(code|repo|research|compare|benchmark|self[- ]?improv)\b/i.test(text),fresh=FRESH_RE.test(text);
  const childCap=Math.max(0,Math.min(4,Number(maxChildren)||0)),retryCap=Math.max(0,Math.min(3,Number(maxRetries)||0)),depthCap=Math.max(0,Math.min(3,Number(maxDepth)||0));
  const children=childCap===0?0:Math.min(childCap,complexity>=4&&separable?2:complexity>=3?1:0),retries=complexity>=3&&evidenceCritical?retryCap:0,depth=children?Math.min(depthCap,complexity>=5?2:1):0;
  const mode=complexity>=5?'deep':complexity>=3?'standard':'fast',maxTurns=mode==='deep'?32:mode==='standard'?22:12,reasoning=mode==='deep'?'medium':'low';
  return{mode,complexity,children,retries,depth,maxTurns,reasoning,separable,evidenceCritical,fresh};
}
