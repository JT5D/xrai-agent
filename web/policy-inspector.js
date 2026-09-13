import { ingestPolicyOutcomes,policyStore } from './orchestration-policy.js';

const pct=n=>Number.isFinite(Number(n))?`${Math.round(Number(n)*100)}%`:'—';
const ms=n=>Number.isFinite(Number(n))?`${Math.round(Number(n))} ms`:'—';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function ensure(){
  if(document.querySelector('#policyInspector'))return;
  const style=document.createElement('style');style.textContent=`
  .policy-chip{position:absolute;left:12px;top:12px;z-index:18;border:1px solid rgba(90,130,166,.34);background:rgba(6,17,30,.9);color:#b8cee2;border-radius:9px;padding:7px 10px;font-size:10px;cursor:pointer}.policy-chip b{color:#fff}.policy-chip span{color:#7895b2;margin-left:5px}.policy-inspector{position:fixed;right:0;top:0;bottom:0;z-index:61;width:min(460px,94vw);overflow:auto;background:#081421;border-left:1px solid #274766;padding:16px;color:#d7e9fb}.policy-inspector[hidden]{display:none}.policy-inspector header{display:flex;align-items:center;justify-content:space-between;gap:10px}.policy-inspector button{border:0;background:transparent;color:#9fb5cc;font-size:22px;cursor:pointer}.policy-inspector h3{font-size:13px;margin:16px 0 8px}.policy-card{border:1px solid rgba(116,153,190,.18);border-radius:9px;padding:10px;margin:8px 0;background:rgba(18,40,63,.38)}.policy-card strong{font-size:12px}.policy-card small{display:block;color:#83a0ba;margin-top:3px;line-height:1.45}.policy-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:8px}.policy-metrics div{background:rgba(255,255,255,.025);padding:7px;border-radius:6px}.policy-metrics b{display:block;font-size:11px}.policy-metrics span{font-size:9px;color:#6f89a4;text-transform:uppercase}.policy-empty{font-size:11px;color:#7895b2}.policy-decision{border-left:2px solid #5c8db7;padding-left:9px;margin:9px 0}.policy-decision.promoted{border-color:#58b98b}.policy-decision.rollback{border-color:#d38a69}@media(max-width:760px){.policy-inspector{top:auto;height:min(68vh,590px);width:100%;border-left:0;border-top:1px solid #274766}}
  `;document.head.append(style);
  const graph=document.querySelector('#graph');if(graph){const chip=document.createElement('button');chip.type='button';chip.id='policyChip';chip.className='policy-chip';chip.innerHTML='<b>Policy</b><span>adaptive</span>';graph.parentElement.style.position='relative';graph.parentElement.append(chip);chip.addEventListener('click',open)}
  const panel=document.createElement('aside');panel.id='policyInspector';panel.className='policy-inspector';panel.hidden=true;panel.innerHTML='<header><div><strong>Orchestration policy evolution</strong><div style="font-size:10px;color:#7895b2;margin-top:3px">Comparable evidence only · quality/path/latency aware</div></div><button type="button" aria-label="Close policy inspector">×</button></header><div id="policyBody"></div>';document.body.append(panel);panel.querySelector('button').addEventListener('click',()=>panel.hidden=true);
}
function open(){render();document.querySelector('#policyInspector').hidden=false}
function metric(label,value){return `<div><span>${esc(label)}</span><b>${esc(value)}</b></div>`}
function render(){
  ingestPolicyOutcomes(localStorage);const s=policyStore(localStorage),body=document.querySelector('#policyBody'),chip=document.querySelector('#policyChip');if(!body)return;
  const incumbents=Object.entries(s.incumbentByBucket||{});chip?.querySelector('span')&&(chip.querySelector('span').textContent=incumbents.length?`${new Set(incumbents.map(([,v])=>v)).size} active`:'adaptive-v1');
  let html='<h3>Active policies</h3>';
  if(!incumbents.length)html+='<p class="policy-empty">No challenger has earned promotion yet. Adaptive-v1 remains the default.</p>';
  else for(const [bucket,key] of incumbents)html+=`<div class="policy-card"><strong>${esc(key)}</strong><small>${esc(bucket)}</small></div>`;
  html+='<h3>Recent evidence</h3>';const outcomes=(s.outcomes||[]).slice(-8).reverse();if(!outcomes.length)html+='<p class="policy-empty">Comparable run evidence will appear after completed tasks.</p>';
  for(const o of outcomes)html+=`<div class="policy-card"><strong>${esc(o.policyKey)}</strong><small>${esc(o.bucket)} · ${esc(o.runId?.slice?.(0,8)||'run')}</small><div class="policy-metrics">${metric('Score',pct(o.score))}${metric('Path',pct(o.pathScore))}${metric('Latency',ms(o.durationMs))}${metric('Work',`${o.workers||1} worker · ${o.retries||0} retry`)}</div></div>`;
  html+='<h3>Promotion / rollback decisions</h3>';const decisions=(s.decisions||[]).slice(-8).reverse();if(!decisions.length)html+='<p class="policy-empty">No policy change has enough comparable evidence yet.</p>';
  for(const d of decisions){const cls=d.type==='policy:promoted'?'promoted':d.type==='policy:rollback'?'rollback':'';html+=`<div class="policy-decision ${cls}"><strong>${esc(d.type.replace('policy:',''))}</strong><small>${esc(d.bucket)} · ${esc(d.reason)}</small><div class="policy-metrics">${metric('Incumbent',d.incumbent||d.restore||'—')}${metric('Challenger',d.challenger||d.restore||'—')}${metric('Δ utility',d.utility?.delta!=null?`${(d.utility.delta*100).toFixed(1)} pt`:'—')}${metric('Samples',JSON.stringify(d.samples||{}))}</div></div>`}
  body.innerHTML=html;
}
function install(){ensure();ingestPolicyOutcomes(localStorage);setInterval(()=>{ingestPolicyOutcomes(localStorage);if(!document.querySelector('#policyInspector')?.hidden)render()},3000)}
install();
