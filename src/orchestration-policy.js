const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));

// Frontier models own planning, decomposition, tool choice, and whether delegation is useful.
// This policy only supplies hard ceilings so code constrains failure modes rather than intelligence.
export function analyzeOrchestration(task='',{maxChildren=2,maxRetries=1,maxDepth=2,maxTurns=32}={}){
  const children=clamp(maxChildren,0,4),retries=clamp(maxRetries,0,3),depth=clamp(maxDepth,0,3),turns=clamp(maxTurns,8,48);
  return{
    mode:'model-led',
    children,
    retries,
    depth,
    maxTurns:turns,
    reasoning:null,
    separable:null,
    evidenceCritical:null,
    fresh:null,
    taskHint:String(task||'').slice(0,160)
  };
}
