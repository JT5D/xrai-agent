import { ingestPolicyOutcomes,policyStore } from './orchestration-policy.js';

const pct=n=>Number.isFinite(Number(n))?`${Math.round(Number(n)*100)}%`:'—';
const ms=n=>Number.isFinite(Number(n))?`${Math.round(Number(n))} ms`:'—';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function ensure(){
  if(document.querySelector('#policyInspector'))return;
  const style=document.createElement('style');style.textContent=`
  .policy-chip{position:absolute;left:12px;top:12px;z-index:18;border:1px solid rgba(90,130,166,.34);background:rgba(6,17,30,.9);color:#b8cee2;border-radius:9px;padding:7px 10px;font-size:10px;cursor:pointer}.policy-chip b{color:#fff}.policy-chip span{color:#7895b2;margin-left:5px}.policy-inspector{position:fixed;right:0;top:0;bottom:0;z-index:61;width:min(460px,94vw);overflow:auto;background:#081421;border-left:1px solid #274766;padding:16px;color:#d7e9fb}.policy-inspector[hidden]{display:none}.policy-inspector header{display:flex;align-items:center;justify-content:space-between;gap:10px}.policy-inspector button{border:0;background:transparent;color:#9fb5cc;font-size:22px;cursor:pointer}.policy-inspector h3{font-size:13px;margin:16px 0 8px}.policy-card{border:1px solid rgba(116,153,190,.18);border-radius:9px;padding:10px;margin:8px 0;background:rgba(18,40,63,.38)}.policy-card strong{font-size:12px}.policy-card small{display:block;color:#83a0ba;margin-top:3px;line-height:1.45}.policy-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:8px}.policy-metrics div{background:rgba(255,255,255,.025);padding:7px;border-radius:6px}.policy-metrics b{display:block;font-size:11px}.policy-metrics span{font-size:9px;color:#6f89a4;text-transform:uppercase}.policy-empty{font-size:11px;color:#7895b2}@media(max-width:760px){.policy-inspector{top:auto;height:min(68vh,590px);width:100%;border-left:0;border-top:1px solid #274766}}
  `;document.head.append(style);
  const graph=document.querySelector('#graph');if(graph){const chip=document.createElement('button');chip.type='button';chip.id='policyChip';chip.className='policy-chip';chip.innerHTML='<b>Orchestration</b><span>model-led</span>';graph.parentElement.style.position='relative';graph.parentElement.append(chip);chip.addEventListener('click',open)}
  const panel=document.createElement('aside');panel.id='policyInspector';panel.className='policy-inspector';panel.hidden=true;panel.innerHTML='<header><div><strong>Model-led orchestration evidence</strong><div style="font-size:10px;color:#7895b2;margin-top:3px">The model chooses execution shape · runtime caps and outcomes stay inspectable</div></div><button type="button" aria-label="Close policy inspector">×</button></header><div id="policyBody"></div>';document.body.append(panel);panel.querySelector('button').addEventListener('click',()=>panel.hidden=true);
}
function open(){render();document.querySelector('#policyInspector').hidden=false}
function metric(label,value){return `<div><span>${esc(label)}</span><b>${esc(value)}</b></div>`}
function render(){
  ingestPolicyOutcomes(localStorage);const s=policyStore(localStorage),body=document.querySelector('#policyBody'),chip=document.querySelector('#policyChip');if(!body)return;chip?.querySelector('span')&&(chip.querySelector('span').textContent='model-led');
  let html='<h3>Runtime contract</h3><div class="policy-card"><strong>Model decides; runtime constrains</strong><small>Planning, delegation, and worker count are model choices. Device/user worker caps, retry ceilings, evidence gates, and verification remain deterministic.</small></div>';
  html+='<h3>Recent observed decisions</h3>';const outcomes=(s.outcomes||[]).slice(-10).reverse();if(!outcomes.length)html+='<p class="policy-empty">Completed browser runs will appear here with the model-selected work shape and measured outcome.</p>';
  for(const o of outcomes)html+=`<div class="policy-card"><strong>${esc(o.policyKey||'model-led-v1')}</strong><small>${esc(o.bucket)} · ${esc(o.runId?.slice?.(0,8)||'run')}</small><div class="policy-metrics">${metric('Score',pct(o.score))}${metric('Path',pct(o.pathScore))}${metric('Latency',ms(o.durationMs))}${metric('Chosen work',`${o.workers||1} worker · ${o.retries||0} retry`)}</div></div>`;
  html+='<h3>What code does not decide</h3><p class="policy-empty">No keyword classifier promotes “fast”, “deep”, “breadth”, or “efficient” reasoning modes. Those semantic choices belong to the model; this view records outcomes rather than pretending the runtime can out-reason it.</p>';
  body.innerHTML=html;
}
function install(){ensure();ingestPolicyOutcomes(localStorage);setInterval(()=>{ingestPolicyOutcomes(localStorage);if(!document.querySelector('#policyInspector')?.hidden)render()},3000)}
install();
