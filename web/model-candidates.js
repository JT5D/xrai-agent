const CDN='https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.1';
const LFM12B_ID='LiquidAI/LFM2.5-1.2B-Instruct-ONNX';
let lfm12bPromise;

function normalizeGenerated(out){
  const x=Array.isArray(out)?out[0]:out,g=x?.generated_text??x?.text??x;
  if(Array.isArray(g))return g.filter(m=>m?.role==='assistant').at(-1)?.content||g.at(-1)?.content||JSON.stringify(g);
  return String(g??'');
}

export async function getLfm12bCandidate(onProgress=()=>{}){
  if(!lfm12bPromise)lfm12bPromise=(async()=>{
    const {pipeline}=await import(CDN);
    onProgress('Loading LFM2.5 1.2B Instruct candidate · WebGPU Q4…');
    const generator=await pipeline('text-generation',LFM12B_ID,{
      device:'webgpu',
      dtype:'q4',
      progress_callback:p=>{
        if(p?.progress!=null)onProgress(`Downloading candidate model ${Math.round(p.progress)}%`);
        else if(p?.status)onProgress(String(p.status));
      }
    });
    return{
      name:'LFM2.5 1.2B Instruct · WebGPU Q4 · candidate',
      prompt:async messages=>normalizeGenerated(await generator(messages,{max_new_tokens:256,do_sample:false,repetition_penalty:1.05}))
    };
  })().catch(error=>{lfm12bPromise=null;throw error});
  return lfm12bPromise;
}
